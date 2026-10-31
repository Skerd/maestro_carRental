import {Schema} from "mongoose";

export function applyRentalSubscriptionIndexes(schema: Schema): void {
    schema.index({company: 1, status: 1, nextRunAt: 1}, {partialFilterExpression: {deletedAt: null}});
}
