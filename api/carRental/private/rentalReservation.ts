import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import {z} from "zod";
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
    loadSelectedExtras,
} from "@carRentalModule/utilities/services/rentalReservationService";
import {notifyRentalCustomer} from "@carRentalModule/utilities/services/rentalNotify";

export const basePath = "/api/carRental/rentalReservation";

// Reservations are immutable after create — every change goes through RentalReservationActions.
// editSchema/buildUpdateData are stubs required by createCrudRouter; PATCH is a no-op.
export const {router} = createCrudRouter({
    collectionName: "rentalreservations",
    model: RentalReservation,
    service: rentalReservationService,
    entityName: "RentalReservation",
    createSchema: createRentalReservationFormSchema,
    editSchema: () => z.looseObject({_id: z.string()}),
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
        const account = params.businessAccount
            ? await RentalBusinessAccount.findOne({
                  _id: new ObjectId(String(params.businessAccount)),
                  company: company._id,
                  isActive: true,
                  deletedAt: null,
              }).session(session)
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
