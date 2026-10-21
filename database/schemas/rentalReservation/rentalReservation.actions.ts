import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import type {UserContext} from "@coreModule/utilities/types/types";
import {roundMoney} from "@coreModule/utilities/helpers/money";
import {localToUtc} from "@coreModule/utilities/time/timeWindows";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {RentalReservation as RentalReservationDto} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.dto";
import {
    cancelRentalReservationFormSchema,
    extendRentalReservationFormSchema,
    handoverRentalReservationFormSchema,
    reassignRentalVehicleFormSchema,
    recordRentalPaymentFormSchema,
    returnRentalReservationFormSchema,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.form.validators";
import type {
    CancelRentalReservationFormType,
    ExtendRentalReservationFormType,
    HandoverRentalReservationFormType,
    ReassignRentalVehicleFormType,
    RecordRentalPaymentFormType,
    ReturnRentalReservationFormType,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.forms";
import Vehicle from "../vehicle/vehicle";
import VehicleCategory from "../vehicleCategory/vehicleCategory";
import RentalLocation from "../rentalLocation/rentalLocation";
import RentalReservation, {type IRentalReservation} from "./rentalReservation";
import {carRentalConfigService} from "../carRentalConfig/carRentalConfig.service";
import {rentalReservationToDTO} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {busyUntil, busyVehicleIds, lockVehicle} from "@carRentalModule/utilities/services/rentalAvailability";
import {computeRentalQuote, totalsFor} from "@carRentalModule/utilities/services/rentalQuote";
import {
    assertStatus,
    cancelRentalReservation,
    handOverRentalReservation,
    markRentalNoShow,
    returnRentalReservation,
} from "@carRentalModule/utilities/services/rentalLifecycle";
import {paymentStatusFor, recordCounterPayment} from "@carRentalModule/utilities/services/rentalPayments";
import {isLocationOpenAt} from "@carRentalModule/utilities/services/rentalTrip";

const MINUTE = 60 * 1000;

type ActionParams<F> = TransactionRequiredParams & F;

/**
 * Actions get no permission check from the CRUD router: each one requires write
 * access to the field it changes (`status` for lifecycle moves, `amountPaid` for
 * payments), which role packs grant to agents and managers.
 */
function assertWrite(field: "status" | "amountPaid", actionUserCtx: UserContext, languageCode: string): void {
    const writeFields = SchemaGuard.sanitizeFields(
        RentalReservation,
        getModelCollectedData("rentalreservations").writeFields!,
        "write",
        actionUserCtx,
        languageCode,
    );
    if (!writeFields[field]) {
        throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
    }
}

async function loadReservation(params: TransactionRequiredParams & {_id: string}): Promise<IRentalReservation> {
    const {_id, company, session, languageCode} = params;
    const reservation = ObjectId.isValid(_id)
        ? await RentalReservation.findOne({_id: new ObjectId(_id), company: company._id, deletedAt: null}).session(session)
        : null;
    if (!reservation) throw apiValidationException("rental_reservation_not_found", "", null, languageCode);
    return reservation;
}

async function toDto(reservation: IRentalReservation, params: TransactionRequiredParams): Promise<RentalReservationDto> {
    const {session, actionUserCtx, languageCode} = params;
    const readFields = SchemaGuard.sanitizeFields(
        RentalReservation,
        getModelCollectedData("rentalreservations").readFields!,
        "read",
        actionUserCtx,
        languageCode,
    );
    const populate = SchemaGuard.generatePopulate(readFields, RentalReservation.schema);
    const fresh = await RentalReservation.findById(reservation._id).populate(populate.populate).session(session);
    return rentalReservationToDTO(fresh ?? reservation);
}

function ctxOf(params: TransactionRequiredParams) {
    return {session: params.session, logger: params.logger, languageCode: params.languageCode, auditUserId: params.actionUserCtx.userId};
}

export class RentalReservationActions {
    /** Money taken at the counter (cash or card terminal). */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: recordRentalPaymentFormSchema})
    async recordPayment(params: ActionParams<RecordRentalPaymentFormType>): Promise<RentalReservationDto> {
        assertWrite("amountPaid", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["confirmed", "in_progress", "completed"], params.languageCode);
        await recordCounterPayment(reservation, params.amount, params.note, ctxOf(params));
        await reservation.save({session: params.session});
        return toDto(reservation, params);
    }

    /** The customer drives off: odometer and fuel are recorded and the car is on the road. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: handoverRentalReservationFormSchema})
    async handover(params: ActionParams<HandoverRentalReservationFormType>): Promise<RentalReservationDto> {
        assertWrite("status", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        const {odometerKm, fuelLevel, notes} = params;
        await handOverRentalReservation(reservation, {odometerKm, fuelLevel, notes, by: new ObjectId(params.actionUserCtx.userId)}, ctxOf(params));
        return toDto(reservation, params);
    }

    /** The car is back. Extra charges (fuel, km, damage) are added to what the customer owes. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: returnRentalReservationFormSchema})
    async returnVehicle(params: ActionParams<ReturnRentalReservationFormType>): Promise<RentalReservationDto> {
        assertWrite("status", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        const {odometerKm, fuelLevel, notes, damageNoted, extraCharges} = params;
        await returnRentalReservation(
            reservation,
            {odometerKm, fuelLevel, notes, damageNoted, extraCharges, by: new ObjectId(params.actionUserCtx.userId)},
            ctxOf(params),
        );
        return toDto(reservation, params);
    }

    /** Staff cancellation. The policy fee applies only when asked; any remaining payment is refunded. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: cancelRentalReservationFormSchema})
    async cancel(params: ActionParams<CancelRentalReservationFormType>): Promise<RentalReservationDto> {
        assertWrite("status", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        await cancelRentalReservation(reservation, {by: "staff", reason: params.reason, applyFee: params.applyCancellationFee ?? false}, ctxOf(params));
        return toDto(reservation, params);
    }

    /** The customer never came. Allowed once the pickup time plus the grace period has passed. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async noShow(params: ActionParams<{_id: string}>): Promise<RentalReservationDto> {
        assertWrite("status", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["confirmed"], params.languageCode);
        const config = await carRentalConfigService.getOrCreateForCompany(params.company._id, ctxOf(params));
        const now = new Date();
        if (now.getTime() < reservation.pickupAt.getTime() + config.lateGraceMinutes * MINUTE) {
            throw apiValidationException("rental_no_show_too_early", "", null, params.languageCode);
        }
        await markRentalNoShow(reservation, {by: new ObjectId(params.actionUserCtx.userId), now}, ctxOf(params));
        return toDto(reservation, params);
    }

    /** Moves the booking to another car of the same category that is free for its whole window. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: reassignRentalVehicleFormSchema})
    async reassignVehicle(params: ActionParams<ReassignRentalVehicleFormType>): Promise<RentalReservationDto> {
        assertWrite("status", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["held", "confirmed"], params.languageCode);
        const companyId = params.company._id;
        const target = await Vehicle.findOne({_id: new ObjectId(params.vehicle), company: companyId, deletedAt: null}).session(params.session);
        if (!target) throw apiValidationException("vehicle_not_found", "", null, params.languageCode);
        if (String(target.category) !== String(reservation.category)) {
            throw apiValidationException("rental_vehicle_wrong_category", "", null, params.languageCode);
        }
        await lockVehicle(target._id, {companyId, session: params.session, languageCode: params.languageCode});
        const busy = await busyVehicleIds({
            companyId,
            vehicleIds: [target._id],
            start: reservation.pickupAt,
            end: reservation.blockedUntil,
            now: new Date(),
            excludeReservationId: reservation._id,
            session: params.session,
        });
        if (busy.size) throw apiValidationException("vehicle_unavailable", "", null, params.languageCode);

        reservation.vehicle = target._id;
        reservation.timeline.push({event: "vehicle_reassigned", at: new Date(), by: new ObjectId(params.actionUserCtx.userId), note: target.plate});
        await reservation.save({session: params.session});
        return toDto(reservation, params);
    }

    /**
     * Keeps the car longer. The extra days are charged at today's prices: the
     * difference between today's price for the longer and the original trip.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: extendRentalReservationFormSchema})
    async extend(params: ActionParams<ExtendRentalReservationFormType>): Promise<RentalReservationDto> {
        assertWrite("status", params.actionUserCtx, params.languageCode);
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["confirmed", "in_progress"], params.languageCode);
        const companyId = params.company._id;
        const ctx = ctxOf(params);

        const [config, returnLocation, category] = await Promise.all([
            carRentalConfigService.getOrCreateForCompany(companyId, ctx),
            RentalLocation.findOne({_id: reservation.returnLocation, company: companyId}).session(params.session),
            VehicleCategory.findOne({_id: reservation.category, company: companyId}).session(params.session),
        ]);
        if (!returnLocation || !category) throw apiValidationException("rental_reservation_not_found", "", null, params.languageCode);

        const newReturnAt = localToUtc(params.returnDate, params.returnTime, returnLocation.timezone);
        if (!newReturnAt) throw apiValidationException("rental_invalid_return_time", "", null, params.languageCode);
        if (newReturnAt <= reservation.returnAt) throw apiValidationException("rental_return_before_pickup", "", null, params.languageCode);
        if (!isLocationOpenAt(returnLocation, newReturnAt)) {
            throw apiValidationException("rental_location_closed_at_return", "", null, params.languageCode, [returnLocation.name]);
        }

        const newBlockedUntil = busyUntil(newReturnAt, config.turnaroundBufferMinutes);
        const vehicleId = new ObjectId(String(reservation.vehicle));
        await lockVehicle(vehicleId, {companyId, session: params.session, languageCode: params.languageCode, requireActive: false});
        const busy = await busyVehicleIds({
            companyId,
            vehicleIds: [vehicleId],
            start: reservation.pickupAt,
            end: newBlockedUntil,
            now: new Date(),
            excludeReservationId: reservation._id,
            session: params.session,
        });
        if (busy.size) throw apiValidationException("vehicle_unavailable", "", null, params.languageCode);

        const quoteFor = (returnAt: Date) => computeRentalQuote({
            category,
            extras: reservation.extras.map(({name, pricing, unitPrice, quantity}) => ({name, pricing, price: unitPrice, quantity})),
            pickupAt: reservation.pickupAt,
            returnAt,
            timeZone: reservation.snapshot.timezone,
            settings: {vatRate: reservation.pricing.vatRate, pricesIncludeVat: reservation.pricing.pricesIncludeVat, lateGraceMinutes: config.lateGraceMinutes},
        });
        const longer = quoteFor(newReturnAt);
        const original = quoteFor(reservation.returnAt);
        const extension = roundMoney(Math.max(0, longer.subtotal - original.subtotal));
        if (extension > 0) {
            reservation.pricing.lines.push({label: category.name, kind: "extension", quantity: 1, unitPrice: extension, total: extension});
        }
        reservation.pricing.rentalDays = longer.rentalDays;
        Object.assign(reservation.pricing, totalsFor(reservation.pricing.lines, reservation.pricing.vatRate, reservation.pricing.pricesIncludeVat));
        reservation.paymentStatus = paymentStatusFor(reservation, false);
        reservation.returnAt = newReturnAt;
        reservation.blockedUntil = newBlockedUntil;
        reservation.timeline.push({event: "extended", at: new Date(), by: new ObjectId(params.actionUserCtx.userId), note: newReturnAt.toISOString()});
        await reservation.save({session: params.session});
        return toDto(reservation, params);
    }
}
