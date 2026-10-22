import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongoMemoryReplSet} from "mongodb-memory-server";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";

const {emitted} = vi.hoisted(() => ({emitted: [] as {code: string; payload: Record<string, unknown>}[]}));
vi.mock("@coreModule/domain/notifications/notificationEventBus", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@coreModule/domain/notifications/notificationEventBus")>()),
    emitNotificationEvent: (code: string, event: {payload: Record<string, unknown>}) => emitted.push({code, payload: event.payload}),
}));

import Currency from "@coreModule/database/schemas/currency/currency";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import {runFleetReminders} from "@carRentalModule/utilities/cronJobs/fleetReminderJob";

let replSet: MongoMemoryReplSet;
const companyId = new ObjectId();
const DAY = 24 * 3600 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

let plate = 0;
const car = (fields: Record<string, unknown> = {}) =>
    Vehicle.create({company: companyId, category: new ObjectId(), make: "Fiat", model: "Panda", plate: `AA${++plate}`, homeLocation: new ObjectId(), status: "active", ...fields});
const policy = (vehicle: ObjectId, expiresAt: Date, fields: Record<string, unknown> = {}) =>
    VehicleInsurance.create({company: companyId, vehicle, insurer: "Sigal", policyNumber: `P-${expiresAt.getTime()}`, coverage: "third_party", validFrom: inDays(-300), expiresAt, ...fields});
const codes = () => emitted.map((event) => event.code).sort();

beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({replSet: {count: 1}});
    await mongoose.connect(replSet.getUri());
    await Promise.all([Vehicle, VehicleInsurance, VehicleDocument, CarRentalConfig, Currency].map((model) => model.init()));
}, 120000);

afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    await Promise.all([Vehicle, VehicleInsurance, VehicleDocument, CarRentalConfig, Currency].map((model) => model.collection.deleteMany({})));
    emitted.length = 0;
    const currency = await Currency.create({name: "Lek", symbol: "L", abbreviation: "ALL", decimalPlaces: 2, company: companyId});
    await CarRentalConfig.create({company: companyId, currency: currency._id, notifyUsers: [new ObjectId()]});
});

describe("fleet reminders", {timeout: 60000}, () => {
    it("warns once about a policy and a document expiring within 30 days", async () => {
        const vehicle = await car();
        await policy(vehicle._id, inDays(10));
        await VehicleDocument.create({company: companyId, vehicle: vehicle._id, type: "technical_inspection", expiresAt: inDays(20)});
        await policy(vehicle._id, inDays(90), {coverage: "full_casco"});

        await runFleetReminders(companyId);
        expect(codes()).toEqual(["VEHICLE_DOCUMENT_EXPIRING", "VEHICLE_INSURANCE_EXPIRING"]);
        expect(emitted.find((event) => event.code === "VEHICLE_INSURANCE_EXPIRING")!.payload).toMatchObject({plate: vehicle.plate, insurer: "Sigal"});

        await runFleetReminders(companyId);
        expect(emitted).toHaveLength(2);
    });

    it("stays quiet when a newer policy of the same cover takes over, or the car is retired", async () => {
        const renewedCar = await car();
        await policy(renewedCar._id, inDays(10));
        await policy(renewedCar._id, inDays(375));
        const retiredCar = await car({status: "retired"});
        await policy(retiredCar._id, inDays(5));

        await runFleetReminders(companyId);
        expect(emitted).toEqual([]);
    });

    it("marks active policies and documents past their expiry as expired", async () => {
        const vehicle = await car();
        const lapsed = await policy(vehicle._id, inDays(-1));
        const document = await VehicleDocument.create({company: companyId, vehicle: vehicle._id, type: "road_tax", expiresAt: inDays(-3)});
        const timeless = await VehicleDocument.create({company: companyId, vehicle: vehicle._id, type: "registration"});

        await runFleetReminders(companyId);
        expect((await VehicleInsurance.findById(lapsed._id))!.status).toBe("expired");
        expect((await VehicleDocument.findById(document._id))!.status).toBe("expired");
        expect((await VehicleDocument.findById(timeless._id))!.status).toBe("active");
    });

    it("flags a car due for service by date or by km, once", async () => {
        const byDate = await car({nextServiceDueAt: inDays(7)});
        const byKm = await car({odometerKm: 14_200, nextServiceDueKm: 15_000});
        await car({odometerKm: 9_000, nextServiceDueKm: 15_000, nextServiceDueAt: inDays(200)});
        await car({odometerKm: 50_000});
        await car({status: "retired", nextServiceDueAt: inDays(1)});

        await runFleetReminders(companyId);
        expect(emitted.map((event) => event.payload.plate).sort()).toEqual([byDate.plate, byKm.plate].sort());
        expect(new Set(codes())).toEqual(new Set(["VEHICLE_SERVICE_DUE"]));

        await runFleetReminders(companyId);
        expect(emitted).toHaveLength(2);
    });

    it("sends nothing when no staff are set to be notified", async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {notifyUsers: []}});
        const vehicle = await car({nextServiceDueAt: inDays(1)});
        await policy(vehicle._id, inDays(3));

        await runFleetReminders(companyId);
        expect(emitted).toEqual([]);
        expect((await Vehicle.findById(vehicle._id))!.serviceReminderSentAt).toBeInstanceOf(Date);
    });
});
