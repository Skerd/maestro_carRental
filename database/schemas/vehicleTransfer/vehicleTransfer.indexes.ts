import {Schema} from "mongoose";

export function applyVehicleTransferIndexes(schema: Schema): void {
    // A car's transfers by time: the location projection and the planner.
    schema.index({company: 1, vehicle: 1, arriveAt: -1}, {partialFilterExpression: {deletedAt: null}});
    schema.index({company: 1, departAt: 1}, {partialFilterExpression: {deletedAt: null}});
}
