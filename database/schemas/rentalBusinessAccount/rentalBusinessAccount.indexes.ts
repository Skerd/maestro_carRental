import {Schema} from "mongoose";

export function applyRentalBusinessAccountIndexes(schema: Schema): void {
    schema.index({company: 1, vatNumber: 1}, {unique: true, partialFilterExpression: {deletedAt: null}});
}
