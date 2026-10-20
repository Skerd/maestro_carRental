import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    RENTAL_EXTRA_DESCRIPTION_MAX,
    RENTAL_EXTRA_NAME_MAX,
    RENTAL_EXTRA_PRICINGS,
    RENTAL_EXTRA_QUANTITY,
    RentalExtraSchemaDef,
    type RentalExtraPricing,
} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.schema-def";
import {applyRentalExtraIndexes} from "./rentalExtra.indexes";
import {rentalExtraViews} from "./rentalExtra.views";

export interface IRentalExtra extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    description?: string;
    pricing: RentalExtraPricing;
    price: number;
    maxQuantity: number;
    isActive: boolean;
    sortOrder: number;
}

const RentalExtraSchema = new Schema<IRentalExtra>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: RENTAL_EXTRA_NAME_MAX},
        description: {type: SchemaTypes.String, maxlength: RENTAL_EXTRA_DESCRIPTION_MAX, dynamicTableConfiguration: {hideColumn: true}},
        pricing: {
            type: SchemaTypes.String,
            enum: RENTAL_EXTRA_PRICINGS,
            required: true,
            dynamicTableConfiguration: {enumTones: {per_day: "info", per_rental: "neutral"}},
        },
        price: {type: SchemaTypes.Number, required: true, min: 0},
        maxQuantity: {type: SchemaTypes.Number, required: true, default: 1, ...RENTAL_EXTRA_QUANTITY},
        isActive: {type: SchemaTypes.Boolean, default: true},
        sortOrder: {type: SchemaTypes.Number, default: 0},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalExtraSchema);
auditPlugin(RentalExtraSchema);
softDeletePlugin(RentalExtraSchema);
lifeCyclePlugin(RentalExtraSchema);
applyRentalExtraIndexes(RentalExtraSchema);
const RentalExtra = model<IRentalExtra>("RentalExtra", RentalExtraSchema);
normalizeSchemaPermissions(RentalExtra);
export default RentalExtra;

addModelData(RentalExtra, rentalExtraViews);
validateSchemaDefAgainstMongoose(RentalExtraSchema, RentalExtraSchemaDef, "RentalExtra");
