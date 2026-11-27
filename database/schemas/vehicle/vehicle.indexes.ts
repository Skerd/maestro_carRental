import {Schema} from "mongoose";

export function applyVehicleIndexes(schema: Schema): void {
    schema.index({company: 1, plate: 1}, {unique: true, partialFilterExpression: {deletedAt: null}});
    schema.index({company: 1, category: 1, status: 1});
    // The cars rented on their own (D198): the public site and the portal list them.
    schema.index({company: 1, listedAlone: 1, status: 1});
}
