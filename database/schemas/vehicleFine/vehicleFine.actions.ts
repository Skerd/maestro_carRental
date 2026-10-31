import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {RentalPriceLineCode} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {VehicleFine as VehicleFineDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.dto";
import VehicleFine, {type IVehicleFine} from "./vehicleFine";
import RentalReservation from "../rentalReservation/rentalReservation";
import {carRentalConfigService} from "../carRentalConfig/carRentalConfig.service";
import {vehicleFineToDTO} from "@carRentalModule/utilities/mappers/vehicleFine/vehicleFineMapper.dto";
import {assertReservationWrite} from "@carRentalModule/utilities/services/rentalAccess";
import {addReservationCharges} from "@carRentalModule/utilities/services/rentalLifecycle";
import {chargeSavedCard} from "@carRentalModule/utilities/services/rentalDeposit";
import {bookingAtOffence, mainDriverName} from "@carRentalModule/utilities/services/rentalFines";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";

type ActionParams<F> = TransactionRequiredParams & F;

async function loadFine(params: ActionParams<{_id: string}>): Promise<IVehicleFine> {
    const fine = ObjectId.isValid(params._id)
        ? await VehicleFine.findOne({_id: new ObjectId(params._id), company: params.company._id, deletedAt: null}).session(params.session)
        : null;
    if (!fine) throw apiValidationException("vehicleFine_not_found", "", null, params.languageCode);
    return fine;
}

export class VehicleFineActions {
    /** Finds the booking and driver again, after the car or the time was corrected. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async matchDriver(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const fine = await loadFine(params);
        if (fine.chargedAmount) throw apiValidationException("rental_fine_already_charged", "", null, params.languageCode);
        const booking = await bookingAtOffence({companyId: params.company._id, vehicleId: nestedEntityToRef(fine.vehicle)!, offenceAt: fine.offenceAt}, params.session);
        fine.reservation = booking;
        fine.driverName = booking ? mainDriverName(booking) : undefined;
        if (fine.status === "received" || fine.status === "driver_identified") fine.status = booking ? "driver_identified" : "received";
        await fine.save({session: params.session});
        return vehicleFineToDTO(fine);
    }

    /**
     * Adds the fine and the company's handling fee to the booking and emails the
     * customer. A card saved at pickup is charged at once; otherwise the amount stays owed.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async chargeCustomer(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const {company, session, languageCode} = params;
        const fine = await loadFine(params);
        if (fine.chargedAmount) throw apiValidationException("rental_fine_already_charged", "", null, languageCode);
        const reservation = fine.reservation
            ? await RentalReservation.findOne({_id: nestedEntityToRef(fine.reservation), company: company._id, deletedAt: null}).session(session)
            : null;
        if (!reservation) throw apiValidationException("rental_fine_no_booking", "", null, languageCode);

        const ctx = {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId};
        const config = await carRentalConfigService.getOrCreateForCompany(company._id, ctx);
        const charges: {code: RentalPriceLineCode; label: string; amount: number}[] = [
            {code: "fine", label: rentalPricingLabel(languageCode, "fine", {reference: fine.reference}), amount: fine.amount},
        ];
        if (config.fineAdminFee) charges.push({code: "fine_admin", label: rentalPricingLabel(languageCode, "fineAdmin"), amount: config.fineAdminFee});
        const total = charges.reduce((sum, charge) => sum + charge.amount, 0);

        await addReservationCharges(reservation, charges, {by: new ObjectId(params.actionUserCtx.userId)}, ctx);
        if (await chargeSavedCard(reservation, total, ctx)) await reservation.save({session});
        fine.chargedAmount = total;
        fine.status = "charged";
        await fine.save({session});
        return vehicleFineToDTO(fine);
    }
}
