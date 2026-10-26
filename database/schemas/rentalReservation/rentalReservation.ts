import {Document, model, Schema, SchemaTypes, Types} from "mongoose";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IUser} from "@coreModule/database/schemas/user/user";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {
    RENTAL_CANCELLED_BY,
    RENTAL_FUEL_LEVELS,
    RENTAL_PAYMENT_CHOICES,
    RENTAL_PAYMENT_STATUSES,
    RENTAL_PRICE_LINE_KINDS,
    RENTAL_RESERVATION_SOURCES,
    RENTAL_RESERVATION_STATUSES,
    RENTAL_TIMELINE_EVENTS,
    type RentalPaymentChoice,
    type RentalPaymentStatus,
    type RentalPriceLineKind,
    type RentalReservationStatus,
    type RentalTimelineEvent,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import {RENTAL_EXTRA_PRICINGS, type RentalExtraPricing} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.schema-def";
import type {IVehicleCategory} from "../vehicleCategory/vehicleCategory";
import type {IVehicle} from "../vehicle/vehicle";
import type {IRentalLocation} from "../rentalLocation/rentalLocation";
import type {IRentalExtra} from "../rentalExtra/rentalExtra";
import {VehicleCategorySimpleSnippet} from "../vehicleCategory/vehicleCategory.snippets";
import {VehicleSimpleSnippet} from "../vehicle/vehicle.snippets";
import {RentalLocationSimpleSnippet} from "../rentalLocation/rentalLocation.snippets";
import {RentalExtraSimpleSnippet} from "../rentalExtra/rentalExtra.snippets";
import {applyRentalReservationIndexes} from "./rentalReservation.indexes";
import {rentalReservationViews} from "./rentalReservation.views";

/** Server-managed: written only by the reservation service and its actions. */
const NoWritePermission = {self: {write: "no-permission"}, others: {write: "no-permission"}};

export type IRentalPriceLine = {label: string; kind: RentalPriceLineKind; quantity: number; unitPrice: number; total: number};

export type IRentalPricing = {
    rentalDays: number;
    currency: ICurrency | Types.ObjectId;
    lines: IRentalPriceLine[];
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    pricesIncludeVat: boolean;
    grandTotal: number;
    depositAmount: number;
};

export type IRentalReservationExtra = {
    extra: IRentalExtra | Types.ObjectId;
    name: string;
    pricing: RentalExtraPricing;
    unitPrice: number;
    quantity: number;
    total: number;
};

export type IRentalReservationSnapshot = {
    categoryName: string;
    vehicleLabel?: string;
    pickupLocationName: string;
    pickupAddress?: string;
    returnLocationName: string;
    returnAddress?: string;
    timezone: string;
    mileagePolicy: string;
    includedKmPerDay?: number;
    extraKmPrice?: number;
};

export type IRentalVehicleCheck = {
    at: Date;
    by?: IUser | Types.ObjectId;
    odometerKm: number;
    fuelLevel: (typeof RENTAL_FUEL_LEVELS)[number];
    notes?: string;
};

export interface IRentalReservation extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    number: string;
    status: RentalReservationStatus;
    source: (typeof RENTAL_RESERVATION_SOURCES)[number];
    /** Where an online booking was made: the company's own site or the central portal. Emails link back there. */
    bookedVia: "site" | "portal";
    category: IVehicleCategory;
    vehicle: IVehicle;
    pickupLocation: IRentalLocation;
    returnLocation: IRentalLocation;
    pickupAt: Date;
    returnAt: Date;
    /** `returnAt` plus the turnaround buffer: the end of the time the vehicle is busy. */
    blockedUntil: Date;
    holdExpiresAt?: Date;
    customer?: IUser;
    contact: {firstName: string; lastName: string; email: string; phone: string};
    extras: IRentalReservationExtra[];
    pricing: IRentalPricing;
    snapshot: IRentalReservationSnapshot;
    policy: {freeCancellationHours: number; cancellationFeePercent: number; termsVersion?: string};
    paymentChoice: RentalPaymentChoice;
    paymentStatus: RentalPaymentStatus;
    amountPaid: number;
    stripePaymentIntentId?: string;
    notes?: string;
    idempotencyKey: string;
    handover?: IRentalVehicleCheck;
    returnInfo?: IRentalVehicleCheck & {damageNoted: boolean};
    timeline: {event: RentalTimelineEvent; at: Date; by?: Types.ObjectId; note?: string}[];
    cancelledAt?: Date;
    cancelledBy?: (typeof RENTAL_CANCELLED_BY)[number];
    cancellationReason?: string;
    /** Bumped to invalidate every guest "manage booking" link issued before. */
    manageTokenVersion: number;
    confirmationSentAt?: Date;
    pickupReminderSentAt?: Date;
}

const priceLineSchema = {
    _id: false,
    label: {type: SchemaTypes.String, required: true},
    kind: {type: SchemaTypes.String, enum: RENTAL_PRICE_LINE_KINDS, required: true},
    quantity: {type: SchemaTypes.Number, required: true},
    unitPrice: {type: SchemaTypes.Number, required: true},
    total: {type: SchemaTypes.Number, required: true},
};

const vehicleCheckSchema = {
    at: {type: SchemaTypes.Date, required: true},
    by: {type: SchemaTypes.ObjectId, ref: "User"},
    odometerKm: {type: SchemaTypes.Number, required: true, min: 0},
    fuelLevel: {type: SchemaTypes.String, enum: RENTAL_FUEL_LEVELS, required: true},
    notes: {type: SchemaTypes.String},
};

const RentalReservationSchema = new Schema<IRentalReservation>(
    {
        number: {type: SchemaTypes.String, required: true, immutable: true, permissions: NoWritePermission},
        status: {
            type: SchemaTypes.String,
            enum: RENTAL_RESERVATION_STATUSES,
            required: true,
            // Writable by permission only so roles can be granted the lifecycle actions
            // (they gate on write:status); the CRUD edit route itself changes nothing.
            dynamicTableConfiguration: {
                enumTones: {
                    held: "warning",
                    confirmed: "info",
                    in_progress: "success",
                    completed: "neutral",
                    cancelled: "danger",
                    expired: "neutral",
                    no_show: "danger",
                },
            },
        },
        source: {type: SchemaTypes.String, enum: RENTAL_RESERVATION_SOURCES, required: true, immutable: true, permissions: NoWritePermission},
        bookedVia: {type: SchemaTypes.String, enum: ["site", "portal"], default: "site", immutable: true, permissions: NoWritePermission},
        category: {
            type: SchemaTypes.ObjectId,
            ref: "VehicleCategory",
            required: true,
            immutable: true,
            refAllowlist: VehicleCategorySimpleSnippet,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        vehicle: {
            type: SchemaTypes.ObjectId,
            ref: "Vehicle",
            required: true,
            refAllowlist: VehicleSimpleSnippet,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {refDisplayKey: ["plate", "make", "model"]},
        },
        pickupLocation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalLocation",
            required: true,
            immutable: true,
            refAllowlist: RentalLocationSimpleSnippet,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        returnLocation: {
            type: SchemaTypes.ObjectId,
            ref: "RentalLocation",
            required: true,
            immutable: true,
            refAllowlist: RentalLocationSimpleSnippet,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        pickupAt: {type: SchemaTypes.Date, required: true, permissions: NoWritePermission, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        returnAt: {type: SchemaTypes.Date, required: true, permissions: NoWritePermission, dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME}},
        blockedUntil: {type: SchemaTypes.Date, required: true, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true}},
        holdExpiresAt: {type: SchemaTypes.Date, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true, cellType: COLUMN_TYPE.DATETIME}},
        customer: {
            type: SchemaTypes.ObjectId,
            ref: "User",
            immutable: true,
            refAllowlist: SimpleBlankUserSnippet,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {refDisplayKey: ["name", "surname"]},
        },
        contact: {
            type: {
                firstName: {type: SchemaTypes.String, required: true, trim: true},
                lastName: {type: SchemaTypes.String, required: true, trim: true},
                email: {type: SchemaTypes.String, required: true, trim: true, lowercase: true},
                phone: {type: SchemaTypes.String, required: true, trim: true},
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        extras: {
            type: [{
                _id: false,
                extra: {type: SchemaTypes.ObjectId, ref: "RentalExtra", refAllowlist: RentalExtraSimpleSnippet},
                name: {type: SchemaTypes.String, required: true},
                pricing: {type: SchemaTypes.String, enum: RENTAL_EXTRA_PRICINGS, required: true},
                unitPrice: {type: SchemaTypes.Number, required: true},
                quantity: {type: SchemaTypes.Number, required: true},
                total: {type: SchemaTypes.Number, required: true},
            }],
            default: [],
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        pricing: {
            type: {
                rentalDays: {type: SchemaTypes.Number, required: true},
                currency: {type: SchemaTypes.ObjectId, ref: "Currency", required: true, refAllowlist: CurrencySimpleSnippet},
                lines: {type: [priceLineSchema], default: []},
                subtotal: {type: SchemaTypes.Number, required: true},
                vatRate: {type: SchemaTypes.Number, required: true},
                vatAmount: {type: SchemaTypes.Number, required: true},
                pricesIncludeVat: {type: SchemaTypes.Boolean, required: true},
                grandTotal: {type: SchemaTypes.Number, required: true},
                depositAmount: {type: SchemaTypes.Number, required: true, default: 0},
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        snapshot: {
            type: {
                categoryName: {type: SchemaTypes.String, required: true},
                vehicleLabel: {type: SchemaTypes.String},
                pickupLocationName: {type: SchemaTypes.String, required: true},
                pickupAddress: {type: SchemaTypes.String},
                returnLocationName: {type: SchemaTypes.String, required: true},
                returnAddress: {type: SchemaTypes.String},
                timezone: {type: SchemaTypes.String, required: true},
                mileagePolicy: {type: SchemaTypes.String, required: true},
                includedKmPerDay: {type: SchemaTypes.Number},
                extraKmPrice: {type: SchemaTypes.Number},
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        policy: {
            type: {
                freeCancellationHours: {type: SchemaTypes.Number, required: true},
                cancellationFeePercent: {type: SchemaTypes.Number, required: true},
                termsVersion: {type: SchemaTypes.String},
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        paymentChoice: {type: SchemaTypes.String, enum: RENTAL_PAYMENT_CHOICES, required: true, permissions: NoWritePermission},
        paymentStatus: {
            type: SchemaTypes.String,
            enum: RENTAL_PAYMENT_STATUSES,
            required: true,
            default: "unpaid",
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                enumTones: {unpaid: "warning", pending: "info", paid: "success", partially_refunded: "warning", refunded: "neutral", failed: "danger"},
            },
        },
        // Writable by permission only: recording a payment gates on write:amountPaid.
        amountPaid: {type: SchemaTypes.Number, default: 0},
        stripePaymentIntentId: {type: SchemaTypes.String, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true}},
        notes: {type: SchemaTypes.String, dynamicTableConfiguration: {hideColumn: true}},
        idempotencyKey: {type: SchemaTypes.String, required: true, immutable: true, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true, filterable: false}},
        handover: {
            type: vehicleCheckSchema,
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        returnInfo: {
            type: {...vehicleCheckSchema, damageNoted: {type: SchemaTypes.Boolean, default: false}},
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        timeline: {
            type: [{
                _id: false,
                event: {type: SchemaTypes.String, enum: RENTAL_TIMELINE_EVENTS, required: true},
                at: {type: SchemaTypes.Date, required: true},
                by: {type: SchemaTypes.ObjectId, ref: "User"},
                note: {type: SchemaTypes.String},
            }],
            default: [],
            permissions: NoWritePermission,
            dynamicTableConfiguration: {filterable: false, sortable: false, hideColumn: true},
        },
        cancelledAt: {type: SchemaTypes.Date, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true, cellType: COLUMN_TYPE.DATETIME}},
        cancelledBy: {type: SchemaTypes.String, enum: RENTAL_CANCELLED_BY, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true}},
        cancellationReason: {type: SchemaTypes.String, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true}},
        manageTokenVersion: {type: SchemaTypes.Number, default: 1, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true, filterable: false}},
        confirmationSentAt: {type: SchemaTypes.Date, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true}},
        pickupReminderSentAt: {type: SchemaTypes.Date, permissions: NoWritePermission, dynamicTableConfiguration: {hideColumn: true}},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalReservationSchema);
auditPlugin(RentalReservationSchema);
softDeletePlugin(RentalReservationSchema);
lifeCyclePlugin(RentalReservationSchema);
applyRentalReservationIndexes(RentalReservationSchema);
const RentalReservation = model<IRentalReservation>("RentalReservation", RentalReservationSchema);
normalizeSchemaPermissions(RentalReservation);
export default RentalReservation;

addModelData(RentalReservation, rentalReservationViews);
