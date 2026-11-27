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
import publicMediaPlugin from "@coreModule/database/plugins/publicMediaPlugin";
import {platformHiddenPlugin, type IPlatformHiddenPluginFields} from "@coreModule/database/plugins/platformHiddenPlugin";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {
    VEHICLE_COLOR_MAX,
    VEHICLE_LISTING_DESCRIPTION_MAX,
    VEHICLE_LISTING_TITLE_MAX,
    VEHICLE_MAKE_MAX,
    VEHICLE_MODEL_MAX,
    VEHICLE_NOTES_MAX,
    VEHICLE_PLATE_MAX,
    VEHICLE_READINESS,
    VEHICLE_STATUSES,
    VEHICLE_VIN_MAX,
    VEHICLE_YEAR,
    VehicleSchemaDef,
    type VehicleReadiness,
    type VehicleStatus,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicleCategory, IVehicleCategorySeason} from "../vehicleCategory/vehicleCategory";
import {
    VEHICLE_DOORS,
    VEHICLE_FUEL_TYPES,
    VEHICLE_LUGGAGE,
    VEHICLE_SEATS,
    VEHICLE_TRANSMISSIONS,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";
import type {IRentalLocation} from "../rentalLocation/rentalLocation";
import {VehicleCategoryPricedSnippet} from "../vehicleCategory/vehicleCategory.snippets";
import {RentalLocationSimpleSnippet} from "../rentalLocation/rentalLocation.snippets";
import {applyVehicleIndexes} from "./vehicle.indexes";
import {vehicleViews} from "./vehicle.views";

const NoWritePermission = {
    self: {write: "no-permission"},
    others: {write: "no-permission"},
};

export interface IVehicle extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields, IPlatformHiddenPluginFields {
    category: IVehicleCategory;
    make: string;
    model: string;
    year?: number;
    plate: string;
    vin?: string;
    color?: string;
    homeLocation: IRentalLocation;
    /** Where the car is now: its return location after a one-way rental, or a transfer's destination. Unset means at home. */
    currentLocation?: IRentalLocation;
    readiness: VehicleReadiness;
    status: VehicleStatus;
    odometerKm?: number;
    notes?: string;
    images: IMedia[];
    videos: IMedia[];
    acquiredAt?: Date;
    purchasePrice?: number;
    /** Identifier of the GPS tracker fitted to this car. Staff type it; the pings fill in the position. */
    trackerId?: string;
    lastLatitude?: number;
    lastLongitude?: number;
    lastReportedAt?: Date;
    /** Rented on its own (D198): customers can book this exact car. */
    listedAlone: boolean;
    listingTitle?: string;
    listingDescription?: string;
    /** Public photos without the plate; empty: the group's. */
    listingImages: IMedia[];
    /** Its own price list (all of it, when `dailyRate` is set) and deposit; see armonia `effectiveVehicleRates`. */
    dailyRate?: number;
    weekendDailyRate?: number;
    weeklyRate?: number;
    rateSeasons: IVehicleCategorySeason[];
    depositAmount?: number;
    /** Its own specs where they differ from its category's (TD-B291). */
    seats?: number;
    doors?: number;
    luggage?: number;
    transmission?: (typeof VEHICLE_TRANSMISSIONS)[number];
    fuelType?: (typeof VEHICLE_FUEL_TYPES)[number];
    /** Copied from the latest completed VehicleMaintenance record by `syncVehicleServiceDue`. */
    nextServiceDueAt?: Date;
    nextServiceDueKm?: number;
    /** Set once the fleet reminder job has warned about the current due date/km; cleared when they change. */
    serviceReminderSentAt?: Date;
    /**
     * Bumped inside every transaction that books, blocks or reassigns this vehicle.
     * Two such transactions write the same document, so MongoDB lets only one commit
     * and the other retries and sees the first one's booking. Never read for logic.
     */
    allocationVersion: number;
}

const VehicleSchema = new Schema<IVehicle>(
    {
        category: {
            type: SchemaTypes.ObjectId,
            ref: "VehicleCategory",
            required: true,
            refAllowlist: VehicleCategoryPricedSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ["name"]
            },
        },
        make: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: VEHICLE_MAKE_MAX,
        },
        model: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: VEHICLE_MODEL_MAX,
        },
        year: {
            type: SchemaTypes.Number,
            ...VEHICLE_YEAR
        },
        plate: {
            type: SchemaTypes.String,
            required: true,
            trim: true,
            uppercase: true,
            minlength: 1,
            maxlength: VEHICLE_PLATE_MAX,
        },
        vin: {
            type: SchemaTypes.String,
            trim: true,
            uppercase: true,
            maxlength: VEHICLE_VIN_MAX,
            dynamicTableConfiguration: {
                hideColumn: true
            },
        },
        color: {
            type: SchemaTypes.String,
            trim: true,
            maxlength: VEHICLE_COLOR_MAX,
        },
        homeLocation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalLocation",
            required: true,
            refAllowlist: RentalLocationSimpleSnippet,
            dynamicTableConfiguration: {
                refDisplayKey: ["name"]
            },
        },
        readiness: {
            type: SchemaTypes.String,
            enum: VEHICLE_READINESS,
            default: "ready",
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                },
            },
            dynamicTableConfiguration: {
                enumTones: {
                    ready: "success",
                    needs_cleaning: "warning",
                    needs_check: "danger",
                },
            },
        },
        currentLocation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalLocation",
            refAllowlist: RentalLocationSimpleSnippet,
            permissions: {
                self: {
                    write: "no-permission"
                },
                others: {
                    write: "no-permission"
                },
            },
            dynamicTableConfiguration: {
                refDisplayKey: ["name"]
            },
        },
        status: {
            type: SchemaTypes.String,
            enum: VEHICLE_STATUSES,
            required: true,
            default: "active",
            dynamicTableConfiguration: {
                enumTones: {
                    active: "success",
                    maintenance: "warning",
                    retired: "neutral",
                },
            },
        },
        odometerKm: {
            type: SchemaTypes.Number,
            min: 0
        },
        notes: {
            type: SchemaTypes.String,
            maxlength: VEHICLE_NOTES_MAX,
            dynamicTableConfiguration: {
                hideColumn: true
            },
        },
        images: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                sortable: false,
                filterable: false,
                hideColumn: true,
            },
        },
        videos: {
            type: [{
                type: SchemaTypes.ObjectId,
                ref: "Media"
            }],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                sortable: false,
                filterable: false,
                hideColumn: true,
            },
        },
        acquiredAt: {
            type: SchemaTypes.Date,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE,
                hideColumn: true,
            },
        },
        purchasePrice: {
            type: SchemaTypes.Number,
            min: 0,
            dynamicTableConfiguration: {
                hideColumn: true
            },
        },
        trackerId: {
            type: SchemaTypes.String,
            trim: true,
            maxlength: 64,
            // Technical columns open hidden (UX-03); staff can still add them.
            dynamicTableConfiguration: {visible: false},
        },
        lastLatitude: {
            type: SchemaTypes.Number,
            min: -90,
            max: 90,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {visible: false},
        },
        lastLongitude: {
            type: SchemaTypes.Number,
            min: -180,
            max: 180,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {visible: false},
        },
        lastReportedAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
        },
        listedAlone: {type: SchemaTypes.Boolean, default: false},
        listingTitle: {type: SchemaTypes.String, trim: true, maxlength: VEHICLE_LISTING_TITLE_MAX},
        listingDescription: {
            type: SchemaTypes.String,
            maxlength: VEHICLE_LISTING_DESCRIPTION_MAX,
            dynamicTableConfiguration: {hideColumn: true},
        },
        listingImages: {
            type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
            default: [],
            refAllowlist: MediaSimpleSnippet,
            dynamicTableConfiguration: {
                sortable: false,
                filterable: false,
                hideColumn: true,
            },
        },
        dailyRate: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {currencyPath: "currency"}},
        weekendDailyRate: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {currencyPath: "currency", visible: false}},
        weeklyRate: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {currencyPath: "currency", visible: false}},
        rateSeasons: {
            type: [
                {
                    _id: false,
                    startDate: {type: SchemaTypes.String, required: true},
                    endDate: {type: SchemaTypes.String, required: true},
                    dailyRate: {type: SchemaTypes.Number, required: true, min: 0},
                },
            ],
            default: [],
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false,
                sortable: false,
            },
        },
        depositAmount: {type: SchemaTypes.Number, min: 0, dynamicTableConfiguration: {currencyPath: "currency", visible: false}},
        seats: {type: SchemaTypes.Number, ...VEHICLE_SEATS, dynamicTableConfiguration: {visible: false}},
        doors: {type: SchemaTypes.Number, ...VEHICLE_DOORS, dynamicTableConfiguration: {visible: false}},
        luggage: {type: SchemaTypes.Number, ...VEHICLE_LUGGAGE, dynamicTableConfiguration: {visible: false}},
        transmission: {type: SchemaTypes.String, enum: VEHICLE_TRANSMISSIONS, dynamicTableConfiguration: {visible: false}},
        fuelType: {type: SchemaTypes.String, enum: VEHICLE_FUEL_TYPES, dynamicTableConfiguration: {visible: false}},
        nextServiceDueAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                cellType: COLUMN_TYPE.DATE
            },
        },
        nextServiceDueKm: {
            type: SchemaTypes.Number,
            permissions: NoWritePermission,
        },
        serviceReminderSentAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false
            },
        },
        allocationVersion: {
            type: SchemaTypes.Number,
            default: 0,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                hideColumn: true,
                filterable: false
            },
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(VehicleSchema);
// A car rented on its own is a public item the platform may hide after a report (D191, D198).
platformHiddenPlugin(VehicleSchema);
// Only `listingImages` is public: the car's own photos show the plate.
publicMediaPlugin(VehicleSchema, {schemaDef: VehicleSchemaDef});
auditPlugin(VehicleSchema);
softDeletePlugin(VehicleSchema);
lifeCyclePlugin(VehicleSchema);
applyVehicleIndexes(VehicleSchema);
const Vehicle = model<IVehicle>("Vehicle", VehicleSchema);
normalizeSchemaPermissions(Vehicle);
export default Vehicle;

addModelData(Vehicle, vehicleViews);
validateSchemaDefAgainstMongoose(VehicleSchema, VehicleSchemaDef, "Vehicle");
