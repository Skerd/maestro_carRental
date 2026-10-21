import {Schema} from "mongoose";

export function applyVehicleDocumentIndexes(schema: Schema): void {
    // A vehicle's documents by type, newest expiry first.
    schema.index({company: 1, vehicle: 1, type: 1, expiresAt: -1}, {partialFilterExpression: {deletedAt: null}});
    // The fleet reminder job: active documents by expiry date, across companies.
    schema.index({status: 1, expiresAt: 1}, {partialFilterExpression: {deletedAt: null}});
}
