import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {
    VEHICLE_COLOR_MAX,
    VEHICLE_MAKE_MAX,
    VEHICLE_MODEL_MAX,
    VEHICLE_NOTES_MAX,
    VEHICLE_PLATE_MAX,
    VEHICLE_STATUSES,
    VEHICLE_VIN_MAX,
    VEHICLE_YEAR,
    VehicleSchemaDef,
    type VehicleStatus,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicleCategory} from "../vehicleCategory/vehicleCategory";
import type {IRentalLocation} from "../rentalLocation/rentalLocation";
import {VehicleCategorySimpleSnippet} from "../vehicleCategory/vehicleCategory.snippets";
import {RentalLocationSimpleSnippet} from "../rentalLocation/rentalLocation.snippets";
import {applyVehicleIndexes} from "./vehicle.indexes";
import {vehicleViews} from "./vehicle.views";

const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IVehicle extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    category: IVehicleCategory;
    make: string;
    model: string;
    year?: number;
    plate: string;
    vin?: string;
    color?: string;
    homeLocation: IRentalLocation;
    status: VehicleStatus;
    odometerKm?: number;
    notes?: string;
    images: IMedia[];
    videos: IMedia[];
    acquiredAt?: Date;
    purchasePrice?: number;
    /** Copied from the latest completed VehicleMaintenance record by `syncVehicleServiceDue`. */
    nextServiceDueAt?: Date;
    nextServiceDueKm?: number;
    /** Set once the fleet reminder job has warned about the current due date/km; cleared when they change. */
    serviceReminderSentAt?: Date;
    /**
     * Bumped inside every transaction that books, blocks or reassigns this vehicle.
     * Two such transactions write the same document, so MongoDB lets only one commit
     * and the other retries and sees the first one's booking. Never read for logic.
     */
    allocationVersion: number;
}

const VehicleSchema = new Schema<IVehicle>(
    {
        category: {
            type: SchemaTypes.ObjectId,
            ref: "VehicleCategory",
            required: true,
            refAllowlist: VehicleCategorySimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        make: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_MAKE_MAX},
        model: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_MODEL_MAX},
        year: {type: SchemaTypes.Number, ...VEHICLE_YEAR},
        plate: {type: SchemaTypes.String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: VEHICLE_PLATE_MAX},
        vin: {type: SchemaTypes.String, trim: true, uppercase: true, maxlength: VEHICLE_VIN_MAX, dynamicTableConfiguration: {hideColumn: true}},
        color: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_COLOR_MAX},
        homeLocation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalLocation",
            required: true,
            refAllowlist: RentalLocationSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        status: {
            type: SchemaTypes.String,
            enum: VEHICLE_STATUSES,
            required: true,
            default: "active",
            dynamicTableConfiguration: {enumTones: {active: "success", maintenance: "warning", retired: "neutral"}},
        },
        odometerKm: {type: SchemaTypes.Number, min: 0},
        notes: {type: SchemaTypes.String, maxlength: VEHICLE_NOTES_MAX, dynamicTableConfiguration: {hideColumn: true}},
        images: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        videos: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        acquiredAt: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE, hideColumn: true}},
        purchasePrice: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {hideColumn: true}},
        nextServiceDueAt: {type: SchemaTypes.Date, permissions: NoWritePermission, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        nextServiceDueKm: {type: SchemaTypes.Number, permissions: NoWritePermission},
        serviceReminderSentAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true, filterable: false},
        },
        allocationVersion: {
            type: SchemaTypes.Number,
            default: 0,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true, filterable: false},
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleSchema);
auditPlugin(VehicleSchema);
softDeletePlugin(VehicleSchema);
lifeCyclePlugin(VehicleSchema);
applyVehicleIndexes(VehicleSchema);
const Vehicle = model<IVehicle>("Vehicle", VehicleSchema);
normalizeSchemaPermissions(Vehicle);
export default Vehicle;

addModelData(Vehicle, vehicleViews);
validateSchemaDefAgainstMongoose(VehicleSchema, VehicleSchemaDef, "Vehicle");
