/**
 * Rules shared by a vehicle's fleet records: insurance policies, documents, service
 * log and damage reports. Each record belongs to one vehicle of the same company.
 */

import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {VEHICLE_RECORD_ATTACHMENTS_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {IVehicleMaintenance} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleDamage, {type IVehicleDamage} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";
import {assertNoBookingClash} from "./rentalAvailability";
import {notifyFleetStaff} from "./rentalNotify";

type RecordCtx = {companyId: ObjectId; session: ClientSession; languageCode: string};

/** Scans and invoices: PDFs and photos. */
export const recordAttachmentsUpload = mediaUploadMW({
    fields: {attachments: VEHICLE_RECORD_ATTACHMENTS_MAX},
    fieldMimeTypes: {attachments: ["application/pdf", "image/jpeg", "image/png", "image/webp"]},
    maxFileSize: 20 * 1024 * 1024,
});

/** The vehicle id, after checking it is a live vehicle of this company. */
export async function assertCompanyVehicle(vehicleId: unknown, ctx: RecordCtx): Promise<ObjectId> {
    const id = new ObjectId(String(vehicleId));
    const exists = await Vehicle.exists({_id: id, company: ctx.companyId, deletedAt: null}).session(ctx.session);
    if (!exists) {
        throw apiValidationException("vehicle_not_found", "", null, ctx.languageCode);
    }
    return id;
}

/**
 * Active until the expiry instant, then expired. The same clock as the fleet job
 * (`expiresAt < now`), so a policy entered with a past end date is expired immediately.
 */
export function statusForExpiry(expiresAt: Date | string, now = new Date()): "active" | "expired" {
    const instant = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    return instant < now ? "expired" : "active";
}

/**
 * A policy or document whose expiry date moves gets a fresh reminder, and an
 * expired one moved into the future is active again. Mutates the update data.
 */
export function rearmExpiry(update: Record<string, any>, existing: {expiresAt?: Date; status: string}): void {
    if (update.expiresAt === undefined) return;
    const next = update.expiresAt ? new Date(update.expiresAt) : undefined;
    if (next?.getTime() === existing.expiresAt?.getTime()) return;
    update.expiryReminderSentAt = null;
    const status = update.status ?? existing.status;
    if (status === "expired" && (!next || next > new Date())) {
        update.status = "active";
    }
}

/**
 * Copies the next service due date and km from the vehicle's latest completed service
 * that sets them onto the vehicle, where the fleet list sorts on them and the reminder
 * job queries them (a repair in between does not reset the service interval).
 * Recomputed from all records (not copied from the one just saved), so editing or
 * deleting an older record stays correct. A change re-arms the reminder; a higher
 * odometer reading on the latest completed record moves the vehicle's odometer forward.
 */
export async function syncVehicleServiceDue(vehicleId: ObjectId, ctx: {companyId: ObjectId; session?: ClientSession}): Promise<void> {
    // Sequential: a transaction session runs one operation at a time.
    const session = ctx.session ?? null;
    const vehicle = await Vehicle.findOne({_id: vehicleId, company: ctx.companyId}).select("nextServiceDueAt nextServiceDueKm odometerKm").session(session);
    if (!vehicle) return;
    const completed = {company: ctx.companyId, vehicle: vehicleId, status: "completed", deletedAt: null};
    const latest = await VehicleMaintenance.findOne(completed).sort({serviceDate: -1, _id: -1}).select("odometerKm").session(session);
    const due = await VehicleMaintenance.findOne({...completed, $or: [{nextDueAt: {$ne: null}}, {nextDueKm: {$ne: null}}]})
        .sort({serviceDate: -1, _id: -1})
        .select("nextDueAt nextDueKm")
        .session(session);

    const nextDueAt = due?.nextDueAt;
    const nextDueKm = due?.nextDueKm;
    const dueChanged = vehicle.nextServiceDueAt?.getTime() !== nextDueAt?.getTime() || vehicle.nextServiceDueKm !== nextDueKm;
    const raiseOdometer = latest?.odometerKm !== undefined && latest.odometerKm > (vehicle.odometerKm ?? 0);
    if (!dueChanged && !raiseOdometer) return;

    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    if (dueChanged) {
        if (nextDueAt) set.nextServiceDueAt = nextDueAt;
        else unset.nextServiceDueAt = 1;
        if (nextDueKm !== undefined) set.nextServiceDueKm = nextDueKm;
        else unset.nextServiceDueKm = 1;
        unset.serviceReminderSentAt = 1;
    }
    if (raiseOdometer) set.odometerKm = latest!.odometerKm;
    await Vehicle.updateOne({_id: vehicleId}, {$set: set, $unset: unset}, {session});
}

/**
 * A scheduled service with a ready date keeps the car out of bookings from the
 * service date until then. Refused over an existing booking, like a hand-made block.
 */
export async function blockForService(
    input: {vehicleId: ObjectId; type: IVehicleMaintenance["type"]; serviceDate: Date; readyAt: Date},
    ctx: RecordCtx,
): Promise<ObjectId> {
    const window = {start: input.serviceDate, end: input.readyAt};
    await assertNoBookingClash(input.vehicleId, window, ctx);
    const [block] = await VehicleBlock.create(
        [{company: ctx.companyId, vehicle: input.vehicleId, startAt: window.start, endAt: window.end, reason: input.type === "repair" ? "repair" : "maintenance", source: "service"}],
        {session: ctx.session},
    );
    return block._id;
}

/**
 * A new damage report: it is linked to the policy that covered the car at the time
 * (full casco first, then partial, then third party: the enum sorts that way), a
 * major one sends the car for a check, and the rental staff are told after commit.
 */
export async function damageReported(damage: IVehicleDamage, ctx: RecordCtx): Promise<void> {
    const vehicleId = nestedEntityToRef(damage.vehicle)!;
    if (!damage.insurance) {
        const policy = await VehicleInsurance.findOne({
            company: ctx.companyId,
            vehicle: vehicleId,
            deletedAt: null,
            status: {$ne: "cancelled"},
            validFrom: {$lte: damage.reportedAt},
            expiresAt: {$gt: damage.reportedAt},
        }).sort({coverage: 1}).select("_id").session(ctx.session);
        if (policy) await VehicleDamage.updateOne({_id: damage._id}, {$set: {insurance: policy._id}}, {session: ctx.session});
    }
    if (damage.severity === "major") {
        await Vehicle.updateOne({_id: vehicleId, company: ctx.companyId}, {$set: {readiness: "needs_check"}}, {session: ctx.session});
    }
    const vehicle = await Vehicle.findOne({_id: vehicleId, company: ctx.companyId}).select("plate").session(ctx.session);
    await runAfterCommit(ctx.session, () =>
        notifyFleetStaff(
            NotificationEventCodes.VEHICLE_DAMAGE_REPORTED,
            ctx.companyId,
            {vehicleId: String(vehicleId), plate: vehicle?.plate, recordId: String(damage._id), severity: damage.severity, area: damage.area},
            ctx.languageCode,
        ),
    );
}

/** Document types a car needs on the road. A green card only matters abroad; `other` is free-form. */
const ROAD_DOCUMENT_TYPES = ["registration", "technical_inspection", "emissions_test", "road_tax"];

/**
 * Before a handover: the car has a policy, not cancelled, that covers it from the handover
 * to the return, and the current paper of each road document type it has (the newest, not
 * renewed by another) runs to the return too. Renewing the paper, or another car, fixes it.
 */
export async function assertVehiclePapersValid(
    vehicle: {_id: ObjectId; plate: string},
    trip: {from: Date; until: Date},
    ctx: RecordCtx,
): Promise<void> {
    const {until} = trip;
    const base = {company: ctx.companyId, vehicle: vehicle._id, deletedAt: null};
    const [insured, documents] = await Promise.all([
        VehicleInsurance.exists({...base, status: {$ne: "cancelled"}, validFrom: {$lte: trip.from}, expiresAt: {$gte: until}}).session(ctx.session),
        VehicleDocument.find({...base, supersededBy: null, type: {$in: ROAD_DOCUMENT_TYPES}, expiresAt: {$ne: null}}).select("type expiresAt").session(ctx.session),
    ]);
    const latest = new Map<string, Date>();
    for (const document of documents) {
        const current = latest.get(document.type);
        if (!current || document.expiresAt! > current) latest.set(document.type, document.expiresAt!);
    }
    const lapsed = [...latest.values()].some((expiresAt) => expiresAt < until);
    if (!insured || lapsed) {
        throw apiValidationException("rental_vehicle_papers_expired", "", null, ctx.languageCode, [vehicle.plate]);
    }
}

/**
 * A scheduled service that will not happen (cancelled or deleted): its block is
 * removed, so the car is free again, and the damages it was to fix are open again.
 */
export async function releaseService(record: IVehicleMaintenance, ctx: {session: ClientSession}): Promise<void> {
    if (record.block) await VehicleBlock.updateOne({_id: record.block}, {$set: {deletedAt: new Date()}}, {session: ctx.session});
    const damageIds = record.damages.map((damage) => nestedEntityToRef(damage)!);
    if (damageIds.length) {
        await VehicleDamage.updateMany(
            {_id: {$in: damageIds}, repair: record._id, status: "in_repair"},
            {$set: {status: "open"}, $unset: {repair: 1}},
            {session: ctx.session},
        );
    }
}
