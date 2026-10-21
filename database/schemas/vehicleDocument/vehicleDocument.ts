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
    VEHICLE_DOCUMENT_ISSUER_MAX,
    VEHICLE_DOCUMENT_NUMBER_MAX,
    VEHICLE_DOCUMENT_STATUSES,
    VEHICLE_DOCUMENT_TYPES,
    VehicleDocumentSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleDocument/vehicleDocument.schema-def";
import {VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import {applyVehicleDocumentIndexes} from "./vehicleDocument.indexes";
import {vehicleDocumentViews} from "./vehicleDocument.views";

const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IVehicleDocument extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    vehicle: IVehicle;
    type: (typeof VEHICLE_DOCUMENT_TYPES)[number];
    documentNumber?: string;
    issuer?: string;
    issuedAt?: Date;
    expiresAt?: Date;
    status: (typeof VEHICLE_DOCUMENT_STATUSES)[number];
    attachments: IMedia[];
    notes?: string;
    /** Set once the fleet reminder job has warned about this expiry; cleared when the date moves. */
    expiryReminderSentAt?: Date;
}

const VehicleDocumentSchema = new Schema<IVehicleDocument>(
    {
        vehicle: {
            type: SchemaTypes.ObjectId,
            ref: "Vehicle",
            required: true,
            refAllowlist: VehicleSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]},
        },
        type: {type: SchemaTypes.String, enum: VEHICLE_DOCUMENT_TYPES, required: true},
        documentNumber: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_DOCUMENT_NUMBER_MAX},
        issuer: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_DOCUMENT_ISSUER_MAX, dynamicTableConfiguration: {hideColumn: true}},
        issuedAt: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE, hideColumn: true}},
        expiresAt: {type: SchemaTypes.Date, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        status: {
            type: SchemaTypes.String,
            enum: VEHICLE_DOCUMENT_STATUSES,
            required: true,
            default: "active",
            dynamicTableConfiguration: {enumTones: {active: "success", expired: "danger"}},
        },
        attachments: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {sortable: false, filterable: false, hideColumn: true},
        },
        notes: {type: SchemaTypes.String, maxlength: VEHICLE_RECORD_NOTES_MAX, dynamicTableConfiguration: {hideColumn: true}},
        expiryReminderSentAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true, filterable: false},
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleDocumentSchema);
auditPlugin(VehicleDocumentSchema);
softDeletePlugin(VehicleDocumentSchema);
lifeCyclePlugin(VehicleDocumentSchema);
applyVehicleDocumentIndexes(VehicleDocumentSchema);
const VehicleDocument = model<IVehicleDocument>("VehicleDocument", VehicleDocumentSchema);
normalizeSchemaPermissions(VehicleDocument);
export default VehicleDocument;

addModelData(VehicleDocument, vehicleDocumentViews);
validateSchemaDefAgainstMongoose(VehicleDocumentSchema, VehicleDocumentSchemaDef, "VehicleDocument");
