import type {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {DEFAULT_DECIMAL_PLACES, addMoney, minorToNumber, roundToCurrency, subtractMoney, toMinor} from "armonia/src/modules/core/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import Currency from "@coreModule/database/schemas/currency/currency";
import {paymentTransactionService} from "@financeModule/database/schemas/paymentTransaction/paymentTransaction.service";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import {
    recordManualCharge,
    refundSourceCharges,
    type PaymentSource,
} from "@financeModule/utilities/services/payment/sourcePayments";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

type Ctx = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    auditUserId?: string | ObjectId;
};

/** Money still owed on a reservation. */
export function amountDue(
    reservation: Pick<IRentalReservation, "pricing" | "amountPaid">,
): number {
    return Math.max(0, subtractMoney(reservation.pricing.grandTotal, reservation.amountPaid));
}

/** Payment status that follows from what was paid and refunded; never set it any other way. */
export function paymentStatusFor(
    reservation: Pick<IRentalReservation, "pricing" | "amountPaid">,
    refunded: boolean,
): IRentalReservation["paymentStatus"] {
    if (refunded)
        return reservation.amountPaid > 0 ? "partially_refunded" : "refunded";
    return amountDue(reservation) <= 0 ? "paid" : "unpaid";
}

/** The booking currency: its lowercase code for the gateway and its `decimalPlaces` (TD-B30). */
export async function reservationCurrency(
    reservation: IRentalReservation,
    session: ClientSession,
): Promise<{code: string; decimalPlaces: number}> {
    const currency = await Currency.findById(
        nestedEntityToRef(reservation.pricing.currency),
    )
        .select("abbreviation decimalPlaces")
        .session(session);
    return {
        code: (currency?.abbreviation ?? "eur").toLowerCase(),
        decimalPlaces: currency?.decimalPlaces ?? DEFAULT_DECIMAL_PLACES,
    };
}

/**
 * Starts the online payment for a held reservation: a gateway intent keyed on
 * the reservation (so a replayed request reuses it) and a pending ledger row the
 * webhook settles. Returns the client secret the public site confirms with.
 */
export async function startOnlinePayment(
    reservation: IRentalReservation,
    ctx: Ctx,
): Promise<{clientSecret: string}> {
    const adapter = getPaymentAdapter("stripe");
    if (!adapter?.isEnabled()) {
        throw apiValidationException(
            "rental_online_payment_unavailable",
            "",
            null,
            ctx.languageCode,
        );
    }
    const companyId = nestedEntityToRef(reservation.company);
    const currency = await reservationCurrency(reservation, ctx.session);
    const grandTotal = minorToNumber(toMinor(reservation.pricing.grandTotal, currency.decimalPlaces), currency.decimalPlaces);
    const intent = await adapter.createPaymentIntent({
        amount: grandTotal,
        currencyCode: currency.code,
        decimalPlaces: currency.decimalPlaces,
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
            amount: grandTotal,
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

/**
 * Charges whatever is still owed, after an extension or from the manage page.
 * The intent id is kept beside the original one, so a late webhook for the first
 * payment still finds the booking.
 */
export async function startBalancePayment(
    reservation: IRentalReservation,
    ctx: Ctx,
): Promise<{clientSecret: string}> {
    const due = amountDue(reservation);
    if (due <= 0)
        throw apiValidationException(
            "rental_nothing_to_pay",
            "",
            null,
            ctx.languageCode,
        );
    const adapter = getPaymentAdapter("stripe");
    if (!adapter?.isEnabled()) {
        throw apiValidationException(
            "rental_online_payment_unavailable",
            "",
            null,
            ctx.languageCode,
        );
    }
    const companyId = nestedEntityToRef(reservation.company);
    const currency = await reservationCurrency(reservation, ctx.session);
    const intent = await adapter.createPaymentIntent({
        amount: due,
        currencyCode: currency.code,
        decimalPlaces: currency.decimalPlaces,
        metadata: {
            sourceType: "rentalReservation",
            reservationId: reservation._id.toString(),
            companyId: String(companyId),
        },
        idempotencyKey: `rental-bal-${reservation._id.toString()}-${reservation.amountPaid}`,
    });
    await paymentTransactionService.createPending(
        {
            sourceType: "rentalReservation",
            sourceId: reservation._id,
            gateway: "stripe",
            amount: due,
            currency: nestedEntityToRef(reservation.pricing.currency),
            gatewayTransactionId: intent.id,
            company: companyId,
        },
        ctx,
    );
    reservation.balanceIntentIds = [
        ...(reservation.balanceIntentIds ?? []),
        intent.id,
    ];
    await reservation.save({session: ctx.session});
    return {clientSecret: intent.clientSecret ?? ""};
}

/** The reservation as a ledger source, for the shared manual-charge and refund moves. */
async function rentalSource(
    reservation: IRentalReservation,
    session: ClientSession,
): Promise<PaymentSource> {
    const currency = await reservationCurrency(reservation, session);
    return {
        sourceType: "rentalReservation",
        sourceId: reservation._id,
        company: nestedEntityToRef(reservation.company),
        currency: nestedEntityToRef(reservation.pricing.currency),
        currencyCode: currency.code,
        decimalPlaces: currency.decimalPlaces,
    };
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
        throw apiValidationException(
            "rental_payment_exceeds_due",
            "",
            null,
            ctx.languageCode,
            [String(due)],
        );
    }
    await recordManualCharge(
        await rentalSource(reservation, ctx.session),
        amount,
        note,
        ctx,
    );
    reservation.amountPaid = addMoney(reservation.amountPaid, amount);
    reservation.paymentStatus = paymentStatusFor(reservation, false);
    reservation.timeline.push({
        event: "payment_received",
        at: now,
        note: note ?? `manual ${roundToCurrency(amount)}`,
    });
}

/**
 * Refunds up to `amount` of what was paid, newest charge first. Gateway charges go
 * back through the gateway; counter payments are recorded as manual refunds the
 * staff pay out. Returns the amount refunded.
 */
export async function refundRentalPayments(
    reservation: IRentalReservation,
    amount: number,
    reason: string,
    ctx: Ctx,
): Promise<number> {
    const refunded = await refundSourceCharges(
        await rentalSource(reservation, ctx.session),
        {
            amount,
            paid: reservation.amountPaid,
            reason,
            idempotencyPrefix: `rental-refund-${reservation._id.toString()}`,
        },
        ctx,
    );
    if (refunded > 0) {
        reservation.amountPaid = subtractMoney(reservation.amountPaid, refunded);
        reservation.paymentStatus = paymentStatusFor(reservation, true);
        reservation.timeline.push({
            event: "refunded",
            at: new Date(),
            note: `${refunded}`,
        });
    }
    return refunded;
}
