import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {RentalPriceLineCode} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {VehicleFine as VehicleFineDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.dto";
import type {RecordVehicleFinePaymentFormType} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.schema-def";
import {recordVehicleFinePaymentFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/recordVehicleFinePayment.form.validator";
import VehicleFine, {type IVehicleFine} from "./vehicleFine";
import RentalReservation, {type IRentalReservation} from "../rentalReservation/rentalReservation";
import {carRentalConfigService} from "../carRentalConfig/carRentalConfig.service";
import {vehicleFineToDTO} from "@carRentalModule/utilities/mappers/vehicleFine/vehicleFineMapper.dto";
import {assertReservationWrite} from "@carRentalModule/utilities/services/rentalAccess";
import {addReservationCharges, removeReservationCharges} from "@carRentalModule/utilities/services/rentalLifecycle";
import {chargeSavedCard} from "@carRentalModule/utilities/services/rentalDeposit";
import {matchFine} from "@carRentalModule/utilities/services/rentalFines";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";

type ActionParams<F> = TransactionRequiredParams & F;
type FineStatus = IVehicleFine["status"];

async function loadFine(params: ActionParams<{_id: string}>, statuses: FineStatus[]): Promise<IVehicleFine> {
    assertReservationWrite("status", params.actionUserCtx, params.languageCode);
    const fine = ObjectId.isValid(params._id)
        ? await VehicleFine.findOne({_id: new ObjectId(params._id), company: params.company._id, deletedAt: null}).session(params.session)
        : null;
    if (!fine) throw apiValidationException("vehicleFine_not_found", "", null, params.languageCode);
    if (!statuses.includes(fine.status)) throw apiValidationException("rental_fine_invalid_status", "", null, params.languageCode);
    return fine;
}

async function loadBooking(fine: IVehicleFine, params: ActionParams<{_id: string}>): Promise<IRentalReservation | null> {
    if (!fine.reservation) return null;
    return RentalReservation.findOne({_id: nestedEntityToRef(fine.reservation), company: params.company._id, deletedAt: null}).session(params.session);
}

/**
 * Adds the charges to the booking (a completed one gets its own invoice) and emails the
 * customer. A card saved at pickup is charged at once; otherwise the amount stays owed.
 * The fine keeps the lines it added.
 */
async function chargeBooking(
    fine: IVehicleFine,
    reservation: IRentalReservation,
    charges: {code: RentalPriceLineCode; label: string; amount: number}[],
    params: ActionParams<{_id: string}>,
): Promise<void> {
    const {session, languageCode} = params;
    const ctx = {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId};
    const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
    await addReservationCharges(reservation, charges, {by: new ObjectId(params.actionUserCtx.userId)}, ctx);
    if (await chargeSavedCard(reservation, total, ctx)) await reservation.save({session});
    fine.chargedAmount = total;
    fine.charges = charges.map(({label, amount}) => ({label, amount}));
}

export class VehicleFineActions {
    /** Finds the booking (or transfer) and driver again, after the car or the time was corrected, or a dispute was lost. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async matchDriver(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        const fine = await loadFine(params, ["received", "driver_identified", "disputed"]);
        const match = await matchFine({companyId: params.company._id, vehicleId: nestedEntityToRef(fine.vehicle)!, offenceAt: fine.offenceAt}, params.session);
        fine.reservation = match.reservation;
        fine.transfer = match.transfer;
        fine.driverName = match.driverName;
        fine.status = match.reservation || match.driverName ? "driver_identified" : "received";
        await fine.save({session: params.session});
        return vehicleFineToDTO(fine);
    }

    /** Recharges the fine and the company's handling fee to the booking that had the car. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async chargeCustomer(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        const {company, session, languageCode} = params;
        const fine = await loadFine(params, ["driver_identified"]);
        const reservation = await loadBooking(fine, params);
        if (!reservation) throw apiValidationException("rental_fine_no_booking", "", null, languageCode);
        const config = await carRentalConfigService.getOrCreateForCompany(company._id, {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId});
        const charges: {code: RentalPriceLineCode; label: string; amount: number}[] = [
            {code: "fine", label: rentalPricingLabel(languageCode, "fine", {reference: fine.reference}), amount: fine.amount},
        ];
        if (config.fineAdminFee) charges.push({code: "fine_admin", label: rentalPricingLabel(languageCode, "fineAdmin"), amount: config.fineAdminFee});
        await chargeBooking(fine, reservation, charges, params);
        fine.status = "charged";
        await fine.save({session});
        return vehicleFineToDTO(fine);
    }

    /**
     * Names the driver to the authority (with the driver letter), who then pays the fine.
     * The customer of the booking is charged only the company's handling fee, if set.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async nominateDriver(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        const {company, session, languageCode} = params;
        const fine = await loadFine(params, ["driver_identified"]);
        const reservation = await loadBooking(fine, params);
        if (reservation) {
            const config = await carRentalConfigService.getOrCreateForCompany(company._id, {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId});
            if (config.fineAdminFee) {
                await chargeBooking(
                    fine,
                    reservation,
                    [{code: "fine_admin", label: rentalPricingLabel(languageCode, "fineAdmin"), amount: config.fineAdminFee}],
                    params,
                );
            }
        }
        fine.status = "transferred";
        await fine.save({session});
        return vehicleFineToDTO(fine);
    }

    /**
     * The company paid the authority. A fine with no booking to recharge is then the
     * company's cost (`paid_by_company`); one with a booking can still be recharged.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: recordVehicleFinePaymentFormSchema})
    async recordPayment(params: ActionParams<RecordVehicleFinePaymentFormType>): Promise<VehicleFineDto> {
        const fine = await loadFine(params, ["received", "driver_identified", "charged"]);
        if (fine.paidAt) throw apiValidationException("rental_fine_already_paid", "", null, params.languageCode);
        fine.paidAt = new Date(params.paidAt);
        fine.paidAmount = params.paidAmount;
        fine.paymentReference = params.paymentReference;
        if (fine.status !== "charged" && !fine.reservation) fine.status = "paid_by_company";
        await fine.save({session: params.session});
        return vehicleFineToDTO(fine);
    }

    /** The fine is contested with the authority: nothing is charged or paid meanwhile. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async dispute(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        const fine = await loadFine(params, ["received", "driver_identified"]);
        fine.status = "disputed";
        await fine.save({session: params.session});
        return vehicleFineToDTO(fine);
    }

    /**
     * The authority annulled the fine. What was charged to the booking for it is taken
     * back: credited on its invoice and refunded if the customer paid. Not once the
     * company paid the authority.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async annul(params: ActionParams<{_id: string}>): Promise<VehicleFineDto> {
        const {session, languageCode} = params;
        const fine = await loadFine(params, ["received", "driver_identified", "disputed", "charged", "transferred"]);
        if (fine.paidAt) throw apiValidationException("rental_fine_already_paid", "", null, languageCode);
        // Charged before the lines were kept: there is nothing exact to take back.
        if (fine.chargedAmount && !fine.charges.length) throw apiValidationException("rental_fine_invalid_status", "", null, languageCode);
        if (fine.charges.length) {
            const reservation = await loadBooking(fine, params);
            if (!reservation) throw apiValidationException("rental_fine_no_booking", "", null, languageCode);
            const ctx = {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId};
            await removeReservationCharges(reservation, fine.charges, {by: new ObjectId(params.actionUserCtx.userId), reason: fine.reference}, ctx);
            fine.charges = [];
            fine.chargedAmount = undefined;
        }
        fine.status = "cancelled";
        await fine.save({session: params.session});
        return vehicleFineToDTO(fine);
    }
}
