import {Document, model, Schema, SchemaTypes, Types} from "mongoose";
import type {Decimal128} from "mongodb";
import {ICurrency} from "@coreModule/database/schemas/currency/currency";
import {IUser} from "@coreModule/database/schemas/user/user";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {RentalReservationSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.schema-def";
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
import {COLUMN_TYPE} from "armonia/src/modules/core/database/filter/typeOperators";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {IMedia} from "@coreModule/database/schemas/media/media";
import {MediaSimpleSnippet} from "@coreModule/database/schemas/media/media.snippets";
import {
    RENTAL_CANCELLED_BY,
    RENTAL_DEPOSIT_METHODS,
    RENTAL_DEPOSIT_STATUSES,
    RENTAL_DRIVER_ROLES,
    RENTAL_FUEL_LEVELS,
    RENTAL_ID_DOCUMENT_TYPES,
    RENTAL_PAYMENT_CHOICES,
    RENTAL_PAYMENT_STATUSES,
    RENTAL_PRICE_LINE_CODES,
    RENTAL_PRICE_LINE_KINDS,
    RENTAL_RESERVATION_SOURCES,
    RENTAL_RESERVATION_STATUSES,
    RENTAL_TIMELINE_EVENTS,
    type RentalPaymentChoice,
    type RentalPaymentStatus,
    type RentalPriceLineCode,
    type RentalPriceLineKind,
    type RentalReservationStatus,
    type RentalTimelineEvent,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import {
    RENTAL_EXTRA_PRICINGS,
    type RentalExtraPricing,
} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.schema-def";
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
const NoWritePermission = {
    self: {write: "no-permission"},
    others: {write: "no-permission"},
};

export type IRentalPriceLine = {
    label: string;
    kind: RentalPriceLineKind;
    code?: RentalPriceLineCode;
    quantity: number;
    unitPrice: Decimal128;
    total: Decimal128;
};

/** Money is `Decimal128` in `currency` (GLB-08); the DTO maps it to numbers. */
export type IRentalPricing = {
    rentalDays: number;
    currency: ICurrency | Types.ObjectId;
    lines: IRentalPriceLine[];
    subtotal: Decimal128;
    vatRate: number;
    vatAmount: Decimal128;
    pricesIncludeVat: boolean;
    grandTotal: Decimal128;
    depositAmount: Decimal128;
};

export type IRentalReservationExtra = {
    extra: IRentalExtra | Types.ObjectId;
    name: string;
    pricing: RentalExtraPricing;
    unitPrice: Decimal128;
    quantity: number;
    total: Decimal128;
};

export type IRentalReservationSnapshot = {
    categoryName: string;
    /** The exact car's name when it was booked on its own (D198); emails and the agreement name it. */
    vehicleTitle?: string;
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
    photos: (IMedia | Types.ObjectId)[];
};

/**
 * The deposit taken at pickup. A card hold is a manual-capture payment intent; a
 * saved card keeps the gateway customer and card for later off-session charges.
 */
export type IRentalDeposit = {
    method: (typeof RENTAL_DEPOSIT_METHODS)[number];
    status: (typeof RENTAL_DEPOSIT_STATUSES)[number];
    amount: Decimal128;
    capturedAmount: Decimal128;
    intentId?: string;
    setupIntentId?: string;
    stripeCustomerId?: string;
    paymentMethodId?: string;
    heldAt?: Date;
    settledAt?: Date;
};

/** What the customer signed at handover. The PDF is generated on request. */
export type IRentalAgreement = {
    signedAt?: Date;
    signerName?: string;
    signature?: IMedia | Types.ObjectId;
    termsVersion?: string;
};

/** Dates are local calendar dates (`YYYY-MM-DD`), as written on the licence. */
export type IRentalDriver = {
    role: (typeof RENTAL_DRIVER_ROLES)[number];
    firstName: string;
    lastName: string;
    birthDate: string;
    licenseNumber?: string;
    licenseCountry?: string;
    licenseIssuedAt?: string;
    licenseExpiresAt?: string;
    idDocumentType?: (typeof RENTAL_ID_DOCUMENT_TYPES)[number];
    idDocumentNumber?: string;
    /** Licence and identity scans the customer uploaded from the manage page. Absent on drivers saved before this field existed. */
    documents?: Types.ObjectId[];
};

export interface IRentalReservation
    extends
        Document,
        IOwnershipPluginFields,
        ISoftDeletePluginFields,
        ILifeCyclePluginFields {
    number: string;
    status: RentalReservationStatus;
    source: (typeof RENTAL_RESERVATION_SOURCES)[number];
    /** Where an online booking was made: the company's own site or the central portal. Emails link back there. */
    category: IVehicleCategory;
    vehicle: IVehicle;
    /** This exact car was booked, at its own prices (D198): it is guaranteed, never "or similar". */
    exactVehicle: boolean;
    pickupLocation: IRentalLocation;
    returnLocation: IRentalLocation;
    pickupAt: Date;
    returnAt: Date;
    /** `returnAt` plus the turnaround buffer: the end of the time the vehicle is busy. */
    blockedUntil: Date;
    holdExpiresAt?: Date;
    customer?: IUser;
    contact: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
    drivers: IRentalDriver[];
    extras: IRentalReservationExtra[];
    /** The promo code the booking was made with; its use is counted on the code. */
    promoCode?: {promo: Types.ObjectId; code: string};
    pricing: IRentalPricing;
    snapshot: IRentalReservationSnapshot;
    policy: {
        freeCancellationHours: number;
        cancellationFeePercent: number;
        termsVersion?: string;
    };
    paymentChoice: RentalPaymentChoice;
    paymentStatus: RentalPaymentStatus;
    amountPaid: Decimal128;
    stripePaymentIntentId?: string;
    /** Later online payments (the balance, an extension). The first intent stays in `stripePaymentIntentId`. */
    balanceIntentIds: string[];
    businessAccount?: Types.ObjectId;
    /** The customer is taking the car out of the country. */
    crossBorder: boolean;
    notes?: string;
    idempotencyKey: string;
    handover?: IRentalVehicleCheck & {acknowledgedDamages: Types.ObjectId[]};
    returnInfo?: IRentalVehicleCheck & {damageNoted: boolean};
    agreement?: IRentalAgreement;
    deposit?: IRentalDeposit;
    /** The assigned car will not be at the pickup location at pickup time; staff must move it there. */
    needsTransfer: boolean;
    /** How many price lines are on an invoice already; later charges are invoiced from here on. */
    invoicedLineCount: number;
    timeline: {
        event: RentalTimelineEvent;
        at: Date;
        by?: Types.ObjectId;
        note?: string;
    }[];
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
    kind: {
        type: SchemaTypes.String,
        enum: RENTAL_PRICE_LINE_KINDS,
        required: true,
    },
    code: {type: SchemaTypes.String, enum: RENTAL_PRICE_LINE_CODES},
    quantity: {type: SchemaTypes.Number, required: true},
    unitPrice: {type: SchemaTypes.Decimal128, required: true},
    total: {type: SchemaTypes.Decimal128, required: true},
};

const vehicleCheckSchema = {
    at: {type: SchemaTypes.Date, required: true},
    by: {type: SchemaTypes.ObjectId, ref: "User"},
    odometerKm: {type: SchemaTypes.Number, required: true, min: 0},
    fuelLevel: {
        type: SchemaTypes.String,
        enum: RENTAL_FUEL_LEVELS,
        required: true,
    },
    notes: {type: SchemaTypes.String},
    photos: {
        type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
        default: [],
        refAllowlist: MediaSimpleSnippet,
    },
};

const RentalReservationSchema = new Schema<IRentalReservation>(
    {
        number: {
            type: SchemaTypes.String,
            required: true,
            immutable: true,
            permissions: NoWritePermission,
        },
        status: {
            type: SchemaTypes.String,
            enum: RENTAL_RESERVATION_STATUSES,
            required: true,
            // Changed only by the lifecycle actions (each has its own action permission, D14);
            // the CRUD edit route itself changes nothing.
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
        source: {
            type: SchemaTypes.String,
            enum: RENTAL_RESERVATION_SOURCES,
            required: true,
            immutable: true,
            permissions: NoWritePermission,
        },
        // Not immutable: "Change car" may move a booking to a car of another category (D198). No form writes it.
        category: {
            type: SchemaTypes.ObjectId,
            ref: "VehicleCategory",
            required: true,
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
            dynamicTableConfiguration: {
                refDisplayKey: ["plate", "make", "model"],
            },
        },
        exactVehicle: {
            type: SchemaTypes.Boolean,
            default: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                enumTones: {true: "info", false: "neutral"},
            },
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
        pickupAt: {
            type: SchemaTypes.Date,
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME},
        },
        returnAt: {
            type: SchemaTypes.Date,
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {cellType: COLUMN_TYPE.DATETIME},
        },
        blockedUntil: {
            type: SchemaTypes.Date,
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true},
        },
        holdExpiresAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                hideColumn: true,
                cellType: COLUMN_TYPE.DATETIME,
            },
        },
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
                firstName: {
                    type: SchemaTypes.String,
                    required: true,
                    trim: true,
                },
                lastName: {
                    type: SchemaTypes.String,
                    required: true,
                    trim: true,
                },
                email: {
                    type: SchemaTypes.String,
                    required: true,
                    trim: true,
                    lowercase: true,
                },
                phone: {type: SchemaTypes.String, required: true, trim: true},
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        drivers: {
            type: [
                {
                    _id: false,
                    role: {
                        type: SchemaTypes.String,
                        enum: RENTAL_DRIVER_ROLES,
                        required: true,
                    },
                    firstName: {
                        type: SchemaTypes.String,
                        required: true,
                        trim: true,
                    },
                    lastName: {
                        type: SchemaTypes.String,
                        required: true,
                        trim: true,
                    },
                    birthDate: {type: SchemaTypes.String, required: true},
                    licenseNumber: {type: SchemaTypes.String, trim: true},
                    licenseCountry: {type: SchemaTypes.String, trim: true},
                    licenseIssuedAt: {type: SchemaTypes.String},
                    licenseExpiresAt: {type: SchemaTypes.String},
                    idDocumentType: {
                        type: SchemaTypes.String,
                        enum: RENTAL_ID_DOCUMENT_TYPES,
                    },
                    idDocumentNumber: {type: SchemaTypes.String, trim: true},
                    documents: {
                        type: [{type: SchemaTypes.ObjectId, ref: "Media"}],
                        default: [],
                    },
                },
            ],
            default: [],
            // Licence and ID numbers and their scans: identity data (SEC-06), read through the reservation itself.
            sensitivity: "identity",
            // Changed only through the saveDrivers action.
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        extras: {
            type: [
                {
                    _id: false,
                    extra: {
                        type: SchemaTypes.ObjectId,
                        ref: "RentalExtra",
                        refAllowlist: RentalExtraSimpleSnippet,
                    },
                    name: {type: SchemaTypes.String, required: true},
                    pricing: {
                        type: SchemaTypes.String,
                        enum: RENTAL_EXTRA_PRICINGS,
                        required: true,
                    },
                    unitPrice: {type: SchemaTypes.Decimal128, required: true},
                    quantity: {type: SchemaTypes.Number, required: true},
                    total: {type: SchemaTypes.Decimal128, required: true},
                },
            ],
            default: [],
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        promoCode: {
            type: {
                promo: {
                    type: SchemaTypes.ObjectId,
                    ref: "RentalPromoCode",
                    required: true,
                },
                code: {type: SchemaTypes.String, required: true},
            },
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        pricing: {
            type: {
                rentalDays: {type: SchemaTypes.Number, required: true},
                currency: {
                    type: SchemaTypes.ObjectId,
                    ref: "Currency",
                    required: true,
                    refAllowlist: CurrencySimpleSnippet,
                },
                lines: {type: [priceLineSchema], default: []},
                subtotal: {type: SchemaTypes.Decimal128, required: true},
                vatRate: {type: SchemaTypes.Number, required: true},
                vatAmount: {type: SchemaTypes.Decimal128, required: true},
                pricesIncludeVat: {type: SchemaTypes.Boolean, required: true},
                grandTotal: {type: SchemaTypes.Decimal128, required: true},
                depositAmount: {
                    type: SchemaTypes.Decimal128,
                    required: true,
                    default: 0,
                },
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        snapshot: {
            type: {
                categoryName: {type: SchemaTypes.String, required: true},
                vehicleTitle: {type: SchemaTypes.String},
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
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        policy: {
            type: {
                freeCancellationHours: {
                    type: SchemaTypes.Number,
                    required: true,
                },
                cancellationFeePercent: {
                    type: SchemaTypes.Number,
                    required: true,
                },
                termsVersion: {type: SchemaTypes.String},
            },
            required: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        paymentChoice: {
            type: SchemaTypes.String,
            enum: RENTAL_PAYMENT_CHOICES,
            required: true,
            permissions: NoWritePermission,
        },
        balanceIntentIds: {
            type: [SchemaTypes.String],
            default: [],
            permissions: NoWritePermission,
        },
        businessAccount: {
            type: SchemaTypes.ObjectId,
            ref: "RentalBusinessAccount",
            permissions: NoWritePermission,
        },
        crossBorder: {
            type: SchemaTypes.Boolean,
            default: false,
            permissions: NoWritePermission,
        },
        paymentStatus: {
            type: SchemaTypes.String,
            enum: RENTAL_PAYMENT_STATUSES,
            required: true,
            default: "unpaid",
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                enumTones: {
                    unpaid: "warning",
                    pending: "info",
                    paid: "success",
                    partially_refunded: "warning",
                    refunded: "neutral",
                    failed: "danger",
                },
            },
        },
        // Changed only by the payment actions (D14 action permissions).
        amountPaid: {type: SchemaTypes.Decimal128, default: 0, dynamicTableConfiguration: {currencyPath: "pricing.currency"}},
        stripePaymentIntentId: {
            type: SchemaTypes.String,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true},
        },
        notes: {
            type: SchemaTypes.String,
            dynamicTableConfiguration: {hideColumn: true},
        },
        idempotencyKey: {
            type: SchemaTypes.String,
            required: true,
            immutable: true,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true, filterable: false},
        },
        handover: {
            type: {
                ...vehicleCheckSchema,
                acknowledgedDamages: {
                    type: [{type: SchemaTypes.ObjectId, ref: "VehicleDamage"}],
                    default: [],
                },
            },
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        returnInfo: {
            type: {
                ...vehicleCheckSchema,
                damageNoted: {type: SchemaTypes.Boolean, default: false},
            },
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        deposit: {
            type: {
                method: {
                    type: SchemaTypes.String,
                    enum: RENTAL_DEPOSIT_METHODS,
                    required: true,
                },
                status: {
                    type: SchemaTypes.String,
                    enum: RENTAL_DEPOSIT_STATUSES,
                    required: true,
                },
                amount: {type: SchemaTypes.Decimal128, required: true},
                capturedAmount: {type: SchemaTypes.Decimal128, default: 0},
                intentId: {type: SchemaTypes.String},
                setupIntentId: {type: SchemaTypes.String},
                stripeCustomerId: {type: SchemaTypes.String},
                paymentMethodId: {type: SchemaTypes.String},
                heldAt: {type: SchemaTypes.Date},
                settledAt: {type: SchemaTypes.Date},
            },
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        agreement: {
            type: {
                signedAt: {type: SchemaTypes.Date},
                signerName: {type: SchemaTypes.String, trim: true},
                signature: {
                    type: SchemaTypes.ObjectId,
                    ref: "Media",
                    refAllowlist: MediaSimpleSnippet,
                },
                termsVersion: {type: SchemaTypes.String},
            },
            required: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        timeline: {
            type: [
                {
                    _id: false,
                    event: {
                        type: SchemaTypes.String,
                        enum: RENTAL_TIMELINE_EVENTS,
                        required: true,
                    },
                    at: {type: SchemaTypes.Date, required: true},
                    by: {type: SchemaTypes.ObjectId, ref: "User"},
                    note: {type: SchemaTypes.String},
                },
            ],
            default: [],
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                filterable: false,
                sortable: false,
                hideColumn: true,
            },
        },
        cancelledAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                hideColumn: true,
                cellType: COLUMN_TYPE.DATETIME,
            },
        },
        cancelledBy: {
            type: SchemaTypes.String,
            enum: RENTAL_CANCELLED_BY,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true},
        },
        cancellationReason: {
            type: SchemaTypes.String,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true},
        },
        manageTokenVersion: {
            type: SchemaTypes.Number,
            default: 1,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true, filterable: false},
        },
        needsTransfer: {
            type: SchemaTypes.Boolean,
            default: false,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {
                enumTones: {true: "warning", false: "neutral"},
            },
        },
        invoicedLineCount: {
            type: SchemaTypes.Number,
            default: 0,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true, filterable: false},
        },
        confirmationSentAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true},
        },
        pickupReminderSentAt: {
            type: SchemaTypes.Date,
            permissions: NoWritePermission,
            dynamicTableConfiguration: {hideColumn: true},
        },
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalReservationSchema);
auditPlugin(RentalReservationSchema);
softDeletePlugin(RentalReservationSchema);
lifeCyclePlugin(RentalReservationSchema);
applyRentalReservationIndexes(RentalReservationSchema);
const RentalReservation = model<IRentalReservation>(
    "RentalReservation",
    RentalReservationSchema,
);
normalizeSchemaPermissions(RentalReservation);
export default RentalReservation;

addModelData(RentalReservation, rentalReservationViews);
// Server-owned: computed from the request (times, prices, snapshot, policy) or moved by the actions.
validateSchemaDefAgainstMongoose(RentalReservationSchema, RentalReservationSchemaDef, "RentalReservation", [
    "status", "pickupAt", "returnAt", "blockedUntil", "pricing", "snapshot", "policy", "paymentStatus",
]);
