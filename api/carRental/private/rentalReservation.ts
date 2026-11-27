import {ObjectId} from "mongodb";
import {noEditRentalReservationFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/noEditRentalReservation.form.validator";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {createRentalReservationFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.form.validators";
import {rentalReservationSelectFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservationSelect.form.validator";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {RentalReservationActions} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.actions";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {
    rentalReservationToDTO,
    rentalReservationsToDTO,
} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {
    buildRentalReservation,
    loadApplicablePromo,
    loadBookableCategory,
    loadBookableVehicle,
    loadSelectedExtras,
} from "@carRentalModule/workflows/rentalReservationService";
import {notifyRentalCustomer} from "@carRentalModule/utilities/services/rentalNotify";
import {assertCardPaymentsAvailable} from "@carRentalModule/utilities/services/rentalPayments";

import {rentalBusinessAccountService} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount.service";
export const basePath = "/api/carRental/rentalReservation";

// Reservations are immutable after create — every change goes through RentalReservationActions.
// editSchema/buildUpdateData are stubs required by createCrudRouter; PATCH is a no-op.
export const {router} = createCrudRouter({
    collectionName: "rentalreservations",
    model: RentalReservation,
    service: rentalReservationService,
    entityName: "RentalReservation",
    createSchema: createRentalReservationFormSchema,
    editSchema: noEditRentalReservationFormSchema,
    toDTO: rentalReservationToDTO,
    toDTOArray: rentalReservationsToDTO,
    selectSchema: rentalReservationSelectFormSchema,
    toSelect: (reservations) =>
        reservations.map((reservation) => ({
            value: reservation._id.toString(),
            label: reservation.number,
        })),
    selectSearchField: "number",
    extraSelectFilter: ({vehicle}: any) =>
        vehicle ? {vehicle: new ObjectId(String(vehicle))} : {},
    defaultSort: {pickupAt: -1},
    actions: RentalReservationActions,
    /** Staff booking: the same trip rules, pricing and vehicle lock as online, but paid at the counter. */
    buildCreateData: async (params: any) => {
        const {company, session, logger, languageCode, actionUserCtx} = params;
        const ctx = {
            session,
            logger,
            languageCode,
            auditUserId: actionUserCtx.userId,
        };
        const config = await carRentalConfigService.getOrCreateForCompany(
            company._id,
            ctx,
        );
        const trip = await resolveRentalTrip(params, config, {
            companyId: company._id,
            languageCode,
            online: false,
            session,
        });
        const category = await loadBookableCategory(
            company._id,
            params.category,
            {languageCode, online: false, session},
        );
        // This exact car at its own prices (D198); otherwise a picked car is only which of the class's cars goes out.
        if (params.exactVehicle && !params.vehicle)
            throw apiValidationException("rental_exact_vehicle_required", "", null, languageCode);
        const exactVehicle = params.exactVehicle
            ? await loadBookableVehicle(company._id, params.vehicle, category, {languageCode, online: false, session})
            : undefined;
        const extras = await loadSelectedExtras(
            company._id,
            params.extras ?? [],
            {languageCode, session},
        );
        const promo = await loadApplicablePromo(
            company._id,
            params.promoCode,
            {config, category, trip, email: params.contact.email},
            {languageCode, session},
        );
        const paymentChoice =
            params.paymentChoice === "on_account"
                ? "on_account"
                : params.paymentChoice === "online"
                  ? "online"
                  : "pay_at_pickup";
        // "Online" waits for the customer's card: refused while card payments are coming soon (D190).
        if (paymentChoice === "online") assertCardPaymentsAvailable(languageCode);
        const account = params.businessAccount
            ? await rentalBusinessAccountService.findOne({
                  _id: new ObjectId(String(params.businessAccount)),
                  company: company._id,
                  isActive: true,
                  deletedAt: null,
              }, {session: session})
            : null;
        if (paymentChoice === "on_account" && !account)
            throw apiValidationException(
                "rental_on_account_needs_account",
                "",
                null,
                languageCode,
            );
        if (params.businessAccount && !account)
            throw apiValidationException(
                "rentalBusinessAccount_not_found",
                "",
                null,
                languageCode,
            );
        return buildRentalReservation(
            {
                companyId: company._id,
                config,
                category,
                vehicleId: params.vehicle,
                exactVehicle,
                trip,
                extras,
                contact: params.contact,
                promo,
                customerId: params.customer
                    ? new ObjectId(String(params.customer))
                    : undefined,
                businessAccountId: account?._id,
                accountDiscountPercent: account?.discountPercent,
                crossBorder: params.crossBorder === true,
                notes: params.notes,
                idempotencyKey: params.idempotencyKey,
                source: "staff",
                paymentChoice,
            },
            ctx,
        );
    },
    afterCreate: async (created, {session, languageCode}: any) => {
        if (created.status === "confirmed")
            await notifyRentalCustomer("confirmed", created, {
                session,
                languageCode,
            });
    },
    buildUpdateData: () => ({}),
});
