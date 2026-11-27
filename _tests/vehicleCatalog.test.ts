import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

vi.hoisted(() => {
    process.env.ENABLED_MODULES = "core,finance,carRental";
});
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

const platformId = new ObjectId();
const rentalId = new ObjectId();
const userId = new ObjectId();

// authMW as production runs it: the session company's name and platform flag.
vi.mock("@coreModule/utilities/middlewares/authMW", async () => {
    const {authMWStub} = await import("@coreModule/_tests/httpHarness");
    return {
        default: (scope?: string) => (req: {body: Record<string, unknown>}, res: unknown, next: () => void) =>
            authMWStub.default(scope)(req, res, () => {
                const company = req.body.company as {_id: ObjectId};
                req.body.company = {...company, name: company._id.equals(platformId) ? "Kudoo" : "Rent Co", isPlatformOwner: company._id.equals(platformId)};
                next();
            }),
    };
});
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("@coreModule/domain/notifications/notificationEventBus", async (importOriginal) => ({
    ...await importOriginal<typeof import("@coreModule/domain/notifications/notificationEventBus")>(),
    emitNotificationEvent: vi.fn(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {asCrossTenant, withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {getLogger} from "@coreModule/loggers/serverLog";
import Company from "@coreModule/database/schemas/company/company";
import * as catalogRoute from "@carRentalModule/api/carRental/private/vehicleCatalog";
import * as vehicleRoute from "@carRentalModule/api/carRental/private/checked/vehicle";
import VehicleCatalogEntry from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {seedVehicleCatalog, type VehicleCatalogFile} from "@carRentalModule/database/seeds/vehicleCatalog/vehicleCatalog.seed";
import {linkVehiclesToCatalog} from "@carRentalModule/utilities/services/vehicleCatalogLink";

const logger = getLogger("vehicle_catalog_test");
const app = appFor([catalogRoute, vehicleRoute].map((route) => ({...route, module: "carRental"})));
const tags = allPermissionTags([VehicleCatalogEntry, Vehicle, VehicleCategory]);
const asPlatform: TestCaller = {userId: userId.toString(), companyId: platformId.toString(), isAdmin: true, permissions: tags, modules: ["core", "carRental"]};
const asRental: TestCaller = {userId: userId.toString(), companyId: rentalId.toString(), isAdmin: true, permissions: tags, modules: ["core", "carRental"]};
const acrossCompanies = <T>(fn: () => PromiseLike<T>): Promise<T> => asCrossTenant("test fixtures span companies", fn);
const call = (caller: TestCaller, method: "post" | "put" | "patch", path: string, body: object = {}) =>
    request(app)[method](`/api/carRental/${path}`).set(callerHeader(caller)).send(body);

const typeNames = (en: string) => ({"en-US": en, "de-CH": `${en} DE`, "fr-FR": `${en} FR`, "it-IT": `${en} IT`, "sq-AL": `${en} SQ`});
const CATALOG: VehicleCatalogFile = {
    source: "test",
    retrieved: "2026-11-27",
    types: [{key: "car", names: typeNames("Car")}, {key: "van", names: typeNames("Van")}],
    makes: [{key: "mercedes-benz", name: "Mercedes-Benz"}, {key: "skoda", name: "Škoda"}],
    models: [
        {key: "mercedes-benz-e-class", make: "mercedes-benz", type: "car", name: "E-Class", bodyStyle: "sedan", seats: 5, doors: 4, fuel: "diesel", transmission: "automatic", from: 1993},
        {key: "mercedes-benz-sprinter", make: "mercedes-benz", type: "van", name: "Sprinter", bodyStyle: "van", seats: 3},
        {key: "skoda-octavia", make: "skoda", type: "car", name: "Octavia", seats: 5},
    ],
};

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

let categoryId: string;
let locationId: string;

beforeEach(() => acrossCompanies(async () => {
    for (const collection of await mongoose.connection.db!.collections()) await collection.deleteMany({});
    await Company.collection.insertMany([
        {_id: platformId, company: platformId, name: "Kudoo", vat: "P-1", isPlatformOwner: true, isActive: true, modules: ["core"], createdBy: userId, deletedAt: null},
        {_id: rentalId, company: rentalId, name: "Rent Co", vat: "R-1", isActive: true, modules: ["core", "carRental"], createdBy: userId, deletedAt: null},
    ]);
    const platform = await Company.findById(platformId);
    await seedVehicleCatalog({platformCompany: platform!, logger}, CATALOG);
    await withTenant(rentalId, async () => {
        categoryId = String((await VehicleCategory.create({company: rentalId, name: "Premium", slug: "premium", seats: 4, transmission: "manual", fuelType: "petrol", dailyRate: 100, mileagePolicy: "unlimited"}))._id);
        locationId = String((await RentalLocation.create({company: rentalId, name: "Tirana", timezone: "Europe/Tirane"}))._id);
    });
}));

const entry = (catalogId: string) => VehicleCatalogEntry.findOne({catalogId});

describe("the platform's vehicle catalog (D199)", {timeout: 60000}, () => {
    it("seeds types, a make under each type it has models of, and models with their specs; a re-seed changes nothing", () => acrossCompanies(async () => {
        expect(await VehicleCatalogEntry.countDocuments({})).toBe(2 + 3 + 3);
        const e = await entry("car/mercedes-benz/mercedes-benz-e-class");
        expect(e).toMatchObject({level: "model", name: "E-Class", seats: 5, doors: 4, fuelType: "diesel", transmission: "automatic", yearFrom: 1993, bodyStyle: "sedan"});
        expect(String(e!.parentEntry)).toBe(String((await entry("car/mercedes-benz"))!._id));
        expect(e!.searchText).toContain("mercedes");
        expect((await entry("van"))!.names).toMatchObject({en: "Van", de: "Van DE", sq: "Van SQ"});
        const before = await VehicleCatalogEntry.find({}).select("updatedAt").lean();
        await seedVehicleCatalog({platformCompany: (await Company.findById(platformId))!, logger}, CATALOG);
        expect(await VehicleCatalogEntry.find({}).select("updatedAt").lean()).toEqual(before);
        // A model that left the file is hidden, not deleted.
        await seedVehicleCatalog({platformCompany: (await Company.findById(platformId))!, logger}, {...CATALOG, models: CATALOG.models.slice(0, 2)});
        expect((await VehicleCatalogEntry.collection.findOne({catalogId: "car/skoda/skoda-octavia"}))!.deletedAt).toBeTruthy();
    }));

    it("offers a company the models of the shared catalog, named with their make", () => acrossCompanies(async () => {
        const models = await call(asRental, "post", "vehicleCatalog/select", {level: "model", name: "e-class", page: 1, limit: 20});
        expect(models.status).toBe(200);
        expect(models.body.data.map((row: {label: string}) => row.label)).toEqual(["Mercedes-Benz › E-Class"]);
        // The make's name finds its models too, never a type or the make itself.
        const mercedes = await call(asRental, "post", "vehicleCatalog/select", {level: "model", name: "mercedes", page: 1, limit: 20});
        expect(mercedes.body.data.map((row: {label: string}) => row.label).sort()).toEqual(["Mercedes-Benz › E-Class", "Mercedes-Benz › Sprinter"]);
    }));

    it("keeps the tree type → make → model", () => acrossCompanies(async () => {
        const make = String((await entry("car/mercedes-benz"))!._id);
        const type = String((await entry("car"))!._id);
        expect((await call(asPlatform, "put", "vehicleCatalog", {name: "T-Class", level: "model", parentEntry: type})).body.error_code).toBe("vehicle_catalog_parent_level");
        expect((await call(asPlatform, "put", "vehicleCatalog", {name: "Bike", level: "type", parentEntry: make})).body.error_code).toBe("vehicle_catalog_parent_level");
        const created = await call(asPlatform, "put", "vehicleCatalog", {name: "T-Class", level: "model", parentEntry: make, seats: 7});
        expect(created.status).toBe(200);
        // Another company's create is a request the platform approves.
        const requested = await call(asRental, "put", "vehicleCatalog", {name: "Citan", level: "model", parentEntry: make});
        expect(requested.status).toBe(200);
        expect((await VehicleCatalogEntry.findOne({name: "Citan"}))!.requestStatus).toBe("requested");
    }));

    it("takes a car's make and model from the catalog only, and fills its empty specs from the model", () => acrossCompanies(async () => {
        const mercedes = String((await entry("car/mercedes-benz"))!._id);
        const eClass = String((await entry("car/mercedes-benz/mercedes-benz-e-class"))!._id);
        const octavia = String((await entry("car/skoda/skoda-octavia"))!._id);
        const base = {category: categoryId, homeLocation: locationId, status: "active"};
        // Typed names are ignored: the catalog's are written.
        const created = await call(asRental, "put", "vehicle", {...base, plate: "AA 1", catalogMake: mercedes, catalogModel: eClass, make: "Merc", model: "E", seats: 4});
        expect(created.status).toBe(200);
        const car = await Vehicle.findOne({plate: "AA 1"});
        expect(car).toMatchObject({make: "Mercedes-Benz", model: "E-Class", seats: 4, doors: 4, fuelType: "diesel", transmission: "automatic"});
        expect(String(car!.catalogMake)).toBe(mercedes);
        expect((await call(asRental, "put", "vehicle", {...base, plate: "AA 2", make: "Mercedes-Benz", model: "E-Class"})).body.error_code).toBe("vehicle_catalog_model_required");
        expect((await call(asRental, "put", "vehicle", {...base, plate: "AA 3", catalogMake: mercedes, catalogModel: octavia})).body.error_code).toBe("vehicle_catalog_model_make");
        expect((await call(asRental, "put", "vehicle", {...base, plate: "AA 4", catalogMake: mercedes, catalogModel: mercedes})).body.error_code).toBe("vehicle_catalog_model_level");
        // An older car not linked yet can still be edited, keeping its typed names; a linked one keeps a model.
        const old = await withTenant(rentalId, () => Vehicle.create({...base, company: rentalId, plate: "OLD 1", make: "Lada", model: "Niva"}));
        const retired = await call(asRental, "patch", "vehicle", {_id: String(old._id), ...base, plate: "OLD 1", status: "retired"});
        expect(retired.status).toBe(200);
        expect(await Vehicle.findById(old._id)).toMatchObject({make: "Lada", model: "Niva", status: "retired"});
        expect((await call(asRental, "patch", "vehicle", {_id: String(car!._id), ...base, plate: "AA 1", catalogModel: null})).body.error_code).toBe("vehicle_catalog_model_required");
    }));

    it("links existing cars by their typed names, and lists the ones that match nothing", () => acrossCompanies(async () => {
        await withTenant(rentalId, async () => {
            for (const [plate, make, model] of [["B 1", "Skoda", "Octavia Combi"], ["B 2", "Mercedes Benz", "E-Class"], ["B 3", "Lada", "Niva"]]) {
                await Vehicle.create({company: rentalId, category: categoryId, homeLocation: locationId, status: "active", plate, make, model});
            }
        });
        const dry = await linkVehiclesToCatalog({companyId: rentalId, apply: false});
        expect(dry.linked.map((car) => car.plate).sort()).toEqual(["B 1", "B 2"]);
        expect(dry.unmatched.map((car) => car.plate)).toEqual(["B 3"]);
        expect(await Vehicle.countDocuments({catalogModel: {$ne: null}})).toBe(0);
        await linkVehiclesToCatalog({companyId: rentalId, apply: true});
        const octavia = await Vehicle.findOne({plate: "B 1"});
        expect(String(octavia!.catalogModel)).toBe(String((await entry("car/skoda/skoda-octavia"))!._id));
        expect(String(octavia!.catalogMake)).toBe(String((await entry("car/skoda"))!._id));
        expect(octavia!.model).toBe("Octavia Combi");
    }));
});
