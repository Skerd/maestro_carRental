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
    VEHICLE_BLOCK_NOTE_MAX,
    VEHICLE_BLOCK_REASONS,
    VehicleBlockSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/vehicleBlock.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import {applyVehicleBlockIndexes} from "./vehicleBlock.indexes";
import {vehicleBlockViews} from "./vehicleBlock.views";

export interface IVehicleBlock extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    vehicle: IVehicle;
    startAt: Date;
    endAt: Date;
    reason: (typeof VEHICLE_BLOCK_REASONS)[number];
    note?: string;
}

const VehicleBlockSchema = new Schema<IVehicleBlock>(
    {
        vehicle: {
            type: SchemaTypes.ObjectId,
            ref: "Vehicle",
            required: true,
            refAllowlist: VehicleSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]},
        },
        startAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        endAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        reason: {
            type: SchemaTypes.String,
            enum: VEHICLE_BLOCK_REASONS,
            required: true,
            dynamicTableConfiguration: {enumTones: {maintenance: "warning", repair: "danger", transfer: "info", other: "neutral"}},
        },
        note: {type: SchemaTypes.String, maxlength: VEHICLE_BLOCK_NOTE_MAX},
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleBlockSchema);
auditPlugin(VehicleBlockSchema);
softDeletePlugin(VehicleBlockSchema);
lifeCyclePlugin(VehicleBlockSchema);
applyVehicleBlockIndexes(VehicleBlockSchema);
const VehicleBlock = model<IVehicleBlock>("VehicleBlock", VehicleBlockSchema);
normalizeSchemaPermissions(VehicleBlock);
export default VehicleBlock;

addModelData(VehicleBlock, vehicleBlockViews);
validateSchemaDefAgainstMongoose(VehicleBlockSchema, VehicleBlockSchemaDef, "VehicleBlock");
