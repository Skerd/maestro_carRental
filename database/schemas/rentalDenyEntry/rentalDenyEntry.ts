import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    RENTAL_DENY_ENTRY_EMAIL_MAX,
    RENTAL_DENY_ENTRY_LICENSE_NUMBER_MAX,
    RENTAL_DENY_ENTRY_REASON_MAX,
    RentalDenyEntrySchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/rentalDenyEntry/rentalDenyEntry.schema-def";
import {applyRentalDenyEntryIndexes} from "./rentalDenyEntry.indexes";
import {rentalDenyEntryViews} from "./rentalDenyEntry.views";

export interface IRentalDenyEntry extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    email?: string;
    licenseNumber?: string;
    reason: string;
    isActive: boolean;
}

const RentalDenyEntrySchema = new Schema<IRentalDenyEntry>(
    {
        email: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_DENY_ENTRY_EMAIL_MAX},
        licenseNumber: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_DENY_ENTRY_LICENSE_NUMBER_MAX},
        reason: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: RENTAL_DENY_ENTRY_REASON_MAX, dynamicTableConfiguration: {hideColumn: true}},
        isActive: {type: SchemaTypes.Boolean, default: true},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalDenyEntrySchema);
auditPlugin(RentalDenyEntrySchema);
softDeletePlugin(RentalDenyEntrySchema);
lifeCyclePlugin(RentalDenyEntrySchema);
applyRentalDenyEntryIndexes(RentalDenyEntrySchema);
const RentalDenyEntry = model<IRentalDenyEntry>("RentalDenyEntry", RentalDenyEntrySchema);
normalizeSchemaPermissions(RentalDenyEntry);
export default RentalDenyEntry;

addModelData(RentalDenyEntry, rentalDenyEntryViews);
validateSchemaDefAgainstMongoose(RentalDenyEntrySchema, RentalDenyEntrySchemaDef, "RentalDenyEntry");
