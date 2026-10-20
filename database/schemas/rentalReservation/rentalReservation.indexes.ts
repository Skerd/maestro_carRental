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
    schema.index({stripePaymentIntentId: 1}, {partialFilterExpression: {stripePaymentIntentId: {$exists: true}}});
}
