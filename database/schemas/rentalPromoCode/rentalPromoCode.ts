import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {
    RENTAL_PROMO_CODE_CODE_MAX,
    RENTAL_PROMO_CODE_DESCRIPTION_MAX,
    RENTAL_PROMO_CODE_TYPES,
    RentalPromoCodeSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/rentalPromoCode.schema-def";
import type {IVehicleCategory} from "../vehicleCategory/vehicleCategory";
import {VehicleCategorySimpleSnippet} from "../vehicleCategory/vehicleCategory.snippets";
import {applyRentalPromoCodeIndexes} from "./rentalPromoCode.indexes";
import {rentalPromoCodeViews} from "./rentalPromoCode.views";

/** Written only by the system (services and actions). */
const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IRentalPromoCode extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    code: string;
    type: (typeof RENTAL_PROMO_CODE_TYPES)[number];
    value: number;
    category?: IVehicleCategory;
    bookableFrom?: Date;
    bookableUntil?: Date;
    tripFrom?: Date;
    tripUntil?: Date;
    minRentalDays?: number;
    usageLimit?: number;
    usageLimitPerEmail?: number;
    usageCount: number;
    isActive: boolean;
    description?: string;
}

const RentalPromoCodeSchema = new Schema<IRentalPromoCode>(
    {
        code: {type: SchemaTypes.String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: RENTAL_PROMO_CODE_CODE_MAX},
        type: {type: SchemaTypes.String, enum: RENTAL_PROMO_CODE_TYPES, required: true, default: "percent", dynamicTableConfiguration: {enumTones: {percent: "info", fixed: "neutral"}}},
        value: {type: SchemaTypes.Number, required: true, min: 0},
        category: {type: SchemaTypes.ObjectId, ref: "VehicleCategory", refAllowlist: VehicleCategorySimpleSnippet, dynamicTableConfiguration: {refDisplayKey: ["name"]}},
        bookableFrom: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        bookableUntil: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        tripFrom: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        tripUntil: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        minRentalDays: {type: SchemaTypes.Number, min: 1},
        usageLimit: {type: SchemaTypes.Number, min: 1},
        usageLimitPerEmail: {type: SchemaTypes.Number, min: 1},
        usageCount: {type: SchemaTypes.Number, default: 0, permissions: NoWritePermission},
        isActive: {type: SchemaTypes.Boolean, default: true},
        description: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_PROMO_CODE_DESCRIPTION_MAX, dynamicTableConfiguration: {hideColumn: true}},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalPromoCodeSchema);
auditPlugin(RentalPromoCodeSchema);
softDeletePlugin(RentalPromoCodeSchema);
lifeCyclePlugin(RentalPromoCodeSchema);
applyRentalPromoCodeIndexes(RentalPromoCodeSchema);
const RentalPromoCode = model<IRentalPromoCode>("RentalPromoCode", RentalPromoCodeSchema);
normalizeSchemaPermissions(RentalPromoCode);
export default RentalPromoCode;

addModelData(RentalPromoCode, rentalPromoCodeViews);
validateSchemaDefAgainstMongoose(RentalPromoCodeSchema, RentalPromoCodeSchemaDef, "RentalPromoCode");
