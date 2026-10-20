import {Document, model, Schema, SchemaTypes} from "mongoose";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IUser} from "@coreModule/database/schemas/user/user";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    CarRentalConfigSchemaDef,
    RENTAL_ADVANCE_DAYS,
    RENTAL_FREE_CANCELLATION_HOURS,
    RENTAL_HOLD_MINUTES,
    RENTAL_LATE_GRACE_MINUTES,
    RENTAL_LEAD_TIME_HOURS,
    RENTAL_MAX_RENTAL_DAYS,
    RENTAL_MIN_RENTAL_HOURS,
    RENTAL_PAYMENT_POLICIES,
    RENTAL_PERCENT,
    RENTAL_TERMS_TEXT_MAX,
    RENTAL_TERMS_VERSION_MAX,
    RENTAL_TURNAROUND_MINUTES,
    type RentalPaymentPolicy,
} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.schema-def";
import {applyCarRentalConfigIndexes} from "./carRentalConfig.indexes";
import {carRentalConfigViews} from "./carRentalConfig.views";

export interface ICarRentalConfig extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    publicBookingEnabled: boolean;
    currency: ICurrency;
    minRentalHours: number;
    maxRentalDays: number;
    minLeadTimeHours: number;
    maxAdvanceDays: number;
    turnaroundBufferMinutes: number;
    holdMinutes: number;
    lateGraceMinutes: number;
    paymentPolicy: RentalPaymentPolicy;
    freeCancellationHours: number;
    cancellationFeePercent: number;
    vatRate: number;
    pricesIncludeVat: boolean;
    guestBookingAllowed: boolean;
    termsVersion?: string;
    termsText?: string;
    notifyUsers: IUser[];
}

const CarRentalConfigSchema = new Schema<ICarRentalConfig>(
    {
        publicBookingEnabled: {type: SchemaTypes.Boolean, default: false},
        currency: {
            type: SchemaTypes.ObjectId,
            ref: "Currency",
            required: true,
            refAllowlist: CurrencySimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["abbreviation"]},
        },
        minRentalHours: {type: SchemaTypes.Number, required: true, default: 24, ...RENTAL_MIN_RENTAL_HOURS},
        maxRentalDays: {type: SchemaTypes.Number, required: true, default: 30, ...RENTAL_MAX_RENTAL_DAYS},
        minLeadTimeHours: {type: SchemaTypes.Number, required: true, default: 2, ...RENTAL_LEAD_TIME_HOURS},
        maxAdvanceDays: {type: SchemaTypes.Number, required: true, default: 365, ...RENTAL_ADVANCE_DAYS},
        turnaroundBufferMinutes: {type: SchemaTypes.Number, required: true, default: 60, ...RENTAL_TURNAROUND_MINUTES},
        holdMinutes: {type: SchemaTypes.Number, required: true, default: 20, ...RENTAL_HOLD_MINUTES},
        lateGraceMinutes: {type: SchemaTypes.Number, required: true, default: 59, ...RENTAL_LATE_GRACE_MINUTES},
        paymentPolicy: {
            type: SchemaTypes.String,
            enum: RENTAL_PAYMENT_POLICIES,
            required: true,
            default: "pay_at_pickup",
        },
        freeCancellationHours: {type: SchemaTypes.Number, required: true, default: 48, ...RENTAL_FREE_CANCELLATION_HOURS},
        cancellationFeePercent: {type: SchemaTypes.Number, required: true, default: 0, ...RENTAL_PERCENT},
        vatRate: {type: SchemaTypes.Number, required: true, default: 0, ...RENTAL_PERCENT},
        pricesIncludeVat: {type: SchemaTypes.Boolean, default: true},
        guestBookingAllowed: {type: SchemaTypes.Boolean, default: true},
        termsVersion: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_TERMS_VERSION_MAX},
        termsText: {type: SchemaTypes.String, maxlength: RENTAL_TERMS_TEXT_MAX, dynamicTableConfiguration: {hideColumn: true}},
        notifyUsers: {
            type: [{type: SchemaTypes.ObjectId, ref: "User"}],
            default: [],
            refAllowlist: SimpleBlankUserSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["name", "surname"]},
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(CarRentalConfigSchema);
auditPlugin(CarRentalConfigSchema);
softDeletePlugin(CarRentalConfigSchema);
lifeCyclePlugin(CarRentalConfigSchema);
applyCarRentalConfigIndexes(CarRentalConfigSchema);
const CarRentalConfig = model<ICarRentalConfig>("CarRentalConfig", CarRentalConfigSchema);
normalizeSchemaPermissions(CarRentalConfig);
export default CarRentalConfig;

addModelData(CarRentalConfig, carRentalConfigViews);
validateSchemaDefAgainstMongoose(CarRentalConfigSchema, CarRentalConfigSchemaDef, "CarRentalConfig");
