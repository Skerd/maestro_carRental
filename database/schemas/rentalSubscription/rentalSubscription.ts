import {Document, model, Schema, SchemaTypes, Types} from "mongoose";
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
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {
    RENTAL_SUBSCRIPTION_CONTACT_NAME_MAX,
    RENTAL_SUBSCRIPTION_EMAIL_MAX,
    RENTAL_SUBSCRIPTION_PERIODS,
    RENTAL_SUBSCRIPTION_PHONE_MAX,
    RENTAL_SUBSCRIPTION_STATUSS,
    RentalSubscriptionSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/rentalSubscription/rentalSubscription.schema-def";
import type {IVehicleCategory} from "../vehicleCategory/vehicleCategory";
import {VehicleCategorySimpleSnippet} from "../vehicleCategory/vehicleCategory.snippets";
import type {IRentalLocation} from "../rentalLocation/rentalLocation";
import {RentalLocationSimpleSnippet} from "../rentalLocation/rentalLocation.snippets";
import {applyRentalSubscriptionIndexes} from "./rentalSubscription.indexes";
import {rentalSubscriptionViews} from "./rentalSubscription.views";

export interface IRentalSubscription
    extends
        Document,
        IOwnershipPluginFields,
        ISoftDeletePluginFields,
        ILifeCyclePluginFields {
    contactName: string;
    email: string;
    phone: string;
    category: IVehicleCategory;
    pickupLocation: IRentalLocation;
    businessAccount?: Types.ObjectId;
    period: (typeof RENTAL_SUBSCRIPTION_PERIODS)[number];
    price: number;
    status: (typeof RENTAL_SUBSCRIPTION_STATUSS)[number];
    nextRunAt: Date;
    /**
     * A monthly subscription's day of the month (1–31), kept by the subscription job so a month clamped to a shorter
     * month (31 Jan → 28 Feb) goes back to it (→ 31 Mar). Cleared when staff change the next date; the job then takes
     * the new date's day (TD-B143).
     */
    anchorDay?: number;
}

const RentalSubscriptionSchema = new Schema<IRentalSubscription>(
    {
        contactName: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: RENTAL_SUBSCRIPTION_CONTACT_NAME_MAX,
        },
        email: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: RENTAL_SUBSCRIPTION_EMAIL_MAX,
        },
        phone: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: RENTAL_SUBSCRIPTION_PHONE_MAX,
        },
        category: {
            type: SchemaTypes.ObjectId,
            ref: "VehicleCategory",
            required: true,
            refAllowlist: VehicleCategorySimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        pickupLocation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalLocation",
            required: true,
            refAllowlist: RentalLocationSimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        businessAccount: {
            type: SchemaTypes.ObjectId,
            ref: "RentalBusinessAccount",
        },
        period: {
            type: SchemaTypes.String,
            enum: RENTAL_SUBSCRIPTION_PERIODS,
            required: true,
            default: "month",
        },
        price: {type: SchemaTypes.Number, required: true, min: 0},
        status: {
            type: SchemaTypes.String,
            enum: RENTAL_SUBSCRIPTION_STATUSS,
            required: true,
            default: "active",
            dynamicTableConfiguration: {
                enumTones: {
                    active: "success",
                    paused: "warning",
                    ended: "neutral",
                },
            },
        },
        nextRunAt: {
            type: SchemaTypes.Date,
            required: true,
            dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME},
        },
        anchorDay: {type: SchemaTypes.Number, required: false, min: 1, max: 31},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalSubscriptionSchema);
auditPlugin(RentalSubscriptionSchema);
softDeletePlugin(RentalSubscriptionSchema);
lifeCyclePlugin(RentalSubscriptionSchema);
applyRentalSubscriptionIndexes(RentalSubscriptionSchema);
const RentalSubscription = model<IRentalSubscription>(
    "RentalSubscription",
    RentalSubscriptionSchema,
);
normalizeSchemaPermissions(RentalSubscription);
export default RentalSubscription;

addModelData(RentalSubscription, rentalSubscriptionViews);
// `anchorDay` belongs to the subscription job, never a form.
validateSchemaDefAgainstMongoose(
    RentalSubscriptionSchema,
    RentalSubscriptionSchemaDef,
    "RentalSubscription",
    ["anchorDay"],
);
