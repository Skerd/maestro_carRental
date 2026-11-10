import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({sendRentalCustomerMail: vi.fn(async () => undefined)}));

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

const companyId = new ObjectId();
/** The job runs for one company, as the cron runner sets it (D16). */
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);

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

    it("does nothing for a subscription that is not due or not active", () => asCompany(async () => {
        await subscribe("week", "2099-01-05T08:00:00Z");
        const paused = await subscribe("week", "2026-03-23T08:00:00Z");
        await RentalSubscription.updateOne({_id: paused._id}, {$set: {status: "paused"}});

        await runRentalSubscriptions(companyId);

        expect(await RentalReservation.countDocuments({})).toBe(0);
        expect((await RentalSubscription.findById(paused._id))!.nextRunAt).toEqual(new Date("2026-03-23T08:00:00Z"));
    }));
});
