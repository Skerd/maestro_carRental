import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongoMemoryReplSet} from "mongodb-memory-server";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// No Redis in tests; the public routes' limiter fails closed without it.
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const {originCompany} = vi.hoisted(() => ({originCompany: {current: null as unknown}}));
vi.mock("@coreModule/utilities/marketing/resolveCompanyByOrigin", () => ({
    resolveCompanyByOrigin: async () => originCompany.current,
}));
vi.mock("@financeModule/utilities/services/payment/paymentService", () => ({getPaymentAdapter: () => ({isEnabled: () => false})}));
vi.mock("@financeModule/environment", () => ({PAYMENTS: {STRIPE_ENABLED: false, STRIPE_PUBLISHABLE_KEY: ""}}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import Currency from "@coreModule/database/schemas/currency/currency";
import Media from "@coreModule/database/schemas/media/media";
import * as vehicleRoute from "@carRentalModule/api/carRental/private/vehicle";
import * as reservationRoute from "@carRentalModule/api/carRental/private/rentalReservation";
import * as insuranceRoute from "@carRentalModule/api/carRental/private/vehicleInsurance";
import * as maintenanceRoute from "@carRentalModule/api/carRental/private/vehicleMaintenance";
import * as damageRoute from "@carRentalModule/api/carRental/private/vehicleDamage";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";

let replSet: MongoMemoryReplSet;
const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const app = appFor([vehicleRoute, reservationRoute, insuranceRoute, maintenanceRoute, damageRoute, storefrontRoute]);

let admin: TestCaller;
let locationId: ObjectId;
let categoryId: ObjectId;
let vehicleId: string;

const vehicleFor = (company: ObjectId, plate: string, status = "active") =>
    Vehicle.create({company, category: categoryId, make: "VW", model: "Golf", plate, homeLocation: locationId, status});

/** A booking row written directly: these tests only need it to exist for one car. */
const reservationFor = (vehicle: string, number: string) =>
    RentalReservation.collection.insertOne({company: companyId, vehicle: new ObjectId(vehicle), number, idempotencyKey: number, status: "completed", deletedAt: null});

const service = (body: Record<string, unknown>) =>
    request(app).put("/api/carRental/vehicleMaintenance").set(callerHeader(admin)).send({vehicle: vehicleId, type: "scheduled_service", status: "completed", ...body});

beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({replSet: {count: 1, storageEngine: "wiredTiger"}});
    await mongoose.connect(replSet.getUri());
    // Build every index first: an index build racing a transaction's first write aborts it.
    await Promise.all([Vehicle, CarRentalConfig, RentalLocation, VehicleCategory, RentalReservation, VehicleInsurance, VehicleMaintenance, VehicleDamage, Currency, Media]
        .map((model) => model.init()));
    admin = {
        userId: new ObjectId().toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([Vehicle, RentalReservation, VehicleInsurance, VehicleMaintenance, VehicleDamage]),
    };
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    // Raw collection deletes: the soft-delete plugin would only mark the rows deleted
    await Promise.all([CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, RentalReservation, VehicleInsurance, VehicleMaintenance, VehicleDamage, Currency, Media]
        .map((model) => model.collection.deleteMany({})));
    const currency = await Currency.create({name: "Euro", symbol: "€", abbreviation: "EUR", decimalPlaces: 2, company: companyId});
    await CarRentalConfig.create({company: companyId, currency: currency._id, publicBookingEnabled: true});
    const location = await RentalLocation.create({company: companyId, name: "Tirana", timezone: "Europe/Tirane", openingHours: []});
    const category = await VehicleCategory.create({
        company: companyId, name: "Compact", slug: "compact", seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 40, mileagePolicy: "unlimited",
    });
    locationId = location._id;
    categoryId = category._id;
    vehicleId = (await vehicleFor(companyId, "AA100AA")).id;
});

describe("service log", {timeout: 60000}, () => {
    it("copies the latest completed service's next due date and km onto the car", async () => {
        expect((await service({serviceDate: "2026-01-10", odometerKm: 10000, nextDueAt: "2027-01-10", nextDueKm: 25000})).status).toBe(200);
        expect((await service({serviceDate: "2026-06-01", odometerKm: 18000, nextDueAt: "2027-06-01", nextDueKm: 33000})).status).toBe(200);
        // An older record added later does not take over, and a scheduled one never counts.
        expect((await service({serviceDate: "2025-06-01", odometerKm: 2000, nextDueAt: "2026-06-01", nextDueKm: 17000})).status).toBe(200);
        expect((await service({status: "scheduled", serviceDate: "2026-12-01", nextDueAt: "2027-12-01"})).status).toBe(200);

        const car = await Vehicle.findById(vehicleId);
        expect(car!.nextServiceDueAt!.toISOString().slice(0, 10)).toBe("2027-06-01");
        expect(car!.nextServiceDueKm).toBe(33000);
        expect(car!.odometerKm).toBe(18000);
    });

    it("recomputes after an edit and a delete, and re-arms the reminder", async () => {
        const older = await service({serviceDate: "2026-01-10", nextDueAt: "2027-01-10", nextDueKm: 25000});
        const latest = await service({serviceDate: "2026-06-01", nextDueAt: "2027-06-01", nextDueKm: 33000});
        await Vehicle.updateOne({_id: vehicleId}, {$set: {serviceReminderSentAt: new Date()}});

        const edited = await request(app).patch("/api/carRental/vehicleMaintenance").set(callerHeader(admin))
            .send({_id: latest.body._id, vehicle: vehicleId, type: "scheduled_service", status: "completed", serviceDate: "2026-06-01", nextDueAt: "2027-07-01", nextDueKm: 34000});
        expect(edited.status).toBe(200);
        let car = await Vehicle.findById(vehicleId);
        expect(car!.nextServiceDueKm).toBe(34000);
        expect(car!.serviceReminderSentAt).toBeUndefined();

        const removed = await request(app).delete("/api/carRental/vehicleMaintenance").set(callerHeader(admin)).send({_id: latest.body._id});
        expect(removed.status).toBe(200);
        car = await Vehicle.findById(vehicleId);
        expect(car!.nextServiceDueAt!.toISOString().slice(0, 10)).toBe("2027-01-10");
        expect(car!.nextServiceDueKm).toBe(25000);
        expect(older.status).toBe(200);
    });

    it("refuses a car of another company", async () => {
        const foreign = await vehicleFor(otherCompanyId, "ZZ999ZZ");
        const response = await service({vehicle: foreign.id, serviceDate: "2026-01-10"});
        expect(response.body.error_code).toBe("vehicle_not_found");
        expect(await VehicleMaintenance.countDocuments({})).toBe(0);
    });
});

describe("insurance", {timeout: 60000}, () => {
    it("re-arms the expiry reminder and reactivates the policy when its expiry moves into the future", async () => {
        const created = await request(app).put("/api/carRental/vehicleInsurance").set(callerHeader(admin)).send({
            vehicle: vehicleId, insurer: "Sigal", policyNumber: "P-1", coverage: "third_party", validFrom: "2025-01-01", expiresAt: "2026-01-01",
        });
        expect(created.status).toBe(200);
        await VehicleInsurance.updateOne({_id: created.body._id}, {$set: {status: "expired", expiryReminderSentAt: new Date()}});

        const renewed = await request(app).patch("/api/carRental/vehicleInsurance").set(callerHeader(admin)).send({
            _id: created.body._id, vehicle: vehicleId, insurer: "Sigal", policyNumber: "P-1", coverage: "third_party",
            validFrom: "2025-01-01", expiresAt: "2099-01-01", status: "expired",
        });
        expect(renewed.body).toMatchObject({status: "active"});
        const stored = await VehicleInsurance.findById(created.body._id);
        expect(stored!.status).toBe("active");
        expect(stored!.expiryReminderSentAt ?? null).toBeNull();
    });
});

describe("damage reports", {timeout: 60000}, () => {
    it("ties a damage to a booking of the same car, and refuses another car's booking", async () => {
        const otherCar = await vehicleFor(companyId, "AA200AA");
        const own = await reservationFor(vehicleId, "R-1");
        const foreign = await reservationFor(otherCar.id, "R-2");
        const report = (reservation: ObjectId) => request(app).put("/api/carRental/vehicleDamage").set(callerHeader(admin)).send({
            vehicle: vehicleId, reservation: String(reservation), reportedAt: "2026-05-01T10:00:00.000Z", area: "rear", severity: "minor", description: "Scratch on the bumper",
        });

        expect((await report(foreign.insertedId)).body.error_code).toBe("vehicle_damage_reservation_mismatch");
        const ok = await report(own.insertedId);
        expect(ok.status).toBe(200);
        expect(ok.body.reservation.number).toBe("R-1");
        expect(ok.body.status).toBe("open");
    });

    it("lists only the chosen car's bookings in the booking picker", async () => {
        const otherCar = await vehicleFor(companyId, "AA200AA");
        await reservationFor(vehicleId, "R-1");
        await reservationFor(otherCar.id, "R-2");
        const response = await request(app).post("/api/carRental/rentalReservation/select").set(callerHeader(admin)).send({vehicle: vehicleId, page: 1, limit: 20});
        expect(response.body.data.map((option: {label: string}) => option.label)).toEqual(["R-1"]);
    });
});

describe("vehicle picker", {timeout: 60000}, () => {
    it("offers cars in maintenance only when asked to", async () => {
        await vehicleFor(companyId, "AA300AA", "maintenance");
        const labels = async (body: Record<string, unknown>) =>
            (await request(app).post("/api/carRental/vehicle/select").set(callerHeader(admin)).send({page: 1, limit: 20, ...body})).body.data
                .map((option: {label: string}) => option.label.split(" ")[0]).sort();
        expect(await labels({})).toEqual(["AA100AA"]);
        expect(await labels({includeInactive: true})).toEqual(["AA100AA", "AA300AA"]);
    });
});

describe("storefront media", {timeout: 60000}, () => {
    it("returns a category's videos next to its photos", async () => {
        const media = (type: "image" | "video") => {
            const [extension, mime] = type === "image" ? ["jpg", "image/jpeg"] : ["mp4", "video/mp4"];
            return Media.create({
                type, fileName: `f.${extension}`, originalName: `f.${extension}`, fileId: new ObjectId(), mimeType: mime,
                company: companyId, createdBy: new ObjectId(), metadata: {size: 1, extension, mime, safeCheckedFlag: true},
            });
        };
        const [photo, clip] = [await media("image"), await media("video")];
        await VehicleCategory.updateOne({_id: categoryId}, {$set: {images: [photo._id], videos: [clip._id]}});

        const response = await request(app).post("/api/carRental/rentalStorefront/config").set(callerHeader(admin)).send({});
        expect(response.status).toBe(200);
        const [category] = response.body.data.categories;
        expect(category.images).toEqual([`/api/auxiliary/public/media/${photo.id}`]);
        expect(category.videos).toEqual([`/api/auxiliary/public/media/${clip.id}`]);
    });
});
