import {Document, model, Schema, SchemaTypes} from "mongoose";
import {ICountry} from "@coreModule/database/schemas/country/country";
import {ICity} from "@coreModule/database/schemas/city/city";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {CountrySimpleSnippet} from "@coreModule/database/schemas/country/country.snippets";
import {CitySimpleSnippet} from "@coreModule/database/schemas/city/city.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import type {WeeklyHoursSlot} from "armonia/src/modules/core/helpers/weeklyHours.schema-def";
import {
    RENTAL_LOCATION_CLOSURE_REASON_MAX,
    RENTAL_LOCATION_NAME_MAX,
    RENTAL_LOCATION_PHONE_MAX,
    RENTAL_LOCATION_POSTAL_CODE_MAX,
    RENTAL_LOCATION_STREET_MAX,
    RENTAL_LOCATION_TIMEZONE_MAX,
    RentalLocationSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/rentalLocation/rentalLocation.schema-def";
import {applyRentalLocationIndexes} from "./rentalLocation.indexes";
import {rentalLocationViews} from "./rentalLocation.views";

export interface IRentalLocationAddress {
    country?: ICountry;
    city?: ICity;
    street?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
}

export interface IRentalLocation extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    name: string;
    phone?: string;
    email?: string;
    address?: IRentalLocationAddress;
    timezone: string;
    openingHours: WeeklyHoursSlot[];
    closures: {date: string; reason?: string}[];
    pickupAllowed: boolean;
    returnAllowed: boolean;
    isActive: boolean;
}

const RentalLocationSchema = new Schema<IRentalLocation>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: RENTAL_LOCATION_NAME_MAX},
        phone: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_LOCATION_PHONE_MAX},
        email: {type: SchemaTypes.String, trim: true, lowercase: true},
        address: {
            type: {
                country: {type: SchemaTypes.ObjectId, ref: "Country", refAllowlist: CountrySimpleSnippet},
                city: {type: SchemaTypes.ObjectId, ref: "City", refAllowlist: CitySimpleSnippet},
                street: {type: SchemaTypes.String, maxlength: RENTAL_LOCATION_STREET_MAX},
                postalCode: {type: SchemaTypes.String, maxlength: RENTAL_LOCATION_POSTAL_CODE_MAX},
                latitude: {type: SchemaTypes.Number, min: -90, max: 90},
                longitude: {type: SchemaTypes.Number, min: -180, max: 180},
            },
            required: false,
            dynamicTableConfiguration: {filterable: false, sortable: false, cellType: COLUMN_TYPE.ADDRESS},
        },
        timezone: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: RENTAL_LOCATION_TIMEZONE_MAX},
        openingHours: {
            type: [{
                _id: false,
                dayOfWeek: {type: SchemaTypes.Number, required: true, min: 0, max: 6},
                startTime: {type: SchemaTypes.String, required: true},
                endTime: {type: SchemaTypes.String, required: true},
            }],
            default: [],
            dynamicTableConfiguration: {hideColumn: true, filterable: false, sortable: false},
        },
        closures: {
            type: [{
                _id: false,
                date: {type: SchemaTypes.String, required: true},
                reason: {type: SchemaTypes.String, maxlength: RENTAL_LOCATION_CLOSURE_REASON_MAX},
            }],
            default: [],
            dynamicTableConfiguration: {hideColumn: true, filterable: false, sortable: false},
        },
        pickupAllowed: {type: SchemaTypes.Boolean, default: true},
        returnAllowed: {type: SchemaTypes.Boolean, default: true},
        isActive: {type: SchemaTypes.Boolean, default: true},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalLocationSchema);
auditPlugin(RentalLocationSchema);
softDeletePlugin(RentalLocationSchema);
lifeCyclePlugin(RentalLocationSchema);
applyRentalLocationIndexes(RentalLocationSchema);
const RentalLocation = model<IRentalLocation>("RentalLocation", RentalLocationSchema);
normalizeSchemaPermissions(RentalLocation);
export default RentalLocation;

addModelData(RentalLocation, rentalLocationViews);
validateSchemaDefAgainstMongoose(RentalLocationSchema, RentalLocationSchemaDef, "RentalLocation");
