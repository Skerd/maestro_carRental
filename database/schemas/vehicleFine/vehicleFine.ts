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
    VEHICLE_FINE_AUTHORITY_MAX,
    VEHICLE_FINE_NOTES_MAX,
    VEHICLE_FINE_PLACE_MAX,
    VEHICLE_FINE_REFERENCE_MAX,
    VEHICLE_FINE_STATUSS,
    VEHICLE_FINE_TYPES,
    VehicleFineSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import type {IRentalReservation} from "../rentalReservation/rentalReservation";
import {RentalReservationSimpleSnippet} from "../rentalReservation/rentalReservation.snippets";
import {applyVehicleFineIndexes} from "./vehicleFine.indexes";
import {vehicleFineViews} from "./vehicleFine.views";

/** Written only by the system (services and actions). */
const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IVehicleFine extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    reference: string;
    vehicle: IVehicle;
    offenceAt: Date;
    type: (typeof VEHICLE_FINE_TYPES)[number];
    authority: string;
    amount: number;
    place?: string;
    dueDate?: Date;
    status: (typeof VEHICLE_FINE_STATUSS)[number];
    reservation?: IRentalReservation;
    driverName?: string;
    chargedAmount?: number;
    attachments: IMedia[];
    notes?: string;
}

const VehicleFineSchema = new Schema<IVehicleFine>(
    {
        reference: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_FINE_REFERENCE_MAX},
        vehicle: {type: SchemaTypes.ObjectId, ref: "Vehicle", required: true, refAllowlist: VehicleSimpleSnippet, dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]}},
        offenceAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        type: {type: SchemaTypes.String, enum: VEHICLE_FINE_TYPES, required: true, default: "speeding", dynamicTableConfiguration: {enumTones: {speeding: "danger", parking: "warning", red_light: "danger", toll: "info", other: "neutral"}}},
        authority: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_FINE_AUTHORITY_MAX},
        amount: {type: SchemaTypes.Number, required: true, min: 0},
        place: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_FINE_PLACE_MAX},
        dueDate: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        status: {type: SchemaTypes.String, enum: VEHICLE_FINE_STATUSS, default: "received", dynamicTableConfiguration: {enumTones: {received: "warning", driver_identified: "info", charged: "success", paid_by_company: "neutral", transferred: "success", disputed: "danger"}}},
        reservation: {type: SchemaTypes.ObjectId, ref: "RentalReservation", refAllowlist: RentalReservationSimpleSnippet, permissions: NoWritePermission, dynamicTableConfiguration: {refDisplayKey: ["number"]}},
        driverName: {type: SchemaTypes.String, trim: true, permissions: NoWritePermission},
        chargedAmount: {type: SchemaTypes.Number, permissions: NoWritePermission},
        attachments: {type: [{type: SchemaTypes.ObjectId, ref: "Media"}], default: [], refAllowlist: MediaSimpleSnippet, dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true}},
        notes: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_FINE_NOTES_MAX, dynamicTableConfiguration: {hideColumn: true}},
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleFineSchema);
auditPlugin(VehicleFineSchema);
softDeletePlugin(VehicleFineSchema);
lifeCyclePlugin(VehicleFineSchema);
applyVehicleFineIndexes(VehicleFineSchema);
const VehicleFine = model<IVehicleFine>("VehicleFine", VehicleFineSchema);
normalizeSchemaPermissions(VehicleFine);
export default VehicleFine;

addModelData(VehicleFine, vehicleFineViews);
validateSchemaDefAgainstMongoose(VehicleFineSchema, VehicleFineSchemaDef, "VehicleFine");
