import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

import {ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import * as vehicleRoute from "@carRentalModule/api/carRental/private/checked/vehicle";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";

const companyId = new ObjectId();
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const app = appFor([{...vehicleRoute, module: "carRental"}]);
const single = (caller: TestCaller, _id: string) => request(app).post("/api/carRental/vehicle/single").set(callerHeader(caller)).send({_id});

let fleet: TestCaller;
let carsOnly: TestCaller;

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all([RentalLocation, VehicleCategory, Vehicle, VehicleDamage, VehicleBlock, RentalReservation].map((model) => model.init()));
    const caller = (permissions: string[]): TestCaller => ({userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: false, permissions, modules: ["core", "carRental"]});
    fleet = caller(allPermissionTags([Vehicle, VehicleDamage, VehicleBlock, RentalReservation]));
    carsOnly = caller(allPermissionTags([Vehicle]));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await Promise.all([RentalLocation, VehicleCategory, Vehicle, VehicleDamage, VehicleBlock].map((model) => model.collection.deleteMany({})));
}));

describe("the car's sheet as a hub (P9.5)", () => {
    it("lists this car's damages and blocks for a role that may read them, and leaves them out for one that may not", () => asCompany(async () => {
        const location = await RentalLocation.create({company: companyId, name: "Tirana Airport", timezone: "Europe/Tirane"});
        const category = await VehicleCategory.create({company: companyId, name: "Compact", seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 40, mileagePolicy: "unlimited"});
        const car = (plate: string) => Vehicle.create({company: companyId, category: category._id, homeLocation: location._id, make: "Fiat", model: "Panda", plate, status: "active"});
        const panda = await car("AA 101 DM");
        const other = await car("AA 102 DM");
        const damage = (vehicle: ObjectId, description: string, reportedAt: string) => VehicleDamage.create({
            company: companyId, vehicle, reportedAt: new Date(reportedAt), area: "front", severity: "minor", description, status: "open",
        });
        await damage(panda._id, "Scratch on the bumper", "2026-11-01T09:00:00Z");
        await damage(panda._id, "Chipped windscreen", "2026-11-05T09:00:00Z");
        await damage(other._id, "Another car's dent", "2026-11-06T09:00:00Z");
        await VehicleBlock.create({company: companyId, vehicle: panda._id, reason: "repair", startAt: new Date("2026-11-20T08:00:00Z"), endAt: new Date("2026-11-21T17:00:00Z")});

        const full = await single(fleet, panda._id.toString());
        expect(full.status).toBe(200);
        // Newest first, this car only.
        expect(full.body.damages.map((row: {description: string}) => row.description)).toEqual(["Chipped windscreen", "Scratch on the bumper"]);
        expect(full.body.blocks).toHaveLength(1);
        expect(full.body.reservations).toEqual([]);

        const limited = await single(carsOnly, panda._id.toString());
        expect(limited.status).toBe(200);
        expect(limited.body.plate).toBe("AA 101 DM");
        for (const key of ["reservations", "damages", "maintenance", "documents", "insurances", "fines", "blocks"]) expect(limited.body).not.toHaveProperty(key);
    }));
});
