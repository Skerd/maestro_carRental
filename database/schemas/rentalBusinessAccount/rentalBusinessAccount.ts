import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {
    ILifeCyclePluginFields,
    IOwnershipPluginFields,
    ISoftDeletePluginFields,
} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    RENTAL_BUSINESS_ACCOUNT_ADDRESS_MAX,
    RENTAL_BUSINESS_ACCOUNT_BILLING_EMAIL_MAX,
    RENTAL_BUSINESS_ACCOUNT_NAME_MAX,
    RENTAL_BUSINESS_ACCOUNT_NOTES_MAX,
    RENTAL_BUSINESS_ACCOUNT_VAT_NUMBER_MAX,
    RentalBusinessAccountSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/rentalBusinessAccount/rentalBusinessAccount.schema-def";
import {applyRentalBusinessAccountIndexes} from "./rentalBusinessAccount.indexes";
import {rentalBusinessAccountViews} from "./rentalBusinessAccount.views";

export interface IRentalBusinessAccount
    extends
        Document,
        IOwnershipPluginFields,
        ISoftDeletePluginFields,
        ILifeCyclePluginFields {
    name: string;
    vatNumber: string;
    billingEmail: string;
    address?: string;
    discountPercent?: number;
    paymentTermsDays?: number;
    isActive: boolean;
    notes?: string;
}

const RentalBusinessAccountSchema = new Schema<IRentalBusinessAccount>(
    {
        name: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: RENTAL_BUSINESS_ACCOUNT_NAME_MAX,
        },
        vatNumber: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: RENTAL_BUSINESS_ACCOUNT_VAT_NUMBER_MAX,
        },
        billingEmail: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: RENTAL_BUSINESS_ACCOUNT_BILLING_EMAIL_MAX,
        },
        address: {
            type: SchemaTypes.String,
            trim: true,
            maxlength: RENTAL_BUSINESS_ACCOUNT_ADDRESS_MAX,
        },
        discountPercent: {type: SchemaTypes.Number, min: 0, max: 100},
        paymentTermsDays: {type: SchemaTypes.Number, min: 0},
        isActive: {type: SchemaTypes.Boolean, default: true},
        notes: {
            type: SchemaTypes.String,
            trim: true,
            maxlength: RENTAL_BUSINESS_ACCOUNT_NOTES_MAX,
            dynamicTableConfiguration: {hideColumn: true},
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalBusinessAccountSchema);
auditPlugin(RentalBusinessAccountSchema);
softDeletePlugin(RentalBusinessAccountSchema);
lifeCyclePlugin(RentalBusinessAccountSchema);
applyRentalBusinessAccountIndexes(RentalBusinessAccountSchema);
const RentalBusinessAccount = model<IRentalBusinessAccount>(
    "RentalBusinessAccount",
    RentalBusinessAccountSchema,
);
normalizeSchemaPermissions(RentalBusinessAccount);
export default RentalBusinessAccount;

addModelData(RentalBusinessAccount, rentalBusinessAccountViews);
validateSchemaDefAgainstMongoose(
    RentalBusinessAccountSchema,
    RentalBusinessAccountSchemaDef,
    "RentalBusinessAccount",
);
