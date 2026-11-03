/**
 * Daily: keeps the fleet's paperwork, servicing and fines in view of the rental staff.
 *  1. Active insurance policies and documents past their expiry date become `expired`;
 *     staff are told once when one lapses with no renewal (the car cannot be handed over).
 *  2. Staff are warned once, 30 days ahead, about a policy or document that expires,
 *     unless it was renewed or a newer active one of the same coverage or type takes over.
 *  3. Staff are warned once about a car due for service within 14 days or 1,000 km.
 *  4. Staff are warned once about an unpaid fine due within 7 days.
 * Each record is claimed (stamped or moved) before the warning goes out, so it is sent at
 * most once even if two runs overlap; editing the date (or a new service record) re-arms it.
 */

import type {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleInsurance, {type IVehicleInsurance} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument, {type IVehicleDocument} from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";
import {notifyFleetStaff} from "@carRentalModule/utilities/services/rentalNotify";

const DAY_MS = 24 * 3600 * 1000;
const EXPIRY_WARNING_DAYS = 30;
const SERVICE_WARNING_DAYS = 14;
const SERVICE_WARNING_KM = 1000;
const FINE_WARNING_DAYS = 7;
const BATCH_SIZE = 200;

const isoDate = (date: Date | undefined) => date?.toISOString().slice(0, 10);

/** Runs `handle` over every unclaimed row; a handled row is claimed, so the next page moves on. */
async function eachBatch<T>(find: () => Promise<T[]>, handle: (row: T) => Promise<void>): Promise<void> {
    let batch: T[];
    do {
        batch = await find();
        for (const row of batch) await handle(row);
    } while (batch.length === BATCH_SIZE);
}

type PolicyRow = Omit<IVehicleInsurance, "vehicle"> & {vehicle: IVehicle | null};
type DocumentRow = Omit<IVehicleDocument, "vehicle"> & {vehicle: IVehicle | null};

/** Renewed, or another active policy of the same coverage runs longer. */
async function policyRenewed(policy: PolicyRow): Promise<boolean> {
    if (policy.supersededBy) return true;
    const newer = await VehicleInsurance.exists({
        _id: {$ne: policy._id},
        company: nestedEntityToRef(policy.company),
        vehicle: policy.vehicle!._id,
        coverage: policy.coverage,
        status: "active",
        deletedAt: null,
        expiresAt: {$gt: policy.expiresAt},
    });
    return Boolean(newer);
}

/** Renewed, or another active document of the same type runs longer. */
async function documentRenewed(document: DocumentRow): Promise<boolean> {
    if (document.supersededBy) return true;
    const newer = await VehicleDocument.exists({
        _id: {$ne: document._id},
        company: nestedEntityToRef(document.company),
        vehicle: document.vehicle!._id,
        type: document.type,
        status: "active",
        deletedAt: null,
        expiresAt: {$gt: document.expiresAt},
    });
    return Boolean(newer);
}

const policyPayload = (policy: PolicyRow) => ({
    vehicleId: String(policy.vehicle!._id),
    plate: policy.vehicle!.plate,
    recordId: String(policy._id),
    policyNumber: policy.policyNumber,
    insurer: policy.insurer,
    expiresOn: isoDate(policy.expiresAt),
});
const documentPayload = (document: DocumentRow) => ({
    vehicleId: String(document.vehicle!._id),
    plate: document.vehicle!.plate,
    recordId: String(document._id),
    documentType: document.type,
    expiresOn: isoDate(document.expiresAt),
});

export async function runFleetReminders(company: ObjectId, parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("fleet_reminders", parentLogger);
    const languageCode = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const now = new Date();
    const expiryHorizon = new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS);
    logger.start("Checking fleet expiries, service due dates and fines...");

    // Moving a row to `expired` claims it, so a lapse is told once.
    const expiredFilter = {company, status: "active", deletedAt: null, expiresAt: {$lt: now}};
    let expired = 0;
    let lapsed = 0;
    await eachBatch(
        () => VehicleInsurance.find(expiredFilter).populate<{vehicle: IVehicle | null}>("vehicle", "plate status").limit(BATCH_SIZE).exec(),
        async (policy) => {
            const claimed = await VehicleInsurance.updateOne({_id: policy._id, status: "active"}, {$set: {status: "expired"}});
            if (!claimed.modifiedCount) return;
            expired += 1;
            if (!policy.vehicle || policy.vehicle.status === "retired" || (await policyRenewed(policy))) return;
            await notifyFleetStaff(NotificationEventCodes.VEHICLE_INSURANCE_EXPIRED, company, policyPayload(policy), languageCode);
            lapsed += 1;
        },
    );
    await eachBatch(
        () => VehicleDocument.find(expiredFilter).populate<{vehicle: IVehicle | null}>("vehicle", "plate status").limit(BATCH_SIZE).exec(),
        async (document) => {
            const claimed = await VehicleDocument.updateOne({_id: document._id, status: "active"}, {$set: {status: "expired"}});
            if (!claimed.modifiedCount) return;
            expired += 1;
            if (!document.vehicle || document.vehicle.status === "retired" || (await documentRenewed(document))) return;
            await notifyFleetStaff(NotificationEventCodes.VEHICLE_DOCUMENT_EXPIRED, company, documentPayload(document), languageCode);
            lapsed += 1;
        },
    );

    // `null` also matches a missing stamp; an edited expiry date writes null back.
    const expiringFilter = {company, status: "active", deletedAt: null, expiryReminderSentAt: null, expiresAt: {$gt: now, $lte: expiryHorizon}};
    let warned = 0;

    await eachBatch(
        () => VehicleInsurance.find(expiringFilter).populate<{vehicle: IVehicle | null}>("vehicle", "plate status").limit(BATCH_SIZE).exec(),
        async (policy) => {
            const claimed = await VehicleInsurance.updateOne({_id: policy._id, expiryReminderSentAt: null}, {$set: {expiryReminderSentAt: now}});
            if (!claimed.modifiedCount || !policy.vehicle || policy.vehicle.status === "retired" || (await policyRenewed(policy))) return;
            await notifyFleetStaff(NotificationEventCodes.VEHICLE_INSURANCE_EXPIRING, company, policyPayload(policy), languageCode);
            warned += 1;
        },
    );

    await eachBatch(
        () => VehicleDocument.find(expiringFilter).populate<{vehicle: IVehicle | null}>("vehicle", "plate status").limit(BATCH_SIZE).exec(),
        async (document) => {
            const claimed = await VehicleDocument.updateOne({_id: document._id, expiryReminderSentAt: null}, {$set: {expiryReminderSentAt: now}});
            if (!claimed.modifiedCount || !document.vehicle || document.vehicle.status === "retired" || (await documentRenewed(document))) return;
            await notifyFleetStaff(NotificationEventCodes.VEHICLE_DOCUMENT_EXPIRING, company, documentPayload(document), languageCode);
            warned += 1;
        },
    );

    let serviceDue = 0;
    const serviceFilter = {
        company,
        deletedAt: null,
        status: {$ne: "retired"},
        serviceReminderSentAt: null,
        $or: [
            {nextServiceDueAt: {$lte: new Date(now.getTime() + SERVICE_WARNING_DAYS * DAY_MS)}},
            // The $type guard matters: a missing due km would otherwise compare as reached.
            {
                nextServiceDueKm: {$type: "number"},
                $expr: {$gte: [{$ifNull: ["$odometerKm", 0]}, {$subtract: ["$nextServiceDueKm", SERVICE_WARNING_KM]}]},
            },
        ],
    };
    await eachBatch(
        () => Vehicle.find(serviceFilter).select("company plate nextServiceDueAt nextServiceDueKm odometerKm").limit(BATCH_SIZE).exec(),
        async (vehicle) => {
            const claimed = await Vehicle.updateOne({_id: vehicle._id, serviceReminderSentAt: null}, {$set: {serviceReminderSentAt: now}});
            if (!claimed.modifiedCount) return;
            await notifyFleetStaff(
                NotificationEventCodes.VEHICLE_SERVICE_DUE,
                nestedEntityToRef(vehicle.company),
                {
                    vehicleId: String(vehicle._id),
                    plate: vehicle.plate,
                    dueOn: isoDate(vehicle.nextServiceDueAt),
                    dueKm: vehicle.nextServiceDueKm,
                    odometerKm: vehicle.odometerKm,
                },
                languageCode,
            );
            serviceDue += 1;
        },
    );

    // A fine the driver pays (transferred), annulled, or contested is not the company's to pay.
    let finesDue = 0;
    const fineFilter = {
        company,
        deletedAt: null,
        paidAt: null,
        dueReminderSentAt: null,
        status: {$nin: ["transferred", "cancelled", "disputed"]},
        dueDate: {$lte: new Date(now.getTime() + FINE_WARNING_DAYS * DAY_MS)},
    };
    await eachBatch(
        () => VehicleFine.find(fineFilter).populate<{vehicle: IVehicle | null}>("vehicle", "plate").limit(BATCH_SIZE).exec(),
        async (fine) => {
            const claimed = await VehicleFine.updateOne({_id: fine._id, dueReminderSentAt: null}, {$set: {dueReminderSentAt: now}});
            if (!claimed.modifiedCount || !fine.vehicle) return;
            await notifyFleetStaff(
                NotificationEventCodes.VEHICLE_FINE_DUE,
                company,
                {
                    vehicleId: String(fine.vehicle._id),
                    plate: fine.vehicle.plate,
                    recordId: String(fine._id),
                    reference: fine.reference,
                    authority: fine.authority,
                    dueOn: isoDate(fine.dueDate),
                },
                languageCode,
            );
            finesDue += 1;
        },
    );

    logger.finish(
        `Fleet reminders: ${expired} marked expired (${lapsed} with no renewal), ${warned} expiry warnings, ${serviceDue} service due, ${finesDue} fines due`,
    );
}
