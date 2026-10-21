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
    VEHICLE_INSURANCE_COVERAGES,
    VEHICLE_INSURANCE_STATUSES,
    VEHICLE_INSURER_MAX,
    VEHICLE_POLICY_NUMBER_MAX,
    VehicleInsuranceSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.schema-def";
import {VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicle} from "../vehicle/vehicle";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import {applyVehicleInsuranceIndexes} from "./vehicleInsurance.indexes";
import {vehicleInsuranceViews} from "./vehicleInsurance.views";

const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export interface IVehicleInsurance extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    vehicle: IVehicle;
    insurer: string;
    policyNumber: string;
    coverage: (typeof VEHICLE_INSURANCE_COVERAGES)[number];
    validFrom: Date;
    expiresAt: Date;
    premium?: number;
    deductible?: number;
    status: (typeof VEHICLE_INSURANCE_STATUSES)[number];
    attachments: IMedia[];
    notes?: string;
    /** Set once the fleet reminder job has warned about this expiry; cleared when the date moves. */
    expiryReminderSentAt?: Date;
}

const VehicleInsuranceSchema = new Schema<IVehicleInsurance>(
    {
        vehicle: {
            type: SchemaTypes.ObjectId,
            ref: "Vehicle",
            required: true,
            refAllowlist: VehicleSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]},
        },
        insurer: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_INSURER_MAX},
        policyNumber: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: VEHICLE_POLICY_NUMBER_MAX},
        coverage: {
            type: SchemaTypes.String,
            enum: VEHICLE_INSURANCE_COVERAGES,
            required: true,
            dynamicTableConfiguration: {enumTones: {third_party: "neutral", partial_casco: "info", full_casco: "success"}},
        },
        validFrom: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        expiresAt: {type: SchemaTypes.Date, required: true, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATE}},
        premium: {type: SchemaTypes.Number, min: 0},
        deductible: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {hideColumn: true}},
        status: {
            type: SchemaTypes.String,
            enum: VEHICLE_INSURANCE_STATUSES,
            required: true,
            default: "active",
            dynamicTableConfiguration: {enumTones: {active: "success", expired: "danger", cancelled: "neutral"}},
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

ownershipPlugin(VehicleInsuranceSchema);
auditPlugin(VehicleInsuranceSchema);
softDeletePlugin(VehicleInsuranceSchema);
lifeCyclePlugin(VehicleInsuranceSchema);
applyVehicleInsuranceIndexes(VehicleInsuranceSchema);
const VehicleInsurance = model<IVehicleInsurance>("VehicleInsurance", VehicleInsuranceSchema);
normalizeSchemaPermissions(VehicleInsurance);
export default VehicleInsurance;

addModelData(VehicleInsurance, vehicleInsuranceViews);
validateSchemaDefAgainstMongoose(VehicleInsuranceSchema, VehicleInsuranceSchemaDef, "VehicleInsurance");
