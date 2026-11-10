import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({sendRentalCustomerMail: vi.fn(async () => undefined)}));
vi.mock("@coreModule/utilities/middlewares/authMW", async () => (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import Currency from "@coreModule/database/schemas/currency/currency";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalSubscription from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";
import {runRentalSubscriptions} from "@carRentalModule/utilities/cronJobs/rentalSubscriptionJob";
import * as subscriptionRoute from "@carRentalModule/api/carRental/private/rentalSubscription";
import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";

const companyId = new ObjectId();
/** The job runs for one company, as the cron runner sets it (D16). */
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const app = appFor([{basePath: subscriptionRoute.basePath, router: subscriptionRoute.router, module: "carRental"}]);
const staff: TestCaller = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true, permissions: allPermissionTags([RentalSubscription]), modules: ["core", "carRental"]};

let locationId: ObjectId;
let categoryId: ObjectId;

/** A subscription at the Zurich branch whose next booking starts at `nextRunAt`. */
const subscribe = (period: "week" | "month", nextRunAt: string) => RentalSubscription.create({
    company: companyId,
    contactName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+41 79 000 00 00",
    category: categoryId,
    pickupLocation: locationId,
    period,
    price: 300,
    status: "active",
    nextRunAt: new Date(nextRunAt),
});

beforeAll(async () => {
    await connectTestDatabase();
    // An index still building aborts the job's transaction.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    // Raw collection deletes: the soft-delete plugin would only mark the rows deleted
    await Promise.all([Currency, CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, VehicleInsurance, RentalReservation, RentalSubscription]
        .map((model) => model.collection.deleteMany({})));
    const currency = await Currency.create({name: "Swiss franc", symbol: "CHF", abbreviation: "CHF", decimalPlaces: 2, company: companyId});
    await CarRentalConfig.create({company: companyId, currency: currency._id, minRentalHours: 4, maxRentalDays: 31, paymentPolicy: "customer_choice"});
    const location = await RentalLocation.create({
        company: companyId,
        name: "Zurich Airport",
        timezone: "Europe/Zurich",
        openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
    });
    const category = await VehicleCategory.create({
        company: companyId, name: "Compact", slug: "compact", seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 50, mileagePolicy: "unlimited", minDriverAge: 21,
    });
    const vehicle = await Vehicle.create({company: companyId, category: category._id, make: "VW", model: "Golf", plate: "ZH 1", homeLocation: location._id, status: "active"});
    await VehicleInsurance.create({
        company: companyId, vehicle: vehicle._id, insurer: "Helvetia", policyNumber: "POL-1", coverage: "full_casco",
        validFrom: new Date("2020-01-01"), expiresAt: new Date("2030-01-01"), status: "active",
    });
    locationId = location._id;
    categoryId = category._id;
}));

describe("rental subscriptions", {timeout: 60000}, () => {
    // Regression (B4): the next date was a week or a month later in the server's zone, so across a DST change at the
    // branch the booking moved by an hour of local time.
    it("books a week at the same local time across both DST changes, and moves the next date the same way", () => asCompany(async () => {
        // Monday 09:00 in Zurich, the week summer time starts (Sunday 29 March 2026)
        const spring = await subscribe("week", "2026-03-23T08:00:00Z");
        // Monday 09:00 in Zurich, the week summer time ends (Sunday 25 October 2026)
        const autumn = await subscribe("week", "2026-10-19T07:00:00Z");

        await runRentalSubscriptions(companyId);

        const springBooking = await RentalReservation.findOne({idempotencyKey: `sub-${spring._id.toString()}-${Date.parse("2026-03-23T08:00:00Z")}`});
        expect(springBooking).toMatchObject({pickupAt: new Date("2026-03-23T08:00:00Z"), returnAt: new Date("2026-03-30T07:00:00Z")});
        expect((await RentalSubscription.findById(spring._id))!.nextRunAt).toEqual(new Date("2026-03-30T07:00:00Z"));

        const autumnBooking = await RentalReservation.findOne({idempotencyKey: `sub-${autumn._id.toString()}-${Date.parse("2026-10-19T07:00:00Z")}`});
        expect(autumnBooking).toMatchObject({pickupAt: new Date("2026-10-19T07:00:00Z"), returnAt: new Date("2026-10-26T08:00:00Z")});
        expect((await RentalSubscription.findById(autumn._id))!.nextRunAt).toEqual(new Date("2026-10-26T08:00:00Z"));
    }));

    it("books a month from the 31st to the last day of the next month", () => asCompany(async () => {
        // 31 January 2026, 09:00 in Zurich
        const subscription = await subscribe("month", "2026-01-31T08:00:00Z");

        await runRentalSubscriptions(companyId);

        const booking = await RentalReservation.findOne({});
        expect(booking).toMatchObject({pickupAt: new Date("2026-01-31T08:00:00Z"), returnAt: new Date("2026-02-28T08:00:00Z")});
        expect((await RentalSubscription.findById(subscription._id))!.nextRunAt).toEqual(new Date("2026-02-28T08:00:00Z"));
    }));

    // TD-B143: every month after a short one stayed on the 28th
    /** A second car of the category with its insurance: the first is out on the month booked before. */
    const secondCar = async () => {
        const vehicle = await Vehicle.create({company: companyId, category: categoryId, make: "VW", model: "Golf", plate: "ZH 2", homeLocation: locationId, status: "active"});
        await VehicleInsurance.create({
            company: companyId, vehicle: vehicle._id, insurer: "Helvetia", policyNumber: "POL-2", coverage: "full_casco",
            validFrom: new Date("2020-01-01"), expiresAt: new Date("2030-01-01"), status: "active",
        });
    };

    it("goes back to the 31st after a short month", () => asCompany(async () => {
        await secondCar();
        const subscription = await subscribe("month", "2026-01-31T08:00:00Z");

        await runRentalSubscriptions(companyId);
        expect(await RentalSubscription.findById(subscription._id)).toMatchObject({nextRunAt: new Date("2026-02-28T08:00:00Z"), anchorDay: 31});
        await runRentalSubscriptions(companyId);

        const march = await RentalReservation.findOne({idempotencyKey: `sub-${subscription._id.toString()}-${Date.parse("2026-02-28T08:00:00Z")}`});
        // 09:00 in Zurich on 31 March is summer time
        expect(march).toMatchObject({returnAt: new Date("2026-03-31T07:00:00Z")});
        expect((await RentalSubscription.findById(subscription._id))!.nextRunAt).toEqual(new Date("2026-03-31T07:00:00Z"));
    }));

    it("takes a next date staff moved as the new day of the month", async () => {
        const subscription = await asCompany(async () => {
            await secondCar();
            const created = await subscribe("month", "2026-01-31T08:00:00Z");
            await runRentalSubscriptions(companyId);
            return created;
        });
        const edit = (nextRunAt: string) => request(app).patch(subscriptionRoute.basePath).set(callerHeader(staff)).send({
            _id: subscription._id.toString(), contactName: "Ada Lovelace", email: "ada@example.com", phone: "+41 79 000 00 00",
            category: categoryId.toString(), pickupLocation: locationId.toString(), period: "month", price: 300, status: "active", nextRunAt,
        });

        // Saved unchanged: the anchor stays
        expect((await edit("2026-02-28T08:00:00.000Z")).status).toBe(200);
        expect((await asCompany(() => RentalSubscription.findById(subscription._id)))!.anchorDay).toBe(31);

        expect((await edit("2026-02-15T08:00:00.000Z")).status).toBe(200);
        expect((await asCompany(() => RentalSubscription.findById(subscription._id)))!.anchorDay).toBeUndefined();
        await asCompany(() => runRentalSubscriptions(companyId));
        expect(await asCompany(() => RentalSubscription.findById(subscription._id))).toMatchObject({nextRunAt: new Date("2026-03-15T08:00:00Z"), anchorDay: 15});
    });

    // D127 (TD-B170): with one car, each period ends exactly when the next starts, so the turnaround window refused it.
    describe("the next period while the car is out", () => {
        const WEEK_1 = "2026-03-02T08:00:00Z";
        const WEEK_2 = "2026-03-09T08:00:00Z";
        const bookingOf = (subscriptionId: ObjectId, pickupAt: string) =>
            RentalReservation.findOne({idempotencyKey: `sub-${subscriptionId.toString()}-${Date.parse(pickupAt)}`});
        /** Runs the first week and puts its booking in the given state. */
        const firstWeek = async (status: "in_progress" | "confirmed" | "completed") => {
            const subscription = await subscribe("week", WEEK_1);
            await runRentalSubscriptions(companyId);
            const booking = (await bookingOf(subscription._id, WEEK_1))!;
            await RentalReservation.updateOne({_id: booking._id}, {$set: {status}});
            return {subscription, booking};
        };

        it("continues on the same car at the return time while the customer still has it", () => asCompany(async () => {
            const {subscription, booking} = await firstWeek("in_progress");

            await runRentalSubscriptions(companyId);

            const next = await bookingOf(subscription._id, WEEK_2);
            expect(next).toMatchObject({pickupAt: new Date(WEEK_2), vehicle: booking.vehicle, status: "confirmed"});
            // Its own end keeps the turnaround window.
            expect(next!.blockedUntil).toEqual(new Date(Date.parse("2026-03-16T08:00:00Z") + 60 * 60_000));
            expect((await RentalSubscription.findById(subscription._id))!.nextRunAt).toEqual(new Date("2026-03-16T08:00:00Z"));
        }));

        it("keeps the turnaround window for a car that is not out with the customer", () => asCompany(async () => {
            // Booked but never handed over: the car is not out, so the normal rules apply and the only car is busy.
            const {subscription} = await firstWeek("confirmed");

            await runRentalSubscriptions(companyId);

            expect(await bookingOf(subscription._id, WEEK_2)).toBeNull();
            expect((await RentalSubscription.findById(subscription._id))!.nextRunAt).toEqual(new Date(WEEK_2));
        }));

        it("books a car that came back by the normal rules", () => asCompany(async () => {
            const {subscription, booking} = await firstWeek("completed");

            await runRentalSubscriptions(companyId);

            const next = await bookingOf(subscription._id, WEEK_2);
            expect(next).toMatchObject({pickupAt: new Date(WEEK_2), vehicle: booking.vehicle});
            expect(next!.blockedUntil).toEqual(new Date(Date.parse("2026-03-16T08:00:00Z") + 60 * 60_000));
        }));

        it("waits out the turnaround after another customer's booking", () => asCompany(async () => {
            // Another customer has the only car until the subscription's first pickup.
            const {subscription: other} = await firstWeek("in_progress");
            await RentalSubscription.updateOne({_id: other._id}, {$set: {status: "paused"}});
            const subscription = await subscribe("week", WEEK_2);

            await runRentalSubscriptions(companyId);

            expect(await bookingOf(subscription._id, WEEK_2)).toBeNull();
            expect((await RentalSubscription.findById(subscription._id))!.nextRunAt).toEqual(new Date(WEEK_2));
        }));
    });

    it("does nothing for a subscription that is not due or not active", () => asCompany(async () => {
        await subscribe("week", "2099-01-05T08:00:00Z");
        const paused = await subscribe("week", "2026-03-23T08:00:00Z");
        await RentalSubscription.updateOne({_id: paused._id}, {$set: {status: "paused"}});

        await runRentalSubscriptions(companyId);

        expect(await RentalReservation.countDocuments({})).toBe(0);
        expect((await RentalSubscription.findById(paused._id))!.nextRunAt).toEqual(new Date("2026-03-23T08:00:00Z"));
    }));
});
