import {Schema} from "mongoose";

export function applyVehicleDamageIndexes(schema: Schema): void {
    // A vehicle's damages, open ones and newest first.
    schema.index({company: 1, vehicle: 1, status: 1, reportedAt: -1}, {partialFilterExpression: {deletedAt: null}});
    // Damages found during one booking.
    schema.index({company: 1, reservation: 1}, {partialFilterExpression: {reservation: {$exists: true}, deletedAt: null}});
}
