import {Document, model, Schema, SchemaTypes, Types} from "mongoose";
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
    VEHICLE_MAINTENANCE_PROVIDER_MAX,
    VEHICLE_MAINTENANCE_STATUSES,
    VEHICLE_MAINTENANCE_TYPES,
    VehicleMaintenanceSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenance.schema-def";
import {VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import type {IVehicleDamage} from "../vehicleDamage/vehicleDamage";
import {VehicleDamageSimpleSnippet} from "../vehicleDamage/vehicleDamage.snippets";
import {applyVehicleMaintenanceIndexes} from "./vehicleMaintenance.indexes";
import {vehicleMaintenanceViews} from "./vehicleMaintenance.views";

/** Written only by the system (services and actions). */
const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IVehicleMaintenance extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    vehicle: IVehicle;
    type: (typeof VEHICLE_MAINTENANCE_TYPES)[number];
    status: (typeof VEHICLE_MAINTENANCE_STATUSES)[number];
    serviceDate: Date;
    /** With a scheduled record: the car is out of bookings until then (see `block`). */
    readyAt?: Date;
    odometerKm?: number;
    provider?: string;
    cost?: number;
    description?: string;
    nextDueAt?: Date;
    nextDueKm?: number;
    attachments: IMedia[];
    /** The damage reports this repair fixes; set by the damage scheduleRepair action. */
    damages: IVehicleDamage[];
    /** The block that keeps the car out of bookings until `readyAt`; ended on complete, removed on cancel. */
    block?: Types.ObjectId;
}

const VehicleMaintenanceSchema = new Schema<IVehicleMaintenance>(
    {
        vehicle: {
            type: SchemaTypes.ObjectId,
            ref: "Vehicle",
            required: true,
            refAllowlist: VehicleSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]},
        },
        type: {type: SchemaTypes.String, enum: VEHICLE_MAINTENANCE_TYPES, required: true},
        status: {
            type: SchemaTypes.String,
            enum: VEHICLE_MAINTENANCE_STATUSES,
            required: true,
            default: "completed",
            dynamicTableConfiguration: {enumTones: {scheduled: "info", completed: "success", cancelled: "neutral"}},
        },
        serviceDate: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        readyAt: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE, hideColumn: true}},
        odometerKm: {type: SchemaTypes.Number, min: 0},
        provider: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_MAINTENANCE_PROVIDER_MAX},
        cost: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {currencyPath: "currency"}},
        description: {type: SchemaTypes.String, maxlength: VEHICLE_RECORD_NOTES_MAX, dynamicTableConfiguration: {hideColumn: true}},
        nextDueAt: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE, hideColumn: true}},
        nextDueKm: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {hideColumn: true}},
        attachments: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        damages: {
            type: [{type: SchemaTypes.ObjectId, ref: "VehicleDamage"}],
            default: [],
            refAllowlist: VehicleDamageSimpleSnippet,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        block: {type: SchemaTypes.ObjectId, ref: "VehicleBlock", permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true, filterable: false}},
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleMaintenanceSchema);
auditPlugin(VehicleMaintenanceSchema);
softDeletePlugin(VehicleMaintenanceSchema);
lifeCyclePlugin(VehicleMaintenanceSchema);
applyVehicleMaintenanceIndexes(VehicleMaintenanceSchema);
const VehicleMaintenance = model<IVehicleMaintenance>("VehicleMaintenance", VehicleMaintenanceSchema);
normalizeSchemaPermissions(VehicleMaintenance);
export default VehicleMaintenance;

addModelData(VehicleMaintenance, vehicleMaintenanceViews);
validateSchemaDefAgainstMongoose(VehicleMaintenanceSchema, VehicleMaintenanceSchemaDef, "VehicleMaintenance");
