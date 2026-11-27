import {Schema} from "mongoose";

/** One platform tree (D199): browsed a level at a time, searched by name, seeded by catalog id. */
export function applyVehicleCatalogIndexes(schema: Schema): void {
    schema.index({company: 1, parentEntry: 1, order: 1, name: 1});
    schema.index({company: 1, level: 1, name: 1});
    schema.index({catalogId: 1}, {unique: true, partialFilterExpression: {catalogId: {$type: "string"}}});
}
