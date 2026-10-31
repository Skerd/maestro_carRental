import {Schema} from "mongoose";

export function applyRentalDenyEntryIndexes(schema: Schema): void {
    schema.index({company: 1, email: 1}, {partialFilterExpression: {deletedAt: null, isActive: true}});
    schema.index({company: 1, licenseNumber: 1}, {partialFilterExpression: {deletedAt: null, isActive: true}});
}
