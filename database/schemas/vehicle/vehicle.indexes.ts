import {Schema} from "mongoose";

export function applyVehicleIndexes(schema: Schema): void {
    schema.index({company: 1, plate: 1}, {unique: true, partialFilterExpression: {deletedAt: null}});
    schema.index({company: 1, category: 1, status: 1});
}
