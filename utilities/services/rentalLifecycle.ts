import type {ClientSession} from "mongoose";
import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {roundMoney} from "@coreModule/utilities/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import type {SettledPaymentIntent} from "@financeModule/utilities/services/payment/paymentSourceHandlers";
import type {RentalReservationStatus} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {busyVehicleIds, lockVehicle} from "./rentalAvailability";
import {currencyCodeOf, paymentStatusFor, refundRentalPayments} from "./rentalPayments";
import {notifyRentalCustomer, notifyRentalStaff} from "./rentalNotify";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

const HOUR = 3600 * 1000;

type Ctx = {session: ClientSession; logger: serverLogger; languageCode: string; auditUserId?: string | ObjectId};

export function assertStatus(reservation: IRentalReservation, allowed: RentalReservationStatus[], languageCode: string): void {
    if (!allowed.includes(reservation.status)) {
        throw apiValidationException("rental_reservation_invalid_status", "", null, languageCode);
    }
}

/** Last moment a cancellation is free, under the policy the customer booked with. */
export function freeCancellationUntil(reservation: Pick<IRentalReservation, "pickupAt" | "policy">): Date {
    return new Date(reservation.pickupAt.getTime() - reservation.policy.freeCancellationHours * HOUR);
}

/** The fee a cancellation at `now` costs: nothing before the free-cancellation deadline. */
export function cancellationFeeFor(reservation: Pick<IRentalReservation, "pickupAt" | "policy" | "pricing">, now: Date): number {
    if (now < freeCancellationUntil(reservation)) return 0;
    return roundMoney((reservation.pricing.grandTotal * reservation.policy.cancellationFeePercent) / 100);
}

/** Cancels the gateway intent of an unpaid hold once the transaction has committed. */
async function cancelIntentAfterCommit(reservation: IRentalReservation, ctx: Ctx): Promise<void> {
    const intentId = reservation.stripePaymentIntentId;
    if (!intentId || reservation.paymentStatus === "paid") return;
    await runAfterCommit(ctx.session, async () => {
        await getPaymentAdapter("stripe")?.cancelPaymentIntent(intentId);
    });
}

/**
 * Cancels a held or confirmed reservation. What was paid comes back minus the fee
 * (when one applies); the payment status only changes once a refund is recorded.
 * Old guest links stop working.
 */
export async function cancelRentalReservation(
    reservation: IRentalReservation,
    input: {by: "customer" | "staff" | "system"; reason?: string; applyFee: boolean; now?: Date},
    ctx: Ctx,
): Promise<{fee: number; refunded: number}> {
    assertStatus(reservation, ["held", "confirmed"], ctx.languageCode);
    const now = input.now ?? new Date();
    const fee = input.applyFee ? cancellationFeeFor(reservation, now) : 0;

    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    reservation.cancelledBy = input.by;
    reservation.cancellationReason = input.reason;
    reservation.holdExpiresAt = undefined;
    reservation.manageTokenVersion += 1;
    reservation.timeline.push({event: "cancelled", at: now, note: [input.reason, fee > 0 ? `fee ${fee}` : undefined].filter(Boolean).join(" · ") || undefined});

    const refunded = await refundRentalPayments(reservation, roundMoney(reservation.amountPaid - fee), input.reason ?? "cancelled", ctx);
    await cancelIntentAfterCommit(reservation, ctx);
    await reservation.save({session: ctx.session});
    await notifyRentalCustomer("cancelled", reservation, ctx);
    if (input.by === "customer") {
        await notifyRentalStaff(NotificationEventCodes.RENTAL_RESERVATION_CANCELLED, reservation, ctx);
    }
    return {fee, refunded};
}

/**
 * Marks a held reservation whose hold ran out as expired, freeing the vehicle for
 * good. Returns false when it was confirmed or changed in the meantime.
 */
export async function expireRentalHold(reservation: IRentalReservation, ctx: Ctx, now = new Date()): Promise<boolean> {
    if (reservation.status !== "held" || !reservation.holdExpiresAt || reservation.holdExpiresAt > now) return false;
    reservation.status = "expired";
    reservation.timeline.push({event: "expired", at: now});
    await cancelIntentAfterCommit(reservation, ctx);
    await reservation.save({session: ctx.session});
    return true;
}

/**
 * Applies a succeeded online payment (from the webhook) to its reservation.
 *
 * - The amount must be what the reservation costs, or nothing changes (logged).
 * - A held (or already expired) booking is confirmed if its vehicle is still free;
 *   if the car was taken after the hold ran out, the booking is cancelled and the
 *   money refunded in full. A payment for a cancelled booking is refunded too.
 */
export async function settleRentalPayment(reservation: IRentalReservation, intent: SettledPaymentIntent, ctx: Ctx, now = new Date()): Promise<void> {
    const adapter = getPaymentAdapter("stripe");
    const currencyCode = await currencyCodeOf(reservation, ctx.session);
    if (!adapter || adapter.toMinorUnits(reservation.pricing.grandTotal, currencyCode) !== intent.amountMinor
        || (intent.currencyCode && intent.currencyCode.toLowerCase() !== currencyCode)) {
        ctx.logger.err(`Rental payment ${intent.id} does not match reservation ${reservation.number}; left for staff to review`);
        return;
    }
    if (reservation.paymentStatus === "paid") return;

    reservation.amountPaid = roundMoney(reservation.amountPaid + reservation.pricing.grandTotal);
    reservation.paymentStatus = paymentStatusFor(reservation, false);
    reservation.timeline.push({event: "payment_received", at: now});

    if (reservation.status === "held" || reservation.status === "expired") {
        const companyId = nestedEntityToRef(reservation.company);
        const vehicleId = nestedEntityToRef(reservation.vehicle);
        await lockVehicle(vehicleId, {companyId, session: ctx.session, languageCode: ctx.languageCode, requireActive: false});
        const busy = await busyVehicleIds({
            companyId,
            vehicleIds: [vehicleId],
            start: reservation.pickupAt,
            end: reservation.blockedUntil,
            now,
            excludeReservationId: reservation._id,
            session: ctx.session,
        });
        if (!busy.size) {
            reservation.status = "confirmed";
            reservation.holdExpiresAt = undefined;
            reservation.timeline.push({event: "confirmed", at: now});
            await reservation.save({session: ctx.session});
            await notifyRentalCustomer("confirmed", reservation, ctx);
            await notifyRentalStaff(NotificationEventCodes.RENTAL_RESERVATION_NEW, reservation, ctx);
            return;
        }
        reservation.status = "cancelled";
        reservation.cancelledAt = now;
        reservation.cancelledBy = "system";
        reservation.cancellationReason = "payment_after_expiry";
        reservation.holdExpiresAt = undefined;
        reservation.manageTokenVersion += 1;
        reservation.timeline.push({event: "cancelled", at: now, note: "payment_after_expiry"});
    }

    if (reservation.status === "cancelled") {
        await refundRentalPayments(reservation, reservation.amountPaid, "payment_after_cancellation", ctx);
        await notifyRentalCustomer("cancelled", reservation, ctx);
    }
    await reservation.save({session: ctx.session});
}

/** Records a failed online payment; the hold stays so the customer can retry until it runs out. */
export async function failRentalPayment(reservation: IRentalReservation, intent: SettledPaymentIntent, ctx: Ctx): Promise<void> {
    if (reservation.status !== "held") return;
    reservation.paymentStatus = "failed";
    reservation.timeline.push({event: "payment_failed", at: new Date(), note: intent.failureReason});
    await reservation.save({session: ctx.session});
}
