import type {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {DEFAULT_DECIMAL_PLACES, minorToNumber, roundToCurrency, toMinor, type MoneyInput} from "armonia/src/modules/core/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {paymentTransactionService} from "@financeModule/database/schemas/paymentTransaction/paymentTransaction.service";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import {PAYMENTS} from "@financeModule/environment";
import {CARD_PAYMENTS_AVAILABLE} from "armonia/src/modules/finance/helpers/cardPaymentAvailability";
import {
    recordManualCharge,
    refundSourceCharges,
    type PaymentSource,
} from "@financeModule/utilities/services/payment/sourcePayments";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
type Ctx = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    auditUserId?: string | ObjectId;
};

/** Money still owed on a reservation, at the currency's `decimals` (TD-B37). */
export function amountDue(
    reservation: Pick<IRentalReservation, "pricing" | "amountPaid">,
    decimals: number = DEFAULT_DECIMAL_PLACES,
): number {
    const due = toMinor(reservation.pricing.grandTotal, decimals) - toMinor(reservation.amountPaid, decimals);
    return due > 0n ? minorToNumber(due, decimals) : 0;
}

/** Payment status that follows from what was paid and refunded; never set it any other way. */
export function paymentStatusFor(
    reservation: Pick<IRentalReservation, "pricing" | "amountPaid">,
    refunded: boolean,
    decimals: number = DEFAULT_DECIMAL_PLACES,
): IRentalReservation["paymentStatus"] {
    if (refunded)
        return toMinor(reservation.amountPaid, decimals) > 0n ? "partially_refunded" : "refunded";
    return amountDue(reservation, decimals) <= 0 ? "paid" : "unpaid";
}

/** What was paid plus `amount` (negative: less it), stored at the currency's `decimals`. */
export function addToAmountPaid(
    reservation: Pick<IRentalReservation, "amountPaid">,
    amount: MoneyInput,
    decimals: number,
): void {
    reservation.amountPaid = decimal128FromMinor(toMinor(reservation.amountPaid, decimals) + toMinor(amount, decimals), decimals);
}

/** The booking currency: its lowercase code for the gateway and its `decimalPlaces` (TD-B30). */
export async function reservationCurrency(
    reservation: IRentalReservation,
    session: ClientSession,
): Promise<{code: string; decimalPlaces: number}> {
    const currency = await currencyService.findById(nestedEntityToRef(reservation.pricing.currency), {session: session}, undefined, "abbreviation decimalPlaces");
    return {
        code: (currency?.abbreviation ?? "eur").toLowerCase(),
        decimalPlaces: currency?.decimalPlaces ?? DEFAULT_DECIMAL_PLACES,
    };
}

/**
 * Card payments are "Coming soon" (D190): until the switch is on, every card step (paying online, a card hold, a
 * saved card) is refused with this, and the booking and its deposit are paid at the desk.
 */
export function assertCardPaymentsAvailable(languageCode: string): void {
    if (!CARD_PAYMENTS_AVAILABLE) throw apiValidationException("rental_card_payments_coming_soon", "", null, languageCode);
}

/** A customer can pay by card online: card payments are on and the gateway is set up. */
export function onlinePaymentAvailable(): boolean {
    return Boolean(PAYMENTS.STRIPE_ENABLED && getPaymentAdapter("stripe")?.isEnabled());
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
    assertCardPaymentsAvailable(ctx.languageCode);
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
    const currency = await reservationCurrency(reservation, ctx.session);
    const due = amountDue(reservation, currency.decimalPlaces);
    if (due <= 0)
        throw apiValidationException(
            "rental_nothing_to_pay",
            "",
            null,
            ctx.languageCode,
        );
    assertCardPaymentsAvailable(ctx.languageCode);
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
function rentalSource(
    reservation: IRentalReservation,
    currency: {code: string; decimalPlaces: number},
): PaymentSource {
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
    const currency = await reservationCurrency(reservation, ctx.session);
    const due = amountDue(reservation, currency.decimalPlaces);
    if (toMinor(amount, currency.decimalPlaces) > toMinor(due, currency.decimalPlaces)) {
        throw apiValidationException(
            "rental_payment_exceeds_due",
            "",
            null,
            ctx.languageCode,
            [String(due)],
        );
    }
    await recordManualCharge(
        rentalSource(reservation, currency),
        amount,
        note,
        ctx,
    );
    addToAmountPaid(reservation, amount, currency.decimalPlaces);
    reservation.paymentStatus = paymentStatusFor(reservation, false, currency.decimalPlaces);
    reservation.timeline.push({
        event: "payment_received",
        at: now,
        note: note ?? `manual ${roundToCurrency(amount, currency.decimalPlaces)}`,
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
    const currency = await reservationCurrency(reservation, ctx.session);
    const refunded = await refundSourceCharges(
        rentalSource(reservation, currency),
        {
            amount,
            paid: minorToNumber(toMinor(reservation.amountPaid, currency.decimalPlaces), currency.decimalPlaces),
            reason,
            idempotencyPrefix: `rental-refund-${reservation._id.toString()}`,
        },
        ctx,
    );
    if (refunded > 0) {
        addToAmountPaid(reservation, -refunded, currency.decimalPlaces);
        reservation.paymentStatus = paymentStatusFor(reservation, true, currency.decimalPlaces);
        reservation.timeline.push({
            event: "refunded",
            at: new Date(),
            note: `${refunded}`,
        });
    }
    return refunded;
}
