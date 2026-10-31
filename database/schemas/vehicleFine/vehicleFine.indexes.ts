import {Schema} from "mongoose";

export function applyVehicleFineIndexes(schema: Schema): void {
    // A car's fines, newest offence first (the records list filtered to one car).
    schema.index({company: 1, vehicle: 1, offenceAt: -1}, {partialFilterExpression: {deletedAt: null}});
    schema.index({company: 1, reservation: 1}, {partialFilterExpression: {reservation: {$exists: true}}});
}
