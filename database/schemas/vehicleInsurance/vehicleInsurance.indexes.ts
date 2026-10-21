import {Schema} from "mongoose";

export function applyVehicleInsuranceIndexes(schema: Schema): void {
    // A vehicle's policies, newest expiry first (the records list filtered to one car).
    schema.index({company: 1, vehicle: 1, expiresAt: -1}, {partialFilterExpression: {deletedAt: null}});
    // The fleet reminder job: active policies by expiry date, across companies.
    schema.index({status: 1, expiresAt: 1}, {partialFilterExpression: {deletedAt: null}});
}
