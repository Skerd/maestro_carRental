import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {type IRentalPromoCode} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import {type IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import type {QuoteDiscount} from "./rentalQuote";
import {rentalPricingLabel} from "./rentalPricingLabels";

import {rentalPromoCodeService} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode.service";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
/** Promo dates are calendar days, stored as UTC midnight. */
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** The company's active promo code for what the customer typed (case does not matter). */
export async function findPromoCode(companyId: ObjectId, code: string, ctx: {languageCode: string; session?: ClientSession}): Promise<IRentalPromoCode> {
    const promo = await rentalPromoCodeService.findOne({company: companyId, code: code.trim().toUpperCase(), isActive: true, deletedAt: null}, {session: ctx.session ?? undefined});
    if (!promo) throw apiValidationException("rental_promo_code_invalid", "", null, ctx.languageCode);
    return promo;
}

/**
 * Checks a promo code against a trip: booked inside its booking window, picked up
 * inside its trip window, long enough, the right category, and not used up overall
 * or by this customer's email.
 */
export async function assertPromoApplies(
    promo: IRentalPromoCode,
    trip: {today: string; pickupDate: string; rentalDays: number; categoryId: ObjectId; email?: string},
    ctx: {languageCode: string; session?: ClientSession},
): Promise<void> {
    const outside = (day: string, from?: Date, until?: Date) => (from && day < dayOf(from)) || (until && day > dayOf(until));
    if (outside(trip.today, promo.bookableFrom, promo.bookableUntil)) {
        throw apiValidationException("rental_promo_code_invalid", "", null, ctx.languageCode);
    }
    if (outside(trip.pickupDate, promo.tripFrom, promo.tripUntil)
        || (promo.minRentalDays && trip.rentalDays < promo.minRentalDays)
        || (promo.category && String(promo.category) !== String(trip.categoryId))) {
        throw apiValidationException("rental_promo_code_not_applicable", "", null, ctx.languageCode);
    }
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
        throw apiValidationException("rental_promo_code_used_up", "", null, ctx.languageCode);
    }
    if (promo.usageLimitPerEmail && trip.email) {
        const used = await rentalReservationService.count({
            company: promo.company,
            "promoCode.promo": promo._id,
            "contact.email": trip.email.trim().toLowerCase(),
            status: {$nin: ["cancelled", "expired"]},
            deletedAt: null,
        }, {session: ctx.session ?? undefined});
        if (used >= promo.usageLimitPerEmail) throw apiValidationException("rental_promo_code_used_up", "", null, ctx.languageCode);
    }
}

export function promoDiscount(promo: IRentalPromoCode, languageCode: string): QuoteDiscount {
    return {label: rentalPricingLabel(languageCode, "promo", {code: promo.code}), type: promo.type, value: promo.value};
}

/**
 * Counts one use, inside the booking transaction. The conditional update means two
 * bookings racing for the last use cannot both get it.
 */
export async function consumePromoCode(promo: IRentalPromoCode, ctx: {languageCode: string; session: ClientSession}): Promise<void> {
    const result = await rentalPromoCodeService.updateOne({_id: promo._id, ...(promo.usageLimit ? {usageCount: {$lt: promo.usageLimit}} : {})}, {$inc: {usageCount: 1}}, {session: ctx.session});
    if (!result.modifiedCount) throw apiValidationException("rental_promo_code_used_up", "", null, ctx.languageCode);
}

/** Gives the use back when a booking with a promo code is cancelled or its hold expires. */
export async function releasePromoCode(reservation: IRentalReservation, session: ClientSession | null): Promise<void> {
    if (!reservation.promoCode?.promo) return;
    await rentalPromoCodeService.updateOne({_id: reservation.promoCode.promo, usageCount: {$gt: 0}}, {$inc: {usageCount: -1}}, {session: session});
}
