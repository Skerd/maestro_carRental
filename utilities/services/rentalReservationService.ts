import * as crypto from "crypto";
import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {RentalPaymentChoice} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import VehicleCategory, {type IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import RentalExtra, {type IRentalExtra} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import RentalReservation, {type IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import type {CreateInput} from "@coreModule/database/services/baseCrudService";
import {computeRentalQuote, type RentalQuoteResult} from "./rentalQuote";
import {busyUntil, busyVehicleIds, freeVehiclesInCategory, lockVehicle} from "./rentalAvailability";
import {formatPostalAddress} from "@coreModule/utilities/helpers/postalAddress";
import type {RentalTrip} from "./rentalTrip";

const MINUTE = 60 * 1000;
/** A quote the customer saw may differ from the server's by rounding only. */
const PRICE_TOLERANCE = 0.005;

export type RentalExtraSelection = {extra: string; quantity: number};

type Ctx = {session: ClientSession; logger: serverLogger; languageCode: string; auditUserId?: string | ObjectId};

/** The category a booking is for: live, and public when booked online. */
export async function loadBookableCategory(
    companyId: ObjectId,
    categoryId: string,
    ctx: {languageCode: string; online: boolean; session?: ClientSession},
): Promise<IVehicleCategory> {
    const category = ObjectId.isValid(categoryId)
        ? await VehicleCategory.findOne({
            _id: new ObjectId(categoryId),
            company: companyId,
            deletedAt: null,
            ...(ctx.online ? {isPublic: true} : {}),
        }).session(ctx.session ?? null)
        : null;
    if (!category) throw apiValidationException("vehicle_category_not_found", "", null, ctx.languageCode);
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
        ? await RentalExtra.find({_id: {$in: ids.map((id) => new ObjectId(id))}, company: companyId, isActive: true, deletedAt: null})
            .session(ctx.session ?? null)
        : [];
    const byId = new Map(extras.map((extra) => [String(extra._id), extra]));
    return selections.map(({extra: id, quantity}) => {
        const extra = byId.get(id);
        if (!extra) throw apiValidationException("rental_extra_not_found", "", null, ctx.languageCode);
        if (quantity > extra.maxQuantity) {
            throw apiValidationException("rental_extra_quantity_exceeded", "", null, ctx.languageCode, [String(extra.maxQuantity), extra.name]);
        }
        return {extra, quantity};
    });
}

/** The quote for a trip, from current prices and settings. */
export function quoteTrip(
    config: ICarRentalConfig,
    category: IVehicleCategory,
    extras: {extra: IRentalExtra; quantity: number}[],
    trip: Pick<RentalTrip, "pickupAt" | "returnAt" | "pickupLocation">,
): RentalQuoteResult {
    return computeRentalQuote({
        category,
        extras: extras.map(({extra, quantity}) => ({name: extra.name, pricing: extra.pricing, price: extra.price, quantity})),
        pickupAt: trip.pickupAt,
        returnAt: trip.returnAt,
        timeZone: trip.pickupLocation.timezone,
        settings: {vatRate: config.vatRate, pricesIncludeVat: config.pricesIncludeVat, lateGraceMinutes: config.lateGraceMinutes},
    });
}

/**
 * How this booking is paid. The company policy decides unless it leaves the choice
 * to the customer; online payment needs a charge to make.
 */
export function resolvePaymentChoice(
    config: ICarRentalConfig,
    requested: RentalPaymentChoice,
    ctx: {onlinePaymentAvailable: boolean; grandTotal: number; languageCode: string},
): RentalPaymentChoice {
    const choice: RentalPaymentChoice =
        config.paymentPolicy === "pay_at_pickup" ? "pay_at_pickup"
            : config.paymentPolicy === "prepay_online" ? "online"
                : requested;
    if (choice === "online" && (!ctx.onlinePaymentAvailable || ctx.grandTotal <= 0)) {
        if (config.paymentPolicy === "prepay_online" || requested === "online") {
            throw apiValidationException("rental_online_payment_unavailable", "", null, ctx.languageCode);
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
    input: {companyId: ObjectId; categoryId: ObjectId; vehicleId?: string; pickupAt: Date; blockedUntil: Date; preferLocationId: ObjectId; excludeReservationId?: ObjectId; now: Date},
    ctx: Ctx,
): Promise<ObjectId> {
    const {companyId, categoryId, vehicleId, pickupAt, blockedUntil, preferLocationId, excludeReservationId, now} = input;
    const window = {companyId, start: pickupAt, end: blockedUntil, now, excludeReservationId, session: ctx.session};

    if (vehicleId) {
        const vehicle = ObjectId.isValid(vehicleId)
            ? await Vehicle.findOne({_id: new ObjectId(vehicleId), company: companyId, deletedAt: null}).select("_id category").session(ctx.session)
            : null;
        if (!vehicle) throw apiValidationException("vehicle_not_found", "", null, ctx.languageCode);
        if (String(vehicle.category) !== String(categoryId)) {
            throw apiValidationException("rental_vehicle_wrong_category", "", null, ctx.languageCode);
        }
        await lockVehicle(vehicle._id, {companyId, session: ctx.session, languageCode: ctx.languageCode});
        const busy = await busyVehicleIds({...window, vehicleIds: [vehicle._id]});
        if (busy.size) throw apiValidationException("vehicle_unavailable", "", null, ctx.languageCode);
        return vehicle._id;
    }

    for (const candidate of await freeVehiclesInCategory({...window, categoryId, preferLocationId})) {
        await lockVehicle(candidate, {companyId, session: ctx.session, languageCode: ctx.languageCode});
        // Re-checked under the lock: the list above was read before it was taken.
        const busy = await busyVehicleIds({...window, vehicleIds: [candidate]});
        if (!busy.size) return candidate;
    }
    throw apiValidationException("rental_category_unavailable", "", null, ctx.languageCode);
}

export type CreateRentalReservationInput = {
    companyId: ObjectId;
    config: ICarRentalConfig;
    category: IVehicleCategory;
    vehicleId?: string;
    trip: RentalTrip;
    extras: {extra: IRentalExtra; quantity: number}[];
    contact: {firstName: string; lastName: string; email: string; phone: string};
    customerId?: ObjectId;
    notes?: string;
    idempotencyKey: string;
    source: "online" | "staff";
    paymentChoice: RentalPaymentChoice;
    /** The total the customer was shown; omitted for staff bookings. */
    expectedTotal?: number;
    now?: Date;
};

/**
 * Prices the trip, allocates (and locks) a vehicle and returns the reservation
 * document to insert, inside the caller's transaction. Pay-at-pickup bookings are
 * confirmed at once; online ones are `held` until the payment arrives or
 * `holdMinutes` pass.
 */
export async function buildRentalReservation(
    input: CreateRentalReservationInput,
    ctx: Ctx,
): Promise<CreateInput<IRentalReservation>> {
    const {companyId, config, category, trip, extras, contact, idempotencyKey, source, paymentChoice} = input;
    const now = input.now ?? new Date();

    const quote = quoteTrip(config, category, extras, trip);
    if (input.expectedTotal !== undefined && Math.abs(input.expectedTotal - quote.grandTotal) > PRICE_TOLERANCE) {
        throw apiValidationException("rental_price_changed", "", null, ctx.languageCode);
    }

    const blockedUntil = busyUntil(trip.returnAt, config.turnaroundBufferMinutes);
    const vehicleId = await allocateVehicle(
        {
            companyId,
            categoryId: category._id,
            vehicleId: input.vehicleId,
            pickupAt: trip.pickupAt,
            blockedUntil,
            preferLocationId: trip.pickupLocation._id,
            now,
        },
        ctx,
    );

    const held = paymentChoice === "online";
    return {
        company: companyId,
        number: reservationNumber(now),
        status: held ? "held" : "confirmed",
        source,
        category: category._id,
        vehicle: vehicleId,
        pickupLocation: trip.pickupLocation._id,
        returnLocation: trip.returnLocation._id,
        pickupAt: trip.pickupAt,
        returnAt: trip.returnAt,
        blockedUntil,
        ...(held ? {holdExpiresAt: new Date(now.getTime() + config.holdMinutes * MINUTE)} : {}),
        ...(input.customerId ? {customer: input.customerId} : {}),
        contact,
        extras: extras.map(({extra, quantity}) => ({
            extra: extra._id,
            name: extra.name,
            pricing: extra.pricing,
            unitPrice: extra.price,
            quantity,
            total: quote.lines.find((line) => line.kind === "extra" && line.label === extra.name)?.total ?? 0,
        })),
        pricing: {...quote, currency: nestedEntityToRef(config.currency)},
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
        amountPaid: 0,
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
    const existing = await RentalReservation.findOne({company: input.companyId, idempotencyKey: input.idempotencyKey}).session(ctx.session);
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
