import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {RentalPaymentChoice} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {RentalPaymentPolicy} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.schema-def";
import {CARD_PAYMENTS_AVAILABLE} from "armonia/src/modules/finance/helpers/cardPaymentAvailability";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import VehicleCategory, {
    type IVehicleCategory,
} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import RentalExtra, {
    type IRentalExtra,
} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import RentalReservation, {
    type IRentalDriver,
    type IRentalReservation,
} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {rentalExtraService} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.service";
import type {CreateInput} from "@coreModule/database/services/baseCrudService";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import type {IRentalPromoCode} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import {
    applyDiscount,
    computeRentalQuote,
    rentalDaysBetween,
    storedAmount,
    storedPricing,
    totalsFor,
    type QuoteDiscount,
    type QuoteFee,
    type RentalQuoteResult,
} from "@carRentalModule/utilities/services/rentalQuote";
import {assertCustomerAllowed} from "@carRentalModule/utilities/services/rentalDeny";
import {assertDriverList, driverFees} from "@carRentalModule/utilities/services/rentalDrivers";
import {
    assertPromoApplies,
    consumePromoCode,
    findPromoCode,
    promoDiscount,
} from "@carRentalModule/utilities/services/rentalPromo";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";
import {
    busyUntil,
    busyVehicleIds,
    freeVehiclesInCategory,
    lockVehicle,
    needsTransferFor,
} from "@carRentalModule/utilities/services/rentalAvailability";
import {formatPostalAddress} from "@coreModule/utilities/helpers/postalAddress";
import {currencyDecimalPlaces} from "@financeModule/utilities/services/currencyDecimals";
import type {RentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {notHiddenByPlatform} from "@coreModule/database/plugins/platformHiddenPlugin";

const MINUTE = 60 * 1000;
/** A quote the customer saw may differ from the server's by rounding only. */
const PRICE_TOLERANCE = 0.005;

export type RentalExtraSelection = {extra: string; quantity: number};

type Ctx = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    auditUserId?: string | ObjectId;
};

/** The category a booking is for: live, and public (and not hidden by the platform, D191) when booked online. */
export async function loadBookableCategory(
    companyId: ObjectId,
    categoryId: string,
    ctx: {languageCode: string; online: boolean; session?: ClientSession},
): Promise<IVehicleCategory> {
    const category = ObjectId.isValid(categoryId)
        ? await vehicleCategoryService.findOne(
              {
                  _id: new ObjectId(categoryId),
                  company: companyId,
                  deletedAt: null,
                  ...(ctx.online ? {isPublic: true, ...notHiddenByPlatform()} : {}),
              },
              {session: ctx.session},
          )
        : null;
    if (!category)
        throw apiValidationException(
            "vehicle_category_not_found",
            "",
            null,
            ctx.languageCode,
        );
    return category;
}

/** Active extras for a selection, with the quantity rules checked. */
export async function loadSelectedExtras(
    companyId: ObjectId,
    selections: RentalExtraSelection[],
    ctx: {languageCode: string; session?: ClientSession},
): Promise<{extra: IRentalExtra; quantity: number}[]> {
    if (!selections.length) return [];
    const ids = selections.map((selection) => selection.extra);
    const extras = ids.every((id) => ObjectId.isValid(id))
        ? await rentalExtraService.find(
              {
                  _id: {$in: ids.map((id) => new ObjectId(id))},
                  company: companyId,
                  isActive: true,
                  deletedAt: null,
              },
              {session: ctx.session},
          )
        : [];
    const byId = new Map(extras.map((extra) => [String(extra._id), extra]));
    const selected = selections.map(({extra: id, quantity}) => {
        const extra = byId.get(id);
        if (!extra)
            throw apiValidationException(
                "rental_extra_not_found",
                "",
                null,
                ctx.languageCode,
            );
        if (quantity > extra.maxQuantity) {
            throw apiValidationException(
                "rental_extra_quantity_exceeded",
                "",
                null,
                ctx.languageCode,
                [String(extra.maxQuantity), extra.name],
            );
        }
        return {extra, quantity};
    });
    if (
        selected.filter(
            ({extra, quantity}) => extra.kind === "protection" && quantity > 0,
        ).length > 1 ||
        selected.some(
            ({extra, quantity}) => extra.kind === "protection" && quantity > 1,
        )
    ) {
        throw apiValidationException(
            "rental_protection_one_only",
            "",
            null,
            ctx.languageCode,
        );
    }
    return selected;
}

/**
 * The promo code a customer typed, checked against the trip; `undefined` when none
 * was given. `email` enables the per-customer limit.
 */
export async function loadApplicablePromo(
    companyId: ObjectId,
    code: string | undefined,
    input: {
        config: ICarRentalConfig;
        category: IVehicleCategory;
        trip: Pick<RentalTrip, "pickupAt" | "returnAt" | "pickupLocation">;
        email?: string;
        now?: Date;
    },
    ctx: {languageCode: string; session?: ClientSession},
): Promise<IRentalPromoCode | undefined> {
    if (!code?.trim()) return undefined;
    const promo = await findPromoCode(companyId, code, ctx);
    const {timezone} = input.trip.pickupLocation;
    await assertPromoApplies(
        promo,
        {
            today: localDateOf(input.now ?? new Date(), timezone),
            pickupDate: localDateOf(input.trip.pickupAt, timezone),
            rentalDays: rentalDaysBetween(
                input.trip.pickupAt,
                input.trip.returnAt,
                input.config.lateGraceMinutes,
            ),
            categoryId: input.category._id,
            email: input.email,
        },
        ctx,
    );
    return promo;
}

export type TripPricingOptions = {
    /** Language of the fee and discount line labels. */
    languageCode: string;
    /** Who drives: priced with the young-driver and additional-driver fees. */
    drivers?: Pick<
        IRentalDriver,
        "role" | "firstName" | "lastName" | "birthDate"
    >[];
    /** Already checked with `loadApplicablePromo`. */
    promo?: IRentalPromoCode;
    /** The customer is taking the car out of the country. Refused when the category does not allow it. */
    crossBorder?: boolean;
    /** A business account's discount, applied after the promo code and capped to the rental lines. */
    accountDiscount?: QuoteDiscount;
    /** Replaces the rental-day lines with one line of this amount. Subscriptions bill a fixed period price. */
    rentalPrice?: number;
    /** The booking currency's `decimalPlaces`, where amounts are rounded (default 2, TD-B30). */
    decimalPlaces?: number;
};

/**
 * The quote for a trip, from current prices and settings: rental days, extras, a
 * promo discount, driver fees and the one-way fee when the car is returned at
 * another location. A protection package replaces the category deposit.
 */
export function quoteTrip(
    config: ICarRentalConfig,
    category: IVehicleCategory,
    extras: {extra: IRentalExtra; quantity: number}[],
    trip: Pick<
        RentalTrip,
        "pickupAt" | "returnAt" | "pickupLocation" | "returnLocation"
    >,
    options: TripPricingOptions,
): RentalQuoteResult {
    const {languageCode} = options;
    const pickupDate = localDateOf(trip.pickupAt, trip.pickupLocation.timezone);
    const fees: QuoteFee[] = driverFees(
        options.drivers ?? [],
        config,
        pickupDate,
        languageCode,
    );
    if (String(trip.returnLocation._id) !== String(trip.pickupLocation._id)) {
        const amount = trip.returnLocation.oneWayFee ?? config.oneWayFee ?? 0;
        fees.push({
            label: rentalPricingLabel(languageCode, "oneWay"),
            code: "one_way",
            amount,
            perDay: false,
        });
    }
    if (options.crossBorder) {
        if (category.crossBorderAllowed === false) {
            throw apiValidationException(
                "rental_cross_border_not_allowed",
                "",
                null,
                languageCode,
            );
        }
        const amount = category.crossBorderFee ?? 0;
        fees.push({
            label: rentalPricingLabel(languageCode, "crossBorder"),
            code: "cross_border",
            amount,
            perDay: false,
        });
    }
    const protection = extras.find(
        ({extra}) => extra.kind === "protection",
    )?.extra;
    let quote = computeRentalQuote({
        category,
        extras: extras.map(({extra, quantity}) => ({
            name: extra.name,
            pricing: extra.pricing,
            price: extra.price,
            quantity,
        })),
        pickupAt: trip.pickupAt,
        returnAt: trip.returnAt,
        timeZone: trip.pickupLocation.timezone,
        settings: {
            vatRate: config.vatRate,
            pricesIncludeVat: config.pricesIncludeVat,
            lateGraceMinutes: config.lateGraceMinutes,
            decimalPlaces: options.decimalPlaces,
        },
        fees,
        discount: options.promo
            ? promoDiscount(options.promo, languageCode)
            : undefined,
        depositAmount: protection?.depositAmount,
    });
    if (options.rentalPrice !== undefined) {
        const kept = quote.lines.filter(
            (line) => line.kind !== "rental" && line.kind !== "discount",
        );
        const lines = [
            {
                label: category.name,
                kind: "rental" as const,
                quantity: 1,
                unitPrice: options.rentalPrice,
                total: options.rentalPrice,
            },
            ...kept,
        ];
        quote = {
            ...quote,
            lines,
            ...totalsFor(lines, quote.vatRate, quote.pricesIncludeVat, options.decimalPlaces),
        };
        if (options.promo)
            quote = applyDiscount(
                quote,
                promoDiscount(options.promo, languageCode),
                options.decimalPlaces,
            );
    }
    if (options.accountDiscount)
        quote = applyDiscount(quote, options.accountDiscount, options.decimalPlaces);
    return quote;
}

/**
 * The payment policy in force. While card payments are coming soon (D190) every booking
 * is paid at the desk, whatever the company stored; its choice comes back with the switch.
 */
export function effectivePaymentPolicy(
    config: Pick<ICarRentalConfig, "paymentPolicy">,
): RentalPaymentPolicy {
    return CARD_PAYMENTS_AVAILABLE ? config.paymentPolicy : "pay_at_pickup";
}

/**
 * How this booking is paid. The company policy decides unless it leaves the choice
 * to the customer; online payment needs a charge to make.
 */
export function resolvePaymentChoice(
    config: Pick<ICarRentalConfig, "paymentPolicy">,
    requested: RentalPaymentChoice,
    ctx: {
        onlinePaymentAvailable: boolean;
        grandTotal: number;
        languageCode: string;
    },
): RentalPaymentChoice {
    const policy = effectivePaymentPolicy(config);
    const choice: RentalPaymentChoice =
        policy === "pay_at_pickup"
            ? "pay_at_pickup"
            : policy === "prepay_online"
              ? "online"
              : requested;
    if (
        choice === "online" &&
        (!ctx.onlinePaymentAvailable || ctx.grandTotal <= 0)
    ) {
        if (
            policy === "prepay_online" ||
            requested === "online"
        ) {
            throw apiValidationException(
                "rental_online_payment_unavailable",
                "",
                null,
                ctx.languageCode,
            );
        }
        return "pay_at_pickup";
    }
    return choice;
}

function reservationNumber(now: Date): string {
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    return `RR-${datePart}-${crypto.randomBytes(4).toString("hex")}`.toUpperCase();
}

/**
 * Picks a vehicle for the trip and takes its lock: the requested one, or the first
 * free one of the category. Must run inside the caller's transaction; see
 * `lockVehicle` for why the lock makes double booking impossible.
 */
export async function allocateVehicle(
    input: {
        companyId: ObjectId;
        categoryId: ObjectId;
        vehicleId?: string;
        pickupAt: Date;
        blockedUntil: Date;
        preferLocationId: ObjectId;
        excludeReservationId?: ObjectId;
        now: Date;
    },
    ctx: Ctx,
): Promise<ObjectId> {
    const {
        companyId,
        categoryId,
        vehicleId,
        pickupAt,
        blockedUntil,
        preferLocationId,
        excludeReservationId,
        now,
    } = input;
    const window = {
        companyId,
        start: pickupAt,
        end: blockedUntil,
        now,
        excludeReservationId,
        session: ctx.session,
    };

    if (vehicleId) {
        const vehicle = ObjectId.isValid(vehicleId)
            ? await vehicleService.findOne(
                  {_id: new ObjectId(vehicleId), company: companyId, deletedAt: null},
                  {session: ctx.session},
                  undefined,
                  "_id category",
              )
            : null;
        if (!vehicle)
            throw apiValidationException(
                "vehicle_not_found",
                "",
                null,
                ctx.languageCode,
            );
        if (String(vehicle.category) !== String(categoryId)) {
            throw apiValidationException(
                "rental_vehicle_wrong_category",
                "",
                null,
                ctx.languageCode,
            );
        }
        await lockVehicle(vehicle._id, {
            companyId,
            session: ctx.session,
            languageCode: ctx.languageCode,
        });
        const busy = await busyVehicleIds({
            ...window,
            vehicleIds: [vehicle._id],
        });
        if (busy.size)
            throw apiValidationException(
                "vehicle_unavailable",
                "",
                null,
                ctx.languageCode,
            );
        return vehicle._id;
    }

    for (const candidate of await freeVehiclesInCategory({
        ...window,
        categoryId,
        preferLocationId,
    })) {
        await lockVehicle(candidate, {
            companyId,
            session: ctx.session,
            languageCode: ctx.languageCode,
        });
        // Re-checked under the lock: the list above was read before it was taken.
        const busy = await busyVehicleIds({...window, vehicleIds: [candidate]});
        if (!busy.size) return candidate;
    }
    throw apiValidationException(
        "rental_category_unavailable",
        "",
        null,
        ctx.languageCode,
    );
}

export type CreateRentalReservationInput = {
    companyId: ObjectId;
    config: ICarRentalConfig;
    category: IVehicleCategory;
    vehicleId?: string;
    trip: RentalTrip;
    extras: {extra: IRentalExtra; quantity: number}[];
    contact: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
    /** Who may drive. Online bookings name the main driver with a birth date; staff may add licences now or at the counter. */
    drivers?: IRentalDriver[];
    /** Already checked with `loadApplicablePromo`; counted when the booking is made. */
    promo?: IRentalPromoCode;
    customerId?: ObjectId;
    notes?: string;
    idempotencyKey: string;
    source: "online" | "staff";
    paymentChoice: RentalPaymentChoice;
    /** Set when the booking is billed to a business account. */
    businessAccountId?: ObjectId;
    /** Percent off the rental lines, from that account. */
    accountDiscountPercent?: number;
    /** The customer is taking the car out of the country. */
    crossBorder?: boolean;
    /** Replaces the category's rental price. Used by a subscription's period price. */
    rentalPrice?: number;
    /**
     * The booking this one continues on the same car, which is still out with the customer: its turnaround window is
     * not waited for, because the car never comes back in between (a subscription's next period, D127). Set with
     * `vehicleId`.
     */
    continuesReservationId?: ObjectId;
    /** The total the customer was shown; omitted for staff bookings. */
    expectedTotal?: number;
    now?: Date;
};

/**
 * Prices the trip, allocates (and locks) a vehicle, counts the promo code's use
 * and returns the reservation document to insert, inside the caller's
 * transaction. Pay-at-pickup bookings are confirmed at once; online ones are
 * `held` until the payment arrives or `holdMinutes` pass.
 */
export async function buildRentalReservation(
    input: CreateRentalReservationInput,
    ctx: Ctx,
): Promise<CreateInput<IRentalReservation>> {
    const {
        companyId,
        config,
        category,
        trip,
        extras,
        contact,
        idempotencyKey,
        source,
        paymentChoice,
    } = input;
    const now = input.now ?? new Date();

    const drivers = input.drivers ?? [];
    if (drivers.length) {
        assertDriverList(
            drivers,
            {
                pickupDate: localDateOf(
                    trip.pickupAt,
                    trip.pickupLocation.timezone,
                ),
                returnDate: localDateOf(
                    trip.returnAt,
                    trip.returnLocation.timezone,
                ),
                minDriverAge: category.minDriverAge,
            },
            ctx.languageCode,
        );
    }
    await assertCustomerAllowed(
        companyId,
        {
            email: contact.email,
            licenseNumbers: drivers
                .map((driver) => driver.licenseNumber)
                .filter((license): license is string => Boolean(license)),
        },
        ctx,
    );
    const accountDiscount: QuoteDiscount | undefined =
        input.accountDiscountPercent
            ? {
                  label: rentalPricingLabel(ctx.languageCode, "account"),
                  type: "percent",
                  value: input.accountDiscountPercent,
                  code: "account",
              }
            : undefined;
    const currency = nestedEntityToRef(config.currency);
    const decimalPlaces = await currencyDecimalPlaces(currency, ctx.session);
    const quote = quoteTrip(config, category, extras, trip, {
        languageCode: ctx.languageCode,
        drivers,
        promo: input.promo,
        crossBorder: input.crossBorder,
        accountDiscount,
        rentalPrice: input.rentalPrice,
        decimalPlaces,
    });
    if (
        input.expectedTotal !== undefined &&
        Math.abs(input.expectedTotal - quote.grandTotal) > PRICE_TOLERANCE
    ) {
        throw apiValidationException(
            "rental_price_changed",
            "",
            null,
            ctx.languageCode,
        );
    }

    const blockedUntil = busyUntil(
        trip.returnAt,
        config.turnaroundBufferMinutes,
    );
    const vehicleId = await allocateVehicle(
        {
            companyId,
            categoryId: category._id,
            vehicleId: input.vehicleId,
            pickupAt: trip.pickupAt,
            blockedUntil,
            preferLocationId: trip.pickupLocation._id,
            excludeReservationId: input.continuesReservationId,
            now,
        },
        ctx,
    );

    if (input.promo) await consumePromoCode(input.promo, ctx);
    const needsTransfer = await needsTransferFor(
        vehicleId,
        {locationId: trip.pickupLocation._id, at: trip.pickupAt},
        companyId,
        ctx.session,
    );

    const held = paymentChoice === "online";
    return {
        company: companyId,
        number: reservationNumber(now),
        status: held ? "held" : "confirmed",
        source,
        category: category._id,
        vehicle: vehicleId,
        needsTransfer,
        pickupLocation: trip.pickupLocation._id,
        returnLocation: trip.returnLocation._id,
        pickupAt: trip.pickupAt,
        returnAt: trip.returnAt,
        blockedUntil,
        ...(held
            ? {
                  holdExpiresAt: new Date(
                      now.getTime() + config.holdMinutes * MINUTE,
                  ),
              }
            : {}),
        ...(input.customerId ? {customer: input.customerId} : {}),
        contact,
        drivers,
        ...(input.promo
            ? {promoCode: {promo: input.promo._id, code: input.promo.code}}
            : {}),
        ...(input.businessAccountId
            ? {businessAccount: input.businessAccountId}
            : {}),
        crossBorder: input.crossBorder === true,
        extras: extras.map(({extra, quantity}) => ({
            extra: extra._id,
            name: extra.name,
            pricing: extra.pricing,
            unitPrice: storedAmount(extra.price, decimalPlaces),
            quantity,
            total: storedAmount(
                quote.lines.find(
                    (line) =>
                        line.kind === "extra" && line.label === extra.name,
                )?.total ?? 0,
                decimalPlaces,
            ),
        })),
        pricing: storedPricing(quote, currency, decimalPlaces),
        snapshot: {
            categoryName: category.name,
            pickupLocationName: trip.pickupLocation.name,
            pickupAddress: formatPostalAddress(trip.pickupLocation.address),
            returnLocationName: trip.returnLocation.name,
            returnAddress: formatPostalAddress(trip.returnLocation.address),
            timezone: trip.pickupLocation.timezone,
            mileagePolicy: category.mileagePolicy,
            includedKmPerDay: category.includedKmPerDay,
            extraKmPrice: category.extraKmPrice,
        },
        policy: {
            freeCancellationHours: config.freeCancellationHours,
            cancellationFeePercent: config.cancellationFeePercent,
            termsVersion: config.termsVersion,
        },
        paymentChoice,
        paymentStatus: "unpaid",
        amountPaid: storedAmount(0, decimalPlaces),
        notes: input.notes,
        idempotencyKey,
        timeline: [
            {event: "created", at: now},
            ...(held ? [] : [{event: "confirmed" as const, at: now}]),
        ],
        manageTokenVersion: 1,
    };
}

/**
 * Creates a reservation inside the caller's transaction. A request repeated with
 * the same idempotency key returns the reservation it made the first time.
 */
export async function createRentalReservation(
    input: CreateRentalReservationInput,
    ctx: Ctx,
): Promise<{reservation: IRentalReservation; created: boolean}> {
    const existing = await rentalReservationService.findOne(
        {company: input.companyId, idempotencyKey: input.idempotencyKey},
        {session: ctx.session},
    );
    if (existing) return {reservation: existing, created: false};

    const data = await buildRentalReservation(input, ctx);
    const reservation = await rentalReservationService.create(data, {
        session: ctx.session,
        logger: ctx.logger,
        languageCode: ctx.languageCode,
        auditUserId: ctx.auditUserId,
    });
    return {reservation, created: true};
}
