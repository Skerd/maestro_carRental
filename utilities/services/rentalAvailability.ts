import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
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

/**
 * Active vehicles of a category free for [start, end), best first: those based at
 * the pickup location, then by plate for a stable order.
 */
export async function freeVehiclesInCategory(
    query: WindowQuery & {categoryId: ObjectId; preferLocationId?: ObjectId},
): Promise<ObjectId[]> {
    const {companyId, categoryId, preferLocationId, session} = query;
    const vehicles = await Vehicle.find({company: companyId, category: categoryId, status: "active", deletedAt: null})
        .select("_id homeLocation plate")
        .sort({plate: 1})
        .session(session ?? null);
    const busy = await busyVehicleIds({...query, vehicleIds: vehicles.map((vehicle) => vehicle._id)});
    const free = vehicles.filter((vehicle) => !busy.has(String(vehicle._id)));
    const home = (vehicle: (typeof free)[number]) => (preferLocationId && String(vehicle.homeLocation) === String(preferLocationId) ? 0 : 1);
    return free.sort((a, b) => home(a) - home(b)).map((vehicle) => vehicle._id);
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
