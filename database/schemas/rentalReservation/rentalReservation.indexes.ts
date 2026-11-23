import {Schema} from "mongoose";

export function applyRentalReservationIndexes(schema: Schema): void {
    // Overlap lookups: the reservations of one vehicle around a window (status is filtered in the query).
    schema.index({company: 1, vehicle: 1, pickupAt: 1, blockedUntil: 1});
    // A retried request (same key) returns the reservation it already made.
    schema.index({company: 1, idempotencyKey: 1}, {unique: true});
    schema.index({company: 1, number: 1}, {unique: true});
    schema.index({status: 1, holdExpiresAt: 1});
    schema.index({company: 1, status: 1, pickupAt: 1});
    schema.index({company: 1, customer: 1, pickupAt: -1});
    // A verified account claims the guest bookings made with its email, at every company at once (P23.9).
    schema.index({"contact.email": 1});
    // Uses of a promo code per customer email (the per-customer limit).
    schema.index({company: 1, "promoCode.promo": 1, "contact.email": 1}, {partialFilterExpression: {"promoCode.promo": {$exists: true}}});
    // Webhooks find the booking of a card hold or a saved card.
    schema.index({"deposit.intentId": 1}, {partialFilterExpression: {"deposit.intentId": {$exists: true}}});
    schema.index({"deposit.setupIntentId": 1}, {partialFilterExpression: {"deposit.setupIntentId": {$exists: true}}});
    schema.index({stripePaymentIntentId: 1}, {partialFilterExpression: {stripePaymentIntentId: {$exists: true}}});
}
