import {Document, model, Schema, SchemaTypes} from "mongoose";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import publicMediaPlugin from "@coreModule/database/plugins/publicMediaPlugin";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {
    VEHICLE_CATEGORY_DESCRIPTION_MAX,
    VEHICLE_CATEGORY_NAME_MAX,
    VEHICLE_CATEGORY_SLUG_MAX,
    VEHICLE_DOORS,
    VEHICLE_DRIVER_AGE,
    VEHICLE_FUEL_TYPES,
    VEHICLE_LUGGAGE,
    VEHICLE_MILEAGE_POLICIES,
    VEHICLE_SEATS,
    VEHICLE_TRANSMISSIONS,
    VehicleCategorySchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";
import {applyVehicleCategoryIndexes} from "./vehicleCategory.indexes";
import {vehicleCategoryViews} from "./vehicleCategory.views";

export type IVehicleCategorySeason = {startDate: string; endDate: string; dailyRate: number};

export interface IVehicleCategory extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    slug: string;
    description?: string;
    images: IMedia[];
    seats: number;
    doors?: number;
    luggage?: number;
    transmission: (typeof VEHICLE_TRANSMISSIONS)[number];
    fuelType: (typeof VEHICLE_FUEL_TYPES)[number];
    features: string[];
    dailyRate: number;
    weekendDailyRate?: number;
    weeklyRate?: number;
    rateSeasons: IVehicleCategorySeason[];
    depositAmount?: number;
    mileagePolicy: (typeof VEHICLE_MILEAGE_POLICIES)[number];
    includedKmPerDay?: number;
    extraKmPrice?: number;
    minDriverAge?: number;
    isPublic: boolean;
    sortOrder: number;
}

const VehicleCategorySchema = new Schema<IVehicleCategory>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_CATEGORY_NAME_MAX},
        slug: {type: SchemaTypes.String, required: true, trim: true, lowercase: true, minlength: 1, maxlength: VEHICLE_CATEGORY_SLUG_MAX},
        description: {type: SchemaTypes.String, maxlength: VEHICLE_CATEGORY_DESCRIPTION_MAX, dynamicTableConfiguration: {hideColumn: true}},
        images: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        seats: {type: SchemaTypes.Number, required: true, ...VEHICLE_SEATS},
        doors: {type: SchemaTypes.Number, ...VEHICLE_DOORS},
        luggage: {type: SchemaTypes.Number, ...VEHICLE_LUGGAGE},
        transmission: {type: SchemaTypes.String, enum: VEHICLE_TRANSMISSIONS, required: true},
        fuelType: {type: SchemaTypes.String, enum: VEHICLE_FUEL_TYPES, required: true},
        features: {type: [SchemaTypes.String], default: [], dynamicTableConfiguration: {hideColumn: true}},
        dailyRate: {type: SchemaTypes.Number, required: true, min: 0},
        weekendDailyRate: {type: SchemaTypes.Number, min: 0},
        weeklyRate: {type: SchemaTypes.Number, min: 0},
        rateSeasons: {
            type: [{
                _id: false,
                startDate: {type: SchemaTypes.String, required: true},
                endDate: {type: SchemaTypes.String, required: true},
                dailyRate: {type: SchemaTypes.Number, required: true, min: 0},
            }],
            default: [],
            dynamicTableConfiguration: {hideColumn: true, filterable: false, sortable: false},
        },
        depositAmount: {type: SchemaTypes.Number, min: 0},
        mileagePolicy: {type: SchemaTypes.String, enum: VEHICLE_MILEAGE_POLICIES, required: true, default: "unlimited"},
        includedKmPerDay: {type: SchemaTypes.Number, min: 0},
        extraKmPrice: {type: SchemaTypes.Number, min: 0},
        minDriverAge: {type: SchemaTypes.Number, ...VEHICLE_DRIVER_AGE},
        isPublic: {type: SchemaTypes.Boolean, default: true},
        sortOrder: {type: SchemaTypes.Number, default: 0},
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleCategorySchema);
publicMediaPlugin(VehicleCategorySchema, {schemaDef: VehicleCategorySchemaDef});
auditPlugin(VehicleCategorySchema);
softDeletePlugin(VehicleCategorySchema);
lifeCyclePlugin(VehicleCategorySchema);
applyVehicleCategoryIndexes(VehicleCategorySchema);
const VehicleCategory = model<IVehicleCategory>("VehicleCategory", VehicleCategorySchema);
normalizeSchemaPermissions(VehicleCategory);
export default VehicleCategory;

addModelData(VehicleCategory, vehicleCategoryViews);
validateSchemaDefAgainstMongoose(VehicleCategorySchema, VehicleCategorySchemaDef, "VehicleCategory");
