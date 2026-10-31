import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleTransfer from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

const MINUTE = 60 * 1000;

/**
 * Reservations that keep a vehicle busy at `now`: confirmed or on the road, plus
 * held ones whose hold has not run out. An expired hold frees the car even before
 * the sweeper marks it expired.
 */
export function blockingReservationFilter(now: Date): Record<string, unknown> {
    return {
        deletedAt: null,
        $or: [
            {status: {$in: ["confirmed", "in_progress"]}},
            {status: "held", holdExpiresAt: {$gt: now}},
        ],
    };
}

/** The busy window a booking from `pickupAt` to `returnAt` needs, turnaround included. */
export function busyUntil(returnAt: Date, turnaroundBufferMinutes: number): Date {
    return new Date(returnAt.getTime() + turnaroundBufferMinutes * MINUTE);
}

type WindowQuery = {
    companyId: ObjectId;
    start: Date;
    end: Date;
    now: Date;
    excludeReservationId?: ObjectId;
    session?: ClientSession;
};

/** Ids (hex) of vehicles with a blocking reservation or a block overlapping [start, end). */
export async function busyVehicleIds(query: WindowQuery & {vehicleIds?: ObjectId[]}): Promise<Set<string>> {
    const {companyId, start, end, now, excludeReservationId, session, vehicleIds} = query;
    const scope = vehicleIds ? {vehicle: {$in: vehicleIds}} : {};
    const [reserved, blocked] = await Promise.all([
        RentalReservation.distinct("vehicle", {
            company: companyId,
            ...scope,
            pickupAt: {$lt: end},
            blockedUntil: {$gt: start},
            ...(excludeReservationId ? {_id: {$ne: excludeReservationId}} : {}),
            ...blockingReservationFilter(now),
        }).session(session ?? null),
        VehicleBlock.distinct("vehicle", {
            company: companyId,
            ...scope,
            deletedAt: null,
            startAt: {$lt: end},
            endAt: {$gt: start},
        }).session(session ?? null),
    ]);
    return new Set([...reserved, ...blocked].map((id) => String(id)));
}

type LocatedVehicle = {_id: ObjectId; homeLocation: unknown; currentLocation?: unknown};

/**
 * Where each car will be at `at` (location ids, hex): the return location of its
 * last booking returned by then or the destination of its last transfer arriving
 * by then, whichever is later; otherwise where it is now (or at home).
 */
export async function projectedLocations(vehicles: LocatedVehicle[], at: Date, companyId: ObjectId, session?: ClientSession | null): Promise<Map<string, string>> {
    const ids = vehicles.map((vehicle) => vehicle._id);
    const latest = (rows: {_id: ObjectId; location: ObjectId; when: Date}[]) => new Map(rows.map((row) => [String(row._id), row]));
    const [bookings, transfers] = await Promise.all([
        RentalReservation.aggregate<{_id: ObjectId; location: ObjectId; when: Date}>([
            {$match: {company: companyId, vehicle: {$in: ids}, deletedAt: null, status: {$in: ["confirmed", "in_progress", "completed"]}, returnAt: {$lte: at}}},
            {$sort: {returnAt: -1}},
            {$group: {_id: "$vehicle", location: {$first: "$returnLocation"}, when: {$first: "$returnAt"}}},
        ]).session(session ?? null),
        VehicleTransfer.aggregate<{_id: ObjectId; location: ObjectId; when: Date}>([
            {$match: {company: companyId, vehicle: {$in: ids}, deletedAt: null, status: {$in: ["planned", "in_transit", "done"]}, arriveAt: {$lte: at}}},
            {$sort: {arriveAt: -1}},
            {$group: {_id: "$vehicle", location: {$first: "$toLocation"}, when: {$first: "$arriveAt"}}},
        ]).session(session ?? null),
    ]);
    const byBooking = latest(bookings);
    const byTransfer = latest(transfers);
    return new Map(vehicles.map((vehicle) => {
        const booking = byBooking.get(String(vehicle._id));
        const transfer = byTransfer.get(String(vehicle._id));
        const last = booking && transfer ? (transfer.when > booking.when ? transfer : booking) : booking ?? transfer;
        return [String(vehicle._id), String(last?.location ?? vehicle.currentLocation ?? vehicle.homeLocation)];
    }));
}

/**
 * Active vehicles of a category free for [start, end), best first: those that will
 * be at the pickup location at the start (see `projectedLocations`), then by plate.
 */
export async function freeVehiclesInCategory(
    query: WindowQuery & {categoryId: ObjectId; preferLocationId?: ObjectId},
): Promise<ObjectId[]> {
    const {companyId, categoryId, preferLocationId, session} = query;
    const vehicles = await Vehicle.find({company: companyId, category: categoryId, status: "active", deletedAt: null})
        .select("_id homeLocation currentLocation plate")
        .sort({plate: 1})
        .session(session ?? null);
    const busy = await busyVehicleIds({...query, vehicleIds: vehicles.map((vehicle) => vehicle._id)});
    const free = vehicles.filter((vehicle) => !busy.has(String(vehicle._id)));
    if (!preferLocationId) return free.map((vehicle) => vehicle._id);
    const located = await projectedLocations(free, query.start, companyId, session);
    const there = (vehicle: (typeof free)[number]) => (located.get(String(vehicle._id)) === String(preferLocationId) ? 0 : 1);
    return free.sort((a, b) => there(a) - there(b)).map((vehicle) => vehicle._id);
}

/** True when the car will not be at the pickup location at pickup time, so staff must move it there. */
export async function needsTransferFor(vehicleId: ObjectId, pickup: {locationId: ObjectId; at: Date}, companyId: ObjectId, session?: ClientSession | null): Promise<boolean> {
    const vehicle = await Vehicle.findOne({_id: vehicleId, company: companyId}).select("_id homeLocation currentLocation").session(session ?? null);
    if (!vehicle) return false;
    const located = await projectedLocations([vehicle], pickup.at, companyId, session);
    return located.get(String(vehicleId)) !== String(pickup.locationId);
}

/**
 * Takes the vehicle's allocation lock for the current transaction by bumping
 * `allocationVersion`. Any other transaction that books, blocks or reassigns the
 * same vehicle writes the same document, so MongoDB commits only one of them and
 * the other is retried by asyncHandler and then sees this booking. Without it two
 * bookings could each insert their own reservation (write skew).
 */
export async function lockVehicle(
    vehicleId: ObjectId,
    ctx: {companyId: ObjectId; session: ClientSession; languageCode: string; requireActive?: boolean},
): Promise<void> {
    const {companyId, session, languageCode, requireActive = true} = ctx;
    const result = await Vehicle.updateOne(
        {_id: vehicleId, company: companyId, deletedAt: null, ...(requireActive ? {status: "active"} : {})},
        {$inc: {allocationVersion: 1}},
        {session},
    );
    if (result.matchedCount === 0) {
        const exists = await Vehicle.exists({_id: vehicleId, company: companyId, deletedAt: null}).session(session);
        throw apiValidationException(exists ? "vehicle_not_active" : "vehicle_not_found", "", null, languageCode);
    }
}

/** Count of a category's active vehicles free for the window. */
export async function countFreeVehicles(query: WindowQuery & {categoryId: ObjectId}): Promise<number> {
    return (await freeVehiclesInCategory(query)).length;
}

/**
 * Takes the vehicle's lock and refuses a window that overlaps a booking: blocking a
 * car (repair, transfer) over a booking would strand that customer.
 */
export async function assertNoBookingClash(
    vehicleId: ObjectId,
    window: {start: Date; end: Date},
    ctx: {companyId: ObjectId; session: ClientSession; languageCode: string},
): Promise<void> {
    await lockVehicle(vehicleId, {companyId: ctx.companyId, session: ctx.session, languageCode: ctx.languageCode, requireActive: false});
    const clash = await RentalReservation.findOne({
        company: ctx.companyId,
        vehicle: vehicleId,
        pickupAt: {$lt: window.end},
        blockedUntil: {$gt: window.start},
        ...blockingReservationFilter(new Date()),
    }).select("number").session(ctx.session);
    if (clash) throw apiValidationException("vehicle_block_overlaps_reservation", "", null, ctx.languageCode, [clash.number]);
}
