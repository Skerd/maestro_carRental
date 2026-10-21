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
    VEHICLE_DAMAGE_AREAS,
    VEHICLE_DAMAGE_SEVERITIES,
    VEHICLE_DAMAGE_STATUSES,
    VehicleDamageSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.schema-def";
import {VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import type {IRentalReservation} from "../rentalReservation/rentalReservation";
import {RentalReservationSimpleSnippet} from "../rentalReservation/rentalReservation.snippets";
import {applyVehicleDamageIndexes} from "./vehicleDamage.indexes";
import {vehicleDamageViews} from "./vehicleDamage.views";

export interface IVehicleDamage extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    vehicle: IVehicle;
    reservation?: IRentalReservation;
    reportedAt: Date;
    area: (typeof VEHICLE_DAMAGE_AREAS)[number];
    severity: (typeof VEHICLE_DAMAGE_SEVERITIES)[number];
    description: string;
    photos: IMedia[];
    status: (typeof VEHICLE_DAMAGE_STATUSES)[number];
    estimatedCost?: number;
    repairCost?: number;
    repairedAt?: Date;
}

const VehicleDamageSchema = new Schema<IVehicleDamage>(
    {
        vehicle: {
            type: SchemaTypes.ObjectId,
            ref: "Vehicle",
            required: true,
            refAllowlist: VehicleSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]},
        },
        reservation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalReservation",
            refAllowlist: RentalReservationSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["number"]},
        },
        reportedAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        area: {type: SchemaTypes.String, enum: VEHICLE_DAMAGE_AREAS, required: true},
        severity: {
            type: SchemaTypes.String,
            enum: VEHICLE_DAMAGE_SEVERITIES,
            required: true,
            dynamicTableConfiguration: {enumTones: {minor: "neutral", moderate: "warning", major: "danger"}},
        },
        description: {type: SchemaTypes.String, required: true, minlength: 1, maxlength: VEHICLE_RECORD_NOTES_MAX, dynamicTableConfiguration: {hideColumn: true}},
        photos: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        status: {
            type: SchemaTypes.String,
            enum: VEHICLE_DAMAGE_STATUSES,
            required: true,
            default: "open",
            dynamicTableConfiguration: {enumTones: {open: "danger", in_repair: "warning", repaired: "success"}},
        },
        estimatedCost: {type: SchemaTypes.Number, min: 0},
        repairCost: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {hideColumn: true}},
        repairedAt: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE, hideColumn: true}},
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleDamageSchema);
auditPlugin(VehicleDamageSchema);
softDeletePlugin(VehicleDamageSchema);
lifeCyclePlugin(VehicleDamageSchema);
applyVehicleDamageIndexes(VehicleDamageSchema);
const VehicleDamage = model<IVehicleDamage>("VehicleDamage", VehicleDamageSchema);
normalizeSchemaPermissions(VehicleDamage);
export default VehicleDamage;

addModelData(VehicleDamage, vehicleDamageViews);
validateSchemaDefAgainstMongoose(VehicleDamageSchema, VehicleDamageSchemaDef, "VehicleDamage");
