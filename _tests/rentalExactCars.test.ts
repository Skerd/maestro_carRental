import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// No Redis in tests; the public routes' limiter fails closed without it.
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const {originCompany} = vi.hoisted(() => ({originCompany: {current: null as {_id: {toString(): string}; name?: string} | null}}));
vi.mock("@coreModule/utilities/marketing/resolveCompanyByOrigin", async () => {
    const {setRequestTenant} = await import("@coreModule/utilities/endpoints/tenantScope");
    return {
        resolveCompanyByOrigin: async () => {
            if (originCompany.current) setRequestTenant(originCompany.current._id.toString());
            return originCompany.current;
        },
    };
});
// Which customer email each step sends, and what the booking names its car then.
const {sentMail} = vi.hoisted(() => ({sentMail: vi.fn()}));
vi.mock("@carRentalModule/utilities/services/rentalNotify", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    notifyRentalCustomer: vi.fn(async (kind: string, reservation: {snapshot: {vehicleTitle?: string; categoryName: string}}, _ctx: unknown, options: {note?: string} = {}) => {
        sentMail({kind, car: reservation.snapshot.vehicleTitle ?? reservation.snapshot.categoryName, note: options.note});
    }),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import Currency from "@coreModule/database/schemas/currency/currency";
import PaymentTransaction from "@financeModule/database/schemas/paymentTransaction/paymentTransaction";
import Invoice, {InvoiceCounter} from "@financeModule/database/schemas/invoice/invoice";
import * as reservationRoute from "@carRentalModule/api/carRental/private/rentalReservation";
import * as vehicleRoute from "@carRentalModule/api/carRental/private/checked/vehicle";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import * as categoryRoute from "@carRentalModule/api/carRental/private/vehicleCategory";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {buildRentalReport} from "@carRentalModule/utilities/services/rentalReports";

const companyId = new ObjectId();
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const app = appFor([reservationRoute, vehicleRoute, storefrontRoute, categoryRoute].map((route) => ({...route, module: "carRental"})));

let admin: TestCaller;
let zurich: string;
let basel: string;
let premium: string;
let economy: string;
/** Rented on its own at its own price, at Zurich. */
let listed: string;
/** Same group, not rented on its own, at Zurich. */
let unlisted: string;
/** Rented on its own, at Basel. */
let away: string;

/** Wednesday 9 – Friday 11 June 2027: two days, inside the Premium group's June season. */
const trip = (overrides: Record<string, string> = {}) => ({
    pickupLocation: zurich,
    returnLocation: zurich,
    pickupDate: "2027-06-09",
    pickupTime: "10:00",
    returnDate: "2027-06-11",
    returnTime: "10:00",
    ...overrides,
});
const contact = {firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+41 79 000 00 00"};
const publicPost = (path: string, body: Record<string, unknown>) =>
    request(app).post(`/api/carRental/rentalStorefront/${path}`).set(callerHeader(admin)).send(body);
const quote = (body: Record<string, unknown>) => publicPost("quote", {...trip(), category: premium, ...body});
const book = (body: Record<string, unknown>) => publicPost("book", {
    ...trip(),
    category: premium,
    contact,
    driverBirthDate: "1990-12-10",
    paymentChoice: "pay_at_pickup",
    acceptTerms: true,
    idempotencyKey: `key-${new ObjectId().toString()}`,
    ...body,
});
const action = (name: string, body: Record<string, unknown>) =>
    request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);
const rentalTotal = (lines: {kind: string; total: number}[]) =>
    lines.filter((line) => line.kind === "rental").reduce((sum, line) => sum + line.total, 0);

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    admin = {
        userId: new ObjectId().toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([RentalReservation, Vehicle, VehicleCategory]),
    };
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await Promise.all([CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, VehicleInsurance, RentalReservation, PaymentTransaction, Currency, Invoice, InvoiceCounter]
        .map((model) => model.collection.deleteMany({})));
    sentMail.mockClear();
    const currency = await Currency.create({name: "Swiss franc", symbol: "CHF", abbreviation: "CHF", decimalPlaces: 2, company: companyId});
    await CarRentalConfig.create({
        company: companyId,
        currency: currency._id,
        publicBookingEnabled: true,
        turnaroundBufferMinutes: 60,
        minRentalHours: 4,
        paymentPolicy: "pay_at_pickup",
    });
    const hours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"}));
    const [zurichDoc, baselDoc] = await Promise.all([
        RentalLocation.create({company: companyId, name: "Zurich Airport", timezone: "Europe/Zurich", openingHours: hours}),
        RentalLocation.create({company: companyId, name: "Basel", timezone: "Europe/Zurich", openingHours: hours}),
    ]);
    const [premiumDoc, economyDoc] = await Promise.all([
        VehicleCategory.create({
            company: companyId, name: "Premium", slug: "premium", seats: 5, transmission: "automatic", fuelType: "diesel", mileagePolicy: "unlimited",
            dailyRate: 100, depositAmount: 1000, rateSeasons: [{startDate: "2027-06-01", endDate: "2027-06-30", dailyRate: 140}],
        }),
        VehicleCategory.create({
            company: companyId, name: "Economy", slug: "economy", seats: 5, transmission: "manual", fuelType: "petrol", mileagePolicy: "limited",
            includedKmPerDay: 200, extraKmPrice: 0.2, dailyRate: 40,
        }),
    ]);
    const car = (input: Record<string, unknown>) => Vehicle.create({company: companyId, category: premiumDoc._id, homeLocation: zurichDoc._id, status: "active", ...input});
    const cars = await Promise.all([
        car({make: "BMW", model: "5 Series", plate: "ZH 1", listedAlone: true, dailyRate: 150}),
        car({make: "BMW", model: "5 Series", plate: "ZH 2"}),
        car({make: "Mercedes-Benz", model: "E-Class", plate: "BS 1", listedAlone: true, homeLocation: baselDoc._id}),
        Vehicle.create({company: companyId, category: economyDoc._id, homeLocation: zurichDoc._id, status: "active", make: "Fiat", model: "Panda", plate: "ZH 9"}),
    ]);
    // A car goes out only while insured to the return.
    await Promise.all(cars.map((doc) => VehicleInsurance.create({
        company: companyId, vehicle: doc._id, insurer: "Helvetia", policyNumber: `POL-${doc.plate}`, coverage: "full_casco",
        validFrom: new Date("2020-01-01"), expiresAt: new Date("2030-01-01"), status: "active",
    })));
    zurich = zurichDoc._id.toString();
    basel = baselDoc._id.toString();
    premium = premiumDoc._id.toString();
    economy = economyDoc._id.toString();
    [listed, unlisted, away] = cars.slice(0, 3).map((doc) => doc._id.toString());
}));

describe("cars rented on their own (D198)", {timeout: 60000}, () => {
    it("prices an exact car from its own list and never mixes in the group's season price", () => asCompany(async () => {
        const exact = await quote({vehicle: listed});
        expect(exact.status).toBe(200);
        expect(rentalTotal(exact.body.data.lines)).toBe(300);
        expect(exact.body.data.lines.find((line: {kind: string}) => line.kind === "rental").label).toBe("BMW 5 Series");
        // The class is priced from the group, whose June season applies.
        expect(rentalTotal((await quote({})).body.data.lines)).toBe(280);
    }));

    it("books the exact car and guarantees it, with the group's deposit when the car has none", () => asCompany(async () => {
        const response = await book({vehicle: listed, expectedTotal: 300});
        expect(response.status).toBe(200);
        expect(response.body.data.reservation).toMatchObject({exactVehicle: true, vehicleTitle: "BMW 5 Series"});
        const stored = await RentalReservation.findOne({});
        expect(String(stored!.vehicle)).toBe(listed);
        expect(stored!.exactVehicle).toBe(true);
        expect(String(stored!.pricing.depositAmount)).toBe("1000.00");
        await vi.waitFor(() => expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({kind: "confirmed", car: "BMW 5 Series"})));
    }));

    it("gives a class booking the cars not rented on their own first", () => asCompany(async () => {
        const response = await book({expectedTotal: 280});
        expect(response.status).toBe(200);
        expect(response.body.data.reservation.exactVehicle).toBe(false);
        expect(String((await RentalReservation.findOne({}))!.vehicle)).toBe(unlisted);
    }));

    it("refuses online a car not rented on its own, and a class booking of a group sold car by car", () => asCompany(async () => {
        expect((await quote({vehicle: unlisted})).body.error_code).toBe("rental_vehicle_not_listed");
        await VehicleCategory.updateOne({_id: premium}, {$set: {soldAsClass: false}});
        expect((await quote({})).body.error_code).toBe("rental_class_not_sold");
        expect((await quote({vehicle: listed})).status).toBe(200);
    }));

    it("offers a car at another branch only when the company brings cars over, with its fee and notice", () => asCompany(async () => {
        const elsewhere = await quote({vehicle: away});
        expect(elsewhere.body).toMatchObject({error_code: "rental_exact_car_elsewhere", message: "This car will be at Basel at that time. Pick it up there, or choose another car."});
        await CarRentalConfig.updateOne({company: companyId}, {$set: {exactCarTransfers: true, exactCarTransferFee: 30, exactCarTransferNoticeHours: 24}});
        const brought = await quote({vehicle: away});
        expect(brought.status).toBe(200);
        expect(brought.body.data.lines).toContainEqual(expect.objectContaining({code: "car_transfer", total: 30, label: "Bringing the car from Basel"}));
        // Picked up where it is, nothing is added.
        const there = await quote({vehicle: away, ...trip({pickupLocation: basel, returnLocation: basel})});
        expect(there.body.data.lines.some((line: {code?: string}) => line.code === "car_transfer")).toBe(false);
        // Too soon to bring it over.
        await CarRentalConfig.updateOne({company: companyId}, {$set: {exactCarTransferNoticeHours: 720}});
        const soon = localDateOf(new Date(Date.now() + 5 * 24 * 3600 * 1000), "Europe/Zurich");
        const later = localDateOf(new Date(Date.now() + 7 * 24 * 3600 * 1000), "Europe/Zurich");
        expect((await quote({vehicle: away, ...trip({pickupDate: soon, returnDate: later})})).body.error_code).toBe("rental_exact_car_notice");
    }));

    it("searches classes and the free cars rented on their own, each priced for the trip", () => asCompany(async () => {
        const first = await publicPost("search", trip());
        expect(first.body.data.results.map((row: {category: {name: string}}) => row.category.name).sort()).toEqual(["Economy", "Premium"]);
        expect(first.body.data.cars).toEqual([
            expect.objectContaining({car: expect.objectContaining({_id: listed, title: "BMW 5 Series", dailyRate: 150, depositAmount: 1000})}),
        ]);
        expect(rentalTotal(first.body.data.cars[0].quote.lines)).toBe(300);
        // Booked exactly, it is no longer offered; a group sold car by car leaves the classes.
        expect((await book({vehicle: listed, expectedTotal: 300})).status).toBe(200);
        await VehicleCategory.updateOne({_id: premium}, {$set: {soldAsClass: false}});
        const second = await publicPost("search", trip());
        expect(second.body.data.results.map((row: {category: {name: string}}) => row.category.name)).toEqual(["Economy"]);
        expect(second.body.data.cars).toEqual([]);
    }));

    it("leaves a car the platform hid off the site and out of online booking (D191)", () => asCompany(async () => {
        await Vehicle.updateOne({_id: listed}, {$set: {hiddenByPlatform: true}});
        expect((await publicPost("search", trip())).body.data.cars).toEqual([]);
        expect((await publicPost("config", {})).body.data.cars.map((car: {_id: string}) => car._id)).toEqual([away]);
        expect((await quote({vehicle: listed})).body.error_code).toBe("vehicle_not_found");
    }));

    it("lets staff book any car exactly, at its own price", () => asCompany(async () => {
        await Vehicle.updateOne({_id: unlisted}, {$set: {dailyRate: 120}});
        const created = await request(app).put("/api/carRental/rentalReservation").set(callerHeader(admin)).send({
            ...trip(), category: premium, vehicle: unlisted, exactVehicle: true, contact, paymentChoice: "pay_at_pickup",
            idempotencyKey: `key-${new ObjectId().toString()}`,
        });
        expect(created.status).toBe(200);
        const stored = await RentalReservation.findOne({});
        expect(stored!.exactVehicle).toBe(true);
        expect(String(stored!.pricing.grandTotal)).toBe("240.00");
        const missing = await request(app).put("/api/carRental/rentalReservation").set(callerHeader(admin)).send({
            ...trip({pickupDate: "2027-07-01", returnDate: "2027-07-02"}), category: premium, exactVehicle: true, contact,
            idempotencyKey: `key-${new ObjectId().toString()}`,
        });
        expect(missing.body.error_code).toBe("rental_exact_vehicle_required");
    }));

    it("charges an exact booking's extra days at the car's own price", () => asCompany(async () => {
        const {body} = await book({vehicle: listed, expectedTotal: 300});
        const extended = await action("extend", {_id: body.data.reservation._id, returnDate: "2027-06-12", returnTime: "10:00"});
        expect(extended.status).toBe(200);
        const stored = await RentalReservation.findById(body.data.reservation._id);
        expect(stored!.pricing.lines.filter((line) => line.kind === "extension").map((line) => [line.label, String(line.total)])).toEqual([["BMW 5 Series", "150.00"]]);
    }));

    it("lists every group's free cars for Change car, its own group first", () => asCompany(async () => {
        const {body} = await book({expectedTotal: 280});
        const free = await action("freeVehicles", {_id: body.data.reservation._id});
        expect(free.body.data.map((car: {groupName: string; sameGroup: boolean}) => [car.groupName, car.sameGroup])).toEqual([
            ["Premium", true],
            ["Premium", true],
            ["Economy", false],
        ]);
    }));

    it("moves an exact booking to another car as booked or re-priced, and tells the customer", () => asCompany(async () => {
        const {body} = await book({vehicle: listed, expectedTotal: 300});
        const id = body.data.reservation._id;
        const panda = (await Vehicle.findOne({plate: "ZH 9"}))!._id.toString();

        const kept = await action("reassignVehicle", {_id: id, vehicle: panda, pricing: "keep"});
        expect(kept.status).toBe(200);
        let stored = await RentalReservation.findById(id);
        expect(String(stored!.pricing.grandTotal)).toBe("300.00");
        expect(String(stored!.category)).toBe(economy);
        expect(stored!.snapshot).toMatchObject({categoryName: "Economy", vehicleTitle: "Fiat Panda", mileagePolicy: "unlimited"});
        await vi.waitFor(() => expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({kind: "carChanged", car: "Fiat Panda", note: "Fiat Panda"})));

        const repriced = await action("reassignVehicle", {_id: id, vehicle: unlisted, pricing: "reprice"});
        expect(repriced.status).toBe(200);
        stored = await RentalReservation.findById(id);
        // ZH 2 has no prices of its own: the Premium group's June season, and its deposit.
        expect(String(stored!.pricing.grandTotal)).toBe("280.00");
        expect(String(stored!.pricing.depositAmount)).toBe("1000.00");
        expect(stored!.snapshot).toMatchObject({categoryName: "Premium", vehicleTitle: "BMW 5 Series"});
    }));

    it("keeps a car booked exactly rented on its own until those bookings have another car", () => asCompany(async () => {
        await book({vehicle: listed, expectedTotal: 300});
        const unlist = await request(app).patch("/api/carRental/vehicle").set(callerHeader(admin)).send({_id: listed, category: premium, homeLocation: zurich, make: "BMW", model: "5 Series", plate: "ZH 1", status: "active", listedAlone: false});
        expect(unlist.body.error_code).toBe("vehicle_has_future_exact_reservations");
        // Its prices can still change; past bookings keep theirs.
        const repriced = await request(app).patch("/api/carRental/vehicle").set(callerHeader(admin)).send({_id: listed, category: premium, homeLocation: zurich, make: "BMW", model: "5 Series", plate: "ZH 1", status: "active", dailyRate: 170});
        expect(repriced.status).toBe(200);
        expect(repriced.body.rates).toMatchObject({dailyRate: 170, ownPrices: true, depositAmount: 1000, ownDeposit: false});
        expect(String((await RentalReservation.findOne({}))!.pricing.grandTotal)).toBe("300.00");
    }));

    it("sets a category's cars on their own, at their own day price and deposit, in one go", () => asCompany(async () => {
        const categoryAction = (name: string, body: Record<string, unknown>) =>
            request(app).post(`/api/carRental/vehicleCategory/${name}`).set(callerHeader(admin)).send(body);
        const before = await categoryAction("carPrices", {_id: premium});
        expect(before.body.data).toMatchObject({categoryDailyRate: 100, categoryDepositAmount: 1000});
        expect(before.body.data.cars.find((car: {_id: string}) => car._id === listed)).toMatchObject({listedAlone: true, dailyRate: 150, rates: {dailyRate: 150}});

        const saved = await categoryAction("setCarPrices", {_id: premium, cars: [
            {vehicle: listed, listedAlone: true},
            {vehicle: unlisted, listedAlone: true, dailyRate: 125, depositAmount: 1200},
        ]});
        expect(saved.status).toBe(200);
        expect((await Vehicle.findById(listed))!.dailyRate).toBeUndefined();
        expect(await Vehicle.findById(unlisted)).toMatchObject({listedAlone: true, dailyRate: 125, depositAmount: 1200});
        // A car of another category is refused, and one with exact bookings to come stays rented on its own.
        const panda = (await Vehicle.findOne({plate: "ZH 9"}))!._id.toString();
        expect((await categoryAction("setCarPrices", {_id: premium, cars: [{vehicle: panda, listedAlone: true}]})).body.error_code).toBe("vehicle_not_found");
        await book({vehicle: unlisted, expectedTotal: 250});
        expect((await categoryAction("setCarPrices", {_id: premium, cars: [{vehicle: unlisted, listedAlone: false}]})).body.error_code).toBe("vehicle_has_future_exact_reservations");
    }));

    it("reports lead time from when a booking was made, and class against exact revenue (TD-B290)", () => asCompany(async () => {
        const exact = await book({vehicle: listed, expectedTotal: 300});
        expect(exact.status).toBe(200);
        expect((await book({expectedTotal: 280})).status).toBe(200);
        // Made 10 days before pickup (as the demo backdates it), stored now: the lead time is 10 days, never negative.
        const id = exact.body.data.reservation._id;
        const pickupAt = (await RentalReservation.findById(id))!.pickupAt;
        await RentalReservation.updateMany({}, {$set: {"timeline.0.at": new Date(pickupAt.getTime() - 10 * 24 * 3600 * 1000)}});
        const report = await buildRentalReport(companyId, {from: "2027-06-01", to: "2027-06-30", timezone: "Europe/Zurich"});
        expect(report.summary.leadTimeDays).toBe(10);
        expect(report.bySaleKind).toEqual([
            {kind: "class", bookings: 1, revenue: 280},
            {kind: "exact", bookings: 1, revenue: 300},
        ]);
    }));

    it("shows a car's own specs where it has them, else its category's (TD-B291)", () => asCompany(async () => {
        const saved = await request(app).patch("/api/carRental/vehicle").set(callerHeader(admin)).send({
            _id: listed, category: premium, homeLocation: zurich, make: "BMW", model: "5 Series", plate: "ZH 1", status: "active",
            seats: 7, fuelType: "hybrid",
        });
        expect(saved.status).toBe(200);
        const car = (await publicPost("config", {})).body.data.cars.find((entry: {_id: string}) => entry._id === listed);
        expect(car).toMatchObject({seats: 7, fuelType: "hybrid", transmission: "automatic"});
        expect(car.doors).toBeUndefined();
    }));
});
