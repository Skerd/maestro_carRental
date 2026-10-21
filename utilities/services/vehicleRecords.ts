/**
 * Rules shared by a vehicle's fleet records: insurance policies, documents, service
 * log and damage reports. Each record belongs to one vehicle of the same company.
 */

import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {VEHICLE_RECORD_ATTACHMENTS_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";

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
 * record onto the vehicle, where the fleet list sorts on them and the reminder job
 * queries them. Recomputed from all records (not copied from the one just saved), so
 * editing or deleting an older record stays correct. A change re-arms the reminder;
 * a higher odometer reading on that record moves the vehicle's odometer forward.
 */
export async function syncVehicleServiceDue(vehicleId: ObjectId, ctx: {companyId: ObjectId; session?: ClientSession}): Promise<void> {
    // Sequential: a transaction session runs one operation at a time.
    const session = ctx.session ?? null;
    const vehicle = await Vehicle.findOne({_id: vehicleId, company: ctx.companyId}).select("nextServiceDueAt nextServiceDueKm odometerKm").session(session);
    if (!vehicle) return;
    const latest = await VehicleMaintenance.findOne({company: ctx.companyId, vehicle: vehicleId, status: "completed", deletedAt: null})
        .sort({serviceDate: -1, _id: -1})
        .select("nextDueAt nextDueKm odometerKm")
        .session(session);

    const nextDueAt = latest?.nextDueAt;
    const nextDueKm = latest?.nextDueKm;
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
