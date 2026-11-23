/**
 * A car's papers for a trip: its insurance and the road documents it must carry. The handover asks for them in full
 * (`assertVehiclePapersValid`); booking leaves out the cars whose papers are known to run out during the trip
 * (`vehiclesWithLapsingPapers`, TD-B264), so a booking never ends at a car the counter has to refuse.
 *
 * @module vehiclePapers
 */

import type {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {vehicleInsuranceService} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.service";
import {vehicleDocumentService} from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument.service";

/** Document types a car needs on the road. A green card only matters abroad; `other` is free-form. */
const ROAD_DOCUMENT_TYPES = ["registration", "technical_inspection", "emissions_test", "road_tax"];

type PapersCtx = {companyId: ObjectId; session?: ClientSession | null};
type Trip = {from: Date; until: Date};

/**
 * For each car, the cars whose current paper of some road document type (the newest of that type, not renewed by
 * another) expires before `until`.
 */
async function carsWithLapsedRoadPapers(vehicleIds: ObjectId[], until: Date, ctx: PapersCtx): Promise<Set<string>> {
    const documents = await vehicleDocumentService.find(
        {company: ctx.companyId, vehicle: {$in: vehicleIds}, deletedAt: null, supersededBy: null, type: {$in: ROAD_DOCUMENT_TYPES}, expiresAt: {$ne: null}},
        {session: ctx.session ?? undefined},
        undefined,
        "vehicle type expiresAt",
    );
    const newest = new Map<string, Date>();
    for (const document of documents) {
        const key = `${String(document.vehicle)}:${document.type}`;
        const current = newest.get(key);
        if (document.expiresAt && (!current || document.expiresAt > current)) newest.set(key, document.expiresAt);
    }
    const lapsed = new Set<string>();
    for (const [key, expiresAt] of newest) {
        if (expiresAt < until) lapsed.add(key.split(":")[0]);
    }
    return lapsed;
}

/** The cars with a policy, not cancelled, that covers them from `from` to `until`. */
async function insuredCars(vehicleIds: ObjectId[], trip: Trip, ctx: PapersCtx): Promise<Set<string>> {
    const policies = await vehicleInsuranceService.find(
        {company: ctx.companyId, vehicle: {$in: vehicleIds}, deletedAt: null, status: {$ne: "cancelled"}, validFrom: {$lte: trip.from}, expiresAt: {$gte: trip.until}},
        {session: ctx.session ?? undefined},
        undefined,
        "vehicle",
    );
    return new Set(policies.map((policy) => String(policy.vehicle)));
}

/** True when the car may be handed over for the trip: insured for all of it, and no current road paper runs out. */
export async function vehiclePapersCoverTrip(vehicleId: ObjectId, trip: Trip, ctx: PapersCtx): Promise<boolean> {
    const [insured, lapsed] = await Promise.all([insuredCars([vehicleId], trip, ctx), carsWithLapsedRoadPapers([vehicleId], trip.until, ctx)]);
    return insured.has(String(vehicleId)) && !lapsed.has(String(vehicleId));
}

/**
 * The cars among `vehicleIds` whose papers are known to run out during the trip: a policy is on record but none
 * covers the trip, or a current road paper expires before the return. A car with no policy on record at all is not
 * counted: a fleet that does not record insurance yet would otherwise lose every online booking; the handover still
 * asks for one.
 */
export async function vehiclesWithLapsingPapers(vehicleIds: ObjectId[], trip: Trip, ctx: PapersCtx): Promise<Set<string>> {
    if (vehicleIds.length === 0) return new Set();
    const [insured, everInsured, lapsedRoadPapers] = await Promise.all([
        insuredCars(vehicleIds, trip, ctx),
        vehicleInsuranceService.find(
            {company: ctx.companyId, vehicle: {$in: vehicleIds}, deletedAt: null, status: {$ne: "cancelled"}},
            {session: ctx.session ?? undefined},
            undefined,
            "vehicle",
        ),
        carsWithLapsedRoadPapers(vehicleIds, trip.until, ctx),
    ]);
    const lapsing = new Set(lapsedRoadPapers);
    for (const policy of everInsured) {
        const id = String(policy.vehicle);
        if (!insured.has(id)) lapsing.add(id);
    }
    return lapsing;
}
