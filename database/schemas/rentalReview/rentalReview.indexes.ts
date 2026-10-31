import {Schema} from "mongoose";

export function applyRentalReviewIndexes(schema: Schema): void {
    schema.index({company: 1, reservation: 1}, {unique: true, partialFilterExpression: {deletedAt: null}});
}
