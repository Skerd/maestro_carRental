import {Schema} from "mongoose";

export function applyVehicleMaintenanceIndexes(schema: Schema): void {
    // A vehicle's service log, and its latest completed service (syncVehicleServiceDue).
    schema.index({company: 1, vehicle: 1, status: 1, serviceDate: -1}, {partialFilterExpression: {deletedAt: null}});
}
