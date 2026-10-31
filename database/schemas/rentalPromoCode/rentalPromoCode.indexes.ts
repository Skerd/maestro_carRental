import {Schema} from "mongoose";

export function applyRentalPromoCodeIndexes(schema: Schema): void {
    schema.index({company: 1, code: 1}, {unique: true, partialFilterExpression: {deletedAt: null}});
}
