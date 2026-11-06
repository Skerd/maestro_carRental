import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {roundToCurrency, toMinor} from "armonia/src/modules/core/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {paymentTransactionService} from "@financeModule/database/schemas/paymentTransaction/paymentTransaction.service";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import type {PaymentProviderAdapter} from "@financeModule/utilities/services/payment/paymentProvider.types";
import {RENTAL_CARD_HOLD_MAX_DAYS, type RentalDepositMethod} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {addToAmountPaid, amountDue, paymentStatusFor, recordCounterPayment, reservationCurrency} from "./rentalPayments";
import {storedAmount} from "./rentalQuote";

type Ctx = {session: ClientSession; logger: serverLogger; languageCode: string; auditUserId?: string | ObjectId};

/** The card form the customer completes at the counter: a payment (card hold) or a setup (saved card). */
export type DepositCardForm = {kind: "payment" | "setup"; clientSecret: string};

/** Card holds expire after about a week, so longer rentals save the card instead (decision D-2). */
export function cardDepositMethod(reservation: Pick<IRentalReservation, "pricing">): Exclude<RentalDepositMethod, "cash"> {
    return reservation.pricing.rentalDays <= RENTAL_CARD_HOLD_MAX_DAYS ? "card_hold" : "saved_card";
}

function stripeOrFail(languageCode: string): PaymentProviderAdapter {
    const adapter = getPaymentAdapter("stripe");
    if (!adapter?.isEnabled()) throw apiValidationException("rental_online_payment_unavailable", "", null, languageCode);
    return adapter;
}

/** Money taken from the customer's card, recorded on the ledger and counted as paid. */
async function recordCardCharge(reservation: IRentalReservation, intentId: string, amount: number, decimals: number, ctx: Ctx): Promise<void> {
    const companyId = nestedEntityToRef(reservation.company)!;
    await paymentTransactionService.createPending(
        {
            sourceType: "rentalReservation",
            sourceId: reservation._id,
            gateway: "stripe",
            amount,
            currency: nestedEntityToRef(reservation.pricing.currency)!,
            gatewayTransactionId: intentId,
            metadata: {purpose: "deposit"},
            company: companyId,
        },
        ctx,
    );
    await paymentTransactionService.markSucceeded(intentId, undefined, ctx);
    addToAmountPaid(reservation, amount, decimals);
    reservation.paymentStatus = paymentStatusFor(reservation, false, decimals);
}

/**
 * Takes the deposit. Cash is held at once. A card starts a hold or a card setup
 * the customer confirms on the counter device; it is held once the gateway says so
 * (webhook, or `refreshDeposit`).
 */
export async function takeDeposit(
    reservation: IRentalReservation,
    input: {choice: "card" | "cash"; amount?: number; now?: Date},
    ctx: Ctx,
): Promise<DepositCardForm | undefined> {
    if (reservation.deposit && reservation.deposit.status !== "failed") {
        throw apiValidationException("rental_deposit_already_taken", "", null, ctx.languageCode);
    }
    const currency = await reservationCurrency(reservation, ctx.session);
    const amount = roundToCurrency(input.amount ?? reservation.pricing.depositAmount, currency.decimalPlaces);
    if (amount <= 0) throw apiValidationException("rental_deposit_amount_required", "", null, ctx.languageCode);
    const now = input.now ?? new Date();
    const stored = {amount: storedAmount(amount, currency.decimalPlaces), capturedAmount: storedAmount(0, currency.decimalPlaces)};

    if (input.choice === "cash") {
        reservation.deposit = {method: "cash", status: "held", ...stored, heldAt: now};
        reservation.timeline.push({event: "deposit_held", at: now, note: `cash ${amount}`});
        await reservation.save({session: ctx.session});
        return undefined;
    }

    const adapter = stripeOrFail(ctx.languageCode);
    const method = cardDepositMethod(reservation);
    const attempt = reservation.timeline.filter((entry) => entry.event === "deposit_held").length + 1;
    const metadata = {sourceType: "rentalReservation", purpose: "deposit", reservationId: reservation._id.toString(), companyId: String(nestedEntityToRef(reservation.company))};
    let form: DepositCardForm;
    if (method === "card_hold") {
        const intent = await adapter.createPaymentIntent({
            amount,
            currencyCode: currency.code,
            decimalPlaces: currency.decimalPlaces,
            metadata,
            captureMethod: "manual",
            idempotencyKey: `rental-deposit-${reservation._id.toString()}-${attempt}`,
        });
        reservation.deposit = {method, status: "pending", ...stored, intentId: intent.id};
        form = {kind: "payment", clientSecret: intent.clientSecret ?? ""};
    } else {
        const {contact} = reservation;
        const setup = await adapter.createSetupIntent({
            email: contact.email,
            name: `${contact.firstName} ${contact.lastName}`.trim(),
            metadata,
            idempotencyKey: `rental-card-${reservation._id.toString()}-${attempt}`,
        });
        reservation.deposit = {method, status: "pending", ...stored, setupIntentId: setup.id, stripeCustomerId: setup.customerId};
        form = {kind: "setup", clientSecret: setup.clientSecret ?? ""};
    }
    await reservation.save({session: ctx.session});
    return form;
}

/** The gateway confirmed the hold or the saved card (webhook or refresh). Idempotent. */
export async function markDepositHeld(reservation: IRentalReservation, card: {paymentMethodId?: string; customerId?: string}, ctx: Ctx, now = new Date()): Promise<void> {
    const deposit = reservation.deposit;
    if (!deposit || deposit.status !== "pending") return;
    deposit.status = "held";
    deposit.heldAt = now;
    if (card.paymentMethodId) deposit.paymentMethodId = card.paymentMethodId;
    if (card.customerId) deposit.stripeCustomerId = card.customerId;
    reservation.timeline.push({event: "deposit_held", at: now, note: deposit.method});
    await reservation.save({session: ctx.session});
}

/** Asks the gateway whether the customer has confirmed the card yet, for when no webhook arrives. */
export async function refreshDeposit(reservation: IRentalReservation, ctx: Ctx): Promise<void> {
    const deposit = reservation.deposit;
    if (!deposit || deposit.status !== "pending") return;
    const adapter = stripeOrFail(ctx.languageCode);
    if (deposit.intentId) {
        const intent = await adapter.retrievePaymentIntent(deposit.intentId);
        if (intent.status === "requires_capture") await markDepositHeld(reservation, {}, ctx);
        else if (intent.status === "canceled") {
            deposit.status = "failed";
            await reservation.save({session: ctx.session});
        }
    } else if (deposit.setupIntentId) {
        const setup = await adapter.retrieveSetupIntent(deposit.setupIntentId);
        if (setup.status === "succeeded") await markDepositHeld(reservation, {paymentMethodId: setup.paymentMethodId, customerId: setup.customerId}, ctx);
    }
}

/**
 * Keeps part of the deposit for what is still owed and releases the rest: a card
 * hold is captured for the kept amount (the rest is released), a saved card is
 * charged that amount and stays saved, cash is booked as a counter payment and the
 * rest handed back.
 */
export async function settleDeposit(reservation: IRentalReservation, keepAmount: number, input: {by?: ObjectId; now?: Date}, ctx: Ctx): Promise<void> {
    const deposit = reservation.deposit;
    if (!deposit || deposit.status !== "held") throw apiValidationException("rental_deposit_not_held", "", null, ctx.languageCode);
    const currency = await reservationCurrency(reservation, ctx.session);
    const decimals = currency.decimalPlaces;
    const keep = roundToCurrency(keepAmount, decimals);
    if (toMinor(keep, decimals) > toMinor(deposit.amount, decimals)) {
        throw apiValidationException("rental_deposit_keep_too_high", "", null, ctx.languageCode, [deposit.amount.toString()]);
    }
    const due = amountDue(reservation, decimals);
    if (toMinor(keep, decimals) > toMinor(due, decimals)) {
        throw apiValidationException("rental_payment_exceeds_due", "", null, ctx.languageCode, [String(due)]);
    }
    const now = input.now ?? new Date();

    if (deposit.method === "cash") {
        if (keep > 0) await recordCounterPayment(reservation, keep, "deposit kept", ctx, now);
    } else if (deposit.method === "card_hold") {
        const adapter = stripeOrFail(ctx.languageCode);
        if (keep > 0) {
            await adapter.capturePaymentIntent(deposit.intentId!, keep, currency.code, decimals);
            await recordCardCharge(reservation, deposit.intentId!, keep, decimals, ctx);
        } else {
            await adapter.cancelPaymentIntent(deposit.intentId!);
        }
    } else if (keep > 0) {
        await chargeSavedCard(reservation, keep, ctx);
    }

    deposit.capturedAmount = storedAmount(keep, decimals);
    deposit.status = keep > 0 ? "captured" : "released";
    deposit.settledAt = now;
    reservation.timeline.push({event: keep > 0 ? "deposit_captured" : "deposit_released", at: now, by: input.by, note: keep > 0 ? `${keep}` : undefined});
    await reservation.save({session: ctx.session});
}

/**
 * Charges the card the customer saved, without them present (a fine, damage found
 * later). Returns false when no card is saved; the amount then stays owed.
 */
export async function chargeSavedCard(reservation: IRentalReservation, amount: number, ctx: Ctx): Promise<boolean> {
    const deposit = reservation.deposit;
    if (!deposit?.paymentMethodId || !deposit.stripeCustomerId) return false;
    const adapter = stripeOrFail(ctx.languageCode);
    const charges = await paymentTransactionService.count({sourceId: reservation._id, type: "charge"}, {session: ctx.session});
    const currency = await reservationCurrency(reservation, ctx.session);
    const intent = await adapter.createPaymentIntent({
        amount,
        currencyCode: currency.code,
        decimalPlaces: currency.decimalPlaces,
        metadata: {sourceType: "rentalReservation", purpose: "saved_card", reservationId: reservation._id.toString()},
        offSession: {customerId: deposit.stripeCustomerId, paymentMethodId: deposit.paymentMethodId},
        idempotencyKey: `rental-card-charge-${reservation._id.toString()}-${charges + 1}`,
    });
    if (intent.status !== "succeeded") throw apiValidationException("rental_card_charge_failed", "", null, ctx.languageCode);
    await recordCardCharge(reservation, intent.id, amount, currency.decimalPlaces, ctx);
    return true;
}
