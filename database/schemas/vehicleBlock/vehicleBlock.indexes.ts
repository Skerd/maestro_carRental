import {Schema} from "mongoose";

export function applyVehicleBlockIndexes(schema: Schema): void {
    // Overlap lookups: live blocks of one vehicle around a window.
    schema.index({company: 1, vehicle: 1, startAt: 1, endAt: 1}, {partialFilterExpression: {deletedAt: null}});
}
