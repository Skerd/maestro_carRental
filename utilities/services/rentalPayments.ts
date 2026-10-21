import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {roundMoney} from "@coreModule/utilities/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import Currency from "@coreModule/database/schemas/currency/currency";
import PaymentTransaction from "@financeModule/database/schemas/paymentTransaction/paymentTransaction";
import {paymentTransactionService} from "@financeModule/database/schemas/paymentTransaction/paymentTransaction.service";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

type Ctx = {session: ClientSession; logger: serverLogger; languageCode: string; auditUserId?: string | ObjectId};

/** Money still owed on a reservation. */
export function amountDue(reservation: Pick<IRentalReservation, "pricing" | "amountPaid">): number {
    return roundMoney(Math.max(0, reservation.pricing.grandTotal - reservation.amountPaid));
}

/** Payment status that follows from what was paid and refunded; never set it any other way. */
export function paymentStatusFor(reservation: Pick<IRentalReservation, "pricing" | "amountPaid">, refunded: boolean): IRentalReservation["paymentStatus"] {
    if (refunded) return reservation.amountPaid > 0 ? "partially_refunded" : "refunded";
    return amountDue(reservation) <= 0 ? "paid" : "unpaid";
}

export async function currencyCodeOf(reservation: IRentalReservation, session: ClientSession): Promise<string> {
    const currency = await Currency.findById(nestedEntityToRef(reservation.pricing.currency)).select("abbreviation").session(session);
    return (currency?.abbreviation ?? "eur").toLowerCase();
}

/**
 * Starts the online payment for a held reservation: a gateway intent keyed on
 * the reservation (so a replayed request reuses it) and a pending ledger row the
 * webhook settles. Returns the client secret the public site confirms with.
 */
export async function startOnlinePayment(reservation: IRentalReservation, ctx: Ctx): Promise<{clientSecret: string}> {
    const adapter = getPaymentAdapter("stripe");
    if (!adapter?.isEnabled()) {
        throw apiValidationException("rental_online_payment_unavailable", "", null, ctx.languageCode);
    }
    const companyId = nestedEntityToRef(reservation.company);
    const intent = await adapter.createPaymentIntent({
        amount: reservation.pricing.grandTotal,
        currencyCode: await currencyCodeOf(reservation, ctx.session),
        metadata: {
            sourceType: "rentalReservation",
            reservationId: reservation._id.toString(),
            companyId: String(companyId),
        },
        idempotencyKey: `rental-pi-${reservation._id.toString()}`,
    });
    await paymentTransactionService.createPending(
        {
            sourceType: "rentalReservation",
            sourceId: reservation._id,
            gateway: "stripe",
            amount: reservation.pricing.grandTotal,
            currency: nestedEntityToRef(reservation.pricing.currency),
            gatewayTransactionId: intent.id,
            company: companyId,
        },
        ctx,
    );
    reservation.stripePaymentIntentId = intent.id;
    reservation.paymentStatus = "pending";
    await reservation.save({session: ctx.session});
    return {clientSecret: intent.clientSecret ?? ""};
}

/** Records money taken at the counter (cash, card terminal) as a manual ledger charge. */
export async function recordCounterPayment(
    reservation: IRentalReservation,
    amount: number,
    note: string | undefined,
    ctx: Ctx,
    now = new Date(),
): Promise<void> {
    const due = amountDue(reservation);
    if (amount > due + 0.005) {
        throw apiValidationException("rental_payment_exceeds_due", "", null, ctx.languageCode, [String(due)]);
    }
    const charge = await paymentTransactionService.createPending(
        {
            sourceType: "rentalReservation",
            sourceId: reservation._id,
            gateway: "manual",
            amount: roundMoney(amount),
            currency: nestedEntityToRef(reservation.pricing.currency),
            metadata: note ? {note} : undefined,
            company: nestedEntityToRef(reservation.company),
        },
        ctx,
    );
    await PaymentTransaction.updateOne({_id: charge._id}, {$set: {status: "succeeded"}}, {session: ctx.session});
    reservation.amountPaid = roundMoney(reservation.amountPaid + amount);
    reservation.paymentStatus = paymentStatusFor(reservation, false);
    reservation.timeline.push({event: "payment_received", at: now, note: note ?? `manual ${roundMoney(amount)}`});
}

/**
 * Refunds up to `amount` of what was paid, newest charge first. Gateway charges go
 * back through the gateway; counter payments are recorded as manual refunds the
 * staff pay out. Returns the amount refunded.
 */
export async function refundRentalPayments(reservation: IRentalReservation, amount: number, reason: string, ctx: Ctx): Promise<number> {
    let left = roundMoney(Math.min(amount, reservation.amountPaid));
    if (left <= 0) return 0;

    const charges = await PaymentTransaction.find({
        sourceType: "rentalReservation",
        sourceId: reservation._id,
        type: "charge",
        status: {$in: ["succeeded", "partially_refunded"]},
    }).sort({createdAt: -1}).session(ctx.session);

    let refunded = 0;
    for (const charge of charges) {
        if (left <= 0) break;
        const refundable = roundMoney(charge.amount - (charge.refundedAmount ?? 0));
        const part = roundMoney(Math.min(refundable, left));
        if (part <= 0) continue;

        let gatewayRefundId: string | undefined;
        if (charge.gateway !== "manual" && charge.gatewayTransactionId) {
            const adapter = getPaymentAdapter(charge.gateway);
            if (!adapter?.isEnabled()) {
                throw apiValidationException("payment_gateway_not_configured", "", null, ctx.languageCode);
            }
            const result = await adapter.createRefund({
                gatewayTransactionId: charge.gatewayTransactionId,
                amount: part < refundable ? part : undefined,
                currencyCode: await currencyCodeOf(reservation, ctx.session),
                reason,
                // Keyed on what was refunded before: a replayed transaction reuses the key
                idempotencyKey: `rental-refund-${reservation._id.toString()}-${charge._id.toString()}-${charge.refundedAmount ?? 0}`,
            });
            gatewayRefundId = result.id;
        }

        await paymentTransactionService.recordRefund(
            {
                sourceType: "rentalReservation",
                sourceId: reservation._id,
                chargeTransactionId: new ObjectId(charge._id.toString()),
                gateway: charge.gateway,
                amount: part,
                currency: nestedEntityToRef(reservation.pricing.currency),
                gatewayTransactionId: gatewayRefundId,
                metadata: {reason},
                company: nestedEntityToRef(reservation.company),
            },
            ctx,
        );
        left = roundMoney(left - part);
        refunded = roundMoney(refunded + part);
    }

    if (refunded > 0) {
        reservation.amountPaid = roundMoney(reservation.amountPaid - refunded);
        reservation.paymentStatus = paymentStatusFor(reservation, true);
        reservation.timeline.push({event: "refunded", at: new Date(), note: `${refunded}`});
    }
    return refunded;
}
