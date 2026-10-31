import {Document, model, Schema, SchemaTypes, Types} from "mongoose";
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
    VEHICLE_TRANSFER_NOTES_MAX,
    VEHICLE_TRANSFER_STATUSS,
    VehicleTransferSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/vehicleTransfer.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import type {IRentalLocation} from "../rentalLocation/rentalLocation";
import {RentalLocationSimpleSnippet} from "../rentalLocation/rentalLocation.snippets";
import type {IUser} from "@coreModule/database/schemas/user/user";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {applyVehicleTransferIndexes} from "./vehicleTransfer.indexes";
import {vehicleTransferViews} from "./vehicleTransfer.views";

/** Written only by the system (services and actions). */
const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IVehicleTransfer extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    vehicle: IVehicle;
    fromLocation: IRentalLocation;
    toLocation: IRentalLocation;
    departAt: Date;
    arriveAt: Date;
    driver?: IUser;
    status: (typeof VEHICLE_TRANSFER_STATUSS)[number];
    odometerKm?: number;
    notes?: string;
    /** The block that keeps the car out of bookings on the way; removed when cancelled. */
    block?: Types.ObjectId;
}

const VehicleTransferSchema = new Schema<IVehicleTransfer>(
    {
        vehicle: {type: SchemaTypes.ObjectId, ref: "Vehicle", required: true, refAllowlist: VehicleSimpleSnippet, dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]}},
        fromLocation: {type: SchemaTypes.ObjectId, ref: "RentalLocation", required: true, refAllowlist: RentalLocationSimpleSnippet, dynamicTableConfiguration: {refDisplayKey: ["name"]}},
        toLocation: {type: SchemaTypes.ObjectId, ref: "RentalLocation", required: true, refAllowlist: RentalLocationSimpleSnippet, dynamicTableConfiguration: {refDisplayKey: ["name"]}},
        departAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        arriveAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        driver: {type: SchemaTypes.ObjectId, ref: "User", refAllowlist: SimpleBlankUserSnippet, dynamicTableConfiguration: {refDisplayKey: ["name", "surname"]}},
        status: {type: SchemaTypes.String, enum: VEHICLE_TRANSFER_STATUSS, default: "planned", permissions: NoWritePermission, dynamicTableConfiguration: {enumTones: {planned: "info", in_transit: "warning", done: "success", cancelled: "neutral"}}},
        odometerKm: {type: SchemaTypes.Number, min: 0},
        block: {type: SchemaTypes.ObjectId, ref: "VehicleBlock", permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true, filterable: false}},
        notes: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_TRANSFER_NOTES_MAX, dynamicTableConfiguration: {hideColumn: true}},
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleTransferSchema);
auditPlugin(VehicleTransferSchema);
softDeletePlugin(VehicleTransferSchema);
lifeCyclePlugin(VehicleTransferSchema);
applyVehicleTransferIndexes(VehicleTransferSchema);
const VehicleTransfer = model<IVehicleTransfer>("VehicleTransfer", VehicleTransferSchema);
normalizeSchemaPermissions(VehicleTransfer);
export default VehicleTransfer;

addModelData(VehicleTransfer, vehicleTransferViews);
validateSchemaDefAgainstMongoose(VehicleTransferSchema, VehicleTransferSchemaDef, "VehicleTransfer");
