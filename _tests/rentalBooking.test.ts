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
vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({sendRentalCustomerMail: vi.fn(async () => undefined)}));
const {stripe} = vi.hoisted(() => ({
    stripe: {
        isEnabled: () => true,
        toMinorUnits: (amount: number) => Math.round(amount * 100),
        createRefund: vi.fn(async () => ({id: "re_1", status: "succeeded"})),
        cancelPaymentIntent: vi.fn(async () => ({id: "pi", status: "canceled"})),
        createPaymentIntent: vi.fn(async () => ({id: "pi_test", clientSecret: "secret", status: "requires_payment_method"})),
    },
}));
vi.mock("@financeModule/utilities/services/payment/paymentService", () => ({getPaymentAdapter: () => stripe}));
vi.mock("@financeModule/environment", () => ({PAYMENTS: {STRIPE_ENABLED: true, STRIPE_PUBLISHABLE_KEY: "pk_test"}}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import Currency from "@coreModule/database/schemas/currency/currency";
import PaymentTransaction from "@financeModule/database/schemas/paymentTransaction/paymentTransaction";
import * as reservationRoute from "@carRentalModule/api/carRental/private/rentalReservation";
import * as vehicleRoute from "@carRentalModule/api/carRental/private/vehicle";
import * as vehicleBlockRoute from "@carRentalModule/api/carRental/private/vehicleBlock";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {settleRentalPayment} from "@carRentalModule/utilities/services/rentalLifecycle";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {runRentalHoldExpiry} from "@carRentalModule/utilities/cronJobs/rentalHoldExpiryJob";

// Transactions need a replica set; WiredTiger so concurrent requests really conflict
let replSet: MongoMemoryReplSet;
const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const userId = new ObjectId();
const app = appFor([reservationRoute, vehicleRoute, vehicleBlockRoute, storefrontRoute]);
const logger: any = {err: vi.fn(), warn: vi.fn(), debug: vi.fn(), start: vi.fn(), finish: vi.fn()};

let admin: TestCaller;
let outsider: TestCaller;
let locationId: string;
let categoryId: string;
let vehicleId: string;

/** A trip on Wednesday 10–12 June 2027 (far enough ahead for the lead time), Zurich local time. */
const trip = (overrides: Record<string, string> = {}) => ({
    pickupLocation: locationId,
    returnLocation: locationId,
    pickupDate: "2027-06-09",
    pickupTime: "10:00",
    returnDate: "2027-06-11",
    returnTime: "10:00",
    ...overrides,
});
const contact = {firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+41 79 000 00 00"};
const book = (body: Record<string, unknown>) => request(app).post("/api/carRental/rentalStorefront/book").set(callerHeader(admin)).send({
    ...trip(),
    category: categoryId,
    contact,
    paymentChoice: "pay_at_pickup",
    acceptTerms: true,
    expectedTotal: 100,
    idempotencyKey: `key-${new ObjectId().toString()}`,
    ...body,
});

beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({replSet: {count: 1, storageEngine: "wiredTiger"}});
    await mongoose.connect(replSet.getUri());
    await Promise.all([RentalReservation.init(), Vehicle.init(), CarRentalConfig.init()]);
    admin = {
        userId: userId.toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([RentalReservation, Vehicle, VehicleBlock]),
    };
    outsider = {...admin, companyId: otherCompanyId.toString()};
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    // Raw collection deletes: the soft-delete plugin would only mark the rows deleted
    await Promise.all([CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, VehicleBlock, RentalReservation, PaymentTransaction, Currency]
        .map((model) => model.collection.deleteMany({})));
    vi.clearAllMocks();
    const currency = await Currency.create({name: "Swiss franc", symbol: "CHF", abbreviation: "CHF", decimalPlaces: 2, company: companyId});
    await CarRentalConfig.create({
        company: companyId,
        currency: currency._id,
        publicBookingEnabled: true,
        turnaroundBufferMinutes: 60,
        minRentalHours: 4,
        freeCancellationHours: 48,
        cancellationFeePercent: 20,
        paymentPolicy: "customer_choice",
    });
    const location = await RentalLocation.create({
        company: companyId,
        name: "Zurich Airport",
        timezone: "Europe/Zurich",
        openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
    });
    const category = await VehicleCategory.create({
        company: companyId, name: "Compact", slug: "compact", seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 50, mileagePolicy: "unlimited",
    });
    const vehicle = await Vehicle.create({company: companyId, category: category._id, make: "VW", model: "Golf", plate: "ZH 1", homeLocation: location._id, status: "active"});
    locationId = location._id.toString();
    categoryId = category._id.toString();
    vehicleId = vehicle._id.toString();
});

describe("booking a car", {timeout: 60000}, () => {
    it("confirms a pay-at-pickup booking with a full snapshot and a vehicle", async () => {
        const response = await book({});
        expect(response.status).toBe(200);
        expect(response.body.data.reservation).toMatchObject({status: "confirmed", categoryName: "Compact", pickupLocationName: "Zurich Airport"});
        expect(response.body.data.reservation.pricing.grandTotal).toBe(100);
        expect(response.body.data.manageToken).toBeTruthy();

        const stored = await RentalReservation.findOne({});
        expect(String(stored!.vehicle)).toBe(vehicleId);
        // Pickup 10:00 Zurich summer time = 08:00 UTC; busy until return + 60 min turnaround
        expect(stored!.pickupAt.toISOString()).toBe("2027-06-09T08:00:00.000Z");
        expect(stored!.blockedUntil.toISOString()).toBe("2027-06-11T09:00:00.000Z");
    });

    it("books the last car exactly once when two customers try at the same moment", async () => {
        const responses = await Promise.all([book({}), book({}), book({})]);
        const statuses = responses.map((response) => response.status).sort();
        expect(statuses).toEqual([200, 409, 409]);
        for (const failed of responses.filter((response) => response.status === 409)) {
            expect(failed.body.error_code).toBe("rental_category_unavailable");
        }
        expect(await RentalReservation.countDocuments({})).toBe(1);
    });

    it("lets a booking start after the turnaround and refuses one inside it", async () => {
        expect((await book({})).status).toBe(200);
        // Previous return 10:00 + 60 min buffer: 10:30 clashes, 11:00 is free
        const clash = await book({...trip({pickupDate: "2027-06-11", pickupTime: "10:30", returnDate: "2027-06-12", returnTime: "10:30"}), expectedTotal: 50});
        expect(clash.body.error_code).toBe("rental_category_unavailable");
        const next = await book({...trip({pickupDate: "2027-06-11", pickupTime: "11:00", returnDate: "2027-06-12", returnTime: "11:00"}), expectedTotal: 50});
        expect(next.status).toBe(200);
    });

    it("returns the same reservation for a retried request", async () => {
        const idempotencyKey = `key-${new ObjectId().toString()}`;
        const first = await book({idempotencyKey});
        const second = await book({idempotencyKey});
        expect(second.status).toBe(200);
        expect(second.body.data.reservation._id).toBe(first.body.data.reservation._id);
        expect(await RentalReservation.countDocuments({})).toBe(1);
    });

    it("refuses a price the server no longer agrees with", async () => {
        const response = await book({expectedTotal: 80});
        expect(response.status).toBe(409);
        expect(response.body.error_code).toBe("rental_price_changed");
    });

    it("refuses a pickup time skipped by the spring-forward change", async () => {
        const response = await book(trip({pickupDate: "2027-03-28", pickupTime: "02:30", returnDate: "2027-03-29", returnTime: "10:00"}));
        expect(response.body.error_code).toBe("rental_invalid_pickup_time");
    });

    it("frees the car once an online hold runs out, before any sweeper runs", async () => {
        const held = await book({paymentChoice: "online"});
        expect(held.body.data.reservation.status).toBe("held");
        expect(held.body.data.payment.clientSecret).toBe("secret");
        expect((await book({})).status).toBe(409);

        await RentalReservation.updateOne({}, {$set: {holdExpiresAt: new Date(Date.now() - 1000)}});
        expect((await book({})).status).toBe(200);
    });

    it("refuses public booking until it is switched on", async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {publicBookingEnabled: false}});
        expect((await book({})).body.error_code).toBe("car_rental_not_configured");
    });
});

describe("staff work on reservations", {timeout: 60000}, () => {
    it("never shows one company's reservation to another", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const own = await request(app).post("/api/carRental/rentalReservation/single").set(callerHeader(admin)).send({_id: id});
        expect(own.status).toBe(200);
        const foreign = await request(app).post("/api/carRental/rentalReservation/single").set(callerHeader(outsider)).send({_id: id});
        expect(foreign.status).not.toBe(200);
        const foreignCancel = await request(app).post("/api/carRental/rentalReservation/cancel").set(callerHeader(outsider)).send({_id: id});
        expect(foreignCancel.body.error_code).toBe("rental_reservation_not_found");
    });

    it("records a counter payment and refunds it minus the late-cancellation fee", async () => {
        // Pickup tomorrow, inside the 48 h free-cancellation window
        const tomorrow = new Date(Date.now() + 26 * 3600 * 1000).toISOString().slice(0, 10);
        const dayAfter = new Date(Date.now() + 50 * 3600 * 1000).toISOString().slice(0, 10);
        const {body} = await book({...trip({pickupDate: tomorrow, pickupTime: "12:00", returnDate: dayAfter, returnTime: "12:00"}), expectedTotal: 50});
        const id = body.data.reservation._id;

        const paid = await request(app).post("/api/carRental/rentalReservation/recordPayment").set(callerHeader(admin)).send({_id: id, amount: 50});
        expect(paid.body.paymentStatus).toBe("paid");

        const cancelled = await request(app).post("/api/carRental/rentalReservation/cancel").set(callerHeader(admin))
            .send({_id: id, applyCancellationFee: true, reason: "customer called"});
        expect(cancelled.body.status).toBe("cancelled");
        expect(cancelled.body.amountPaid).toBe(10);
        expect(cancelled.body.paymentStatus).toBe("partially_refunded");
        expect(await PaymentTransaction.countDocuments({sourceId: new ObjectId(id), type: "refund", amount: 40})).toBe(1);
    });

    it("refuses to block a car over a booking, and to retire a car that has one", async () => {
        await book({});
        const block = await request(app).put("/api/carRental/vehicleBlock").set(callerHeader(admin)).send({
            vehicle: vehicleId, startAt: "2027-06-10T00:00:00.000Z", endAt: "2027-06-10T12:00:00.000Z", reason: "maintenance",
        });
        expect(block.body.error_code).toBe("vehicle_block_overlaps_reservation");

        const retire = await request(app).patch("/api/carRental/vehicle").set(callerHeader(admin)).send({_id: vehicleId, make: "VW", model: "Golf", plate: "ZH 1", status: "retired"});
        expect(retire.body.error_code).toBe("vehicle_has_future_reservations");
        expect((await Vehicle.findById(vehicleId))!.status).toBe("active");
    });
});

describe("online payment arrives", {timeout: 60000}, () => {
    const intentFor = (amountMinor: number) => ({id: "pi_test", amountMinor, currencyCode: "chf"});

    it("confirms a held booking", async () => {
        const {body} = await book({paymentChoice: "online"});
        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findById(body.data.reservation._id).session(session);
            await settleRentalPayment(reservation!, intentFor(10000), {session, logger, languageCode: "en-US"});
        });
        const stored = await RentalReservation.findById(body.data.reservation._id);
        expect(stored).toMatchObject({status: "confirmed", paymentStatus: "paid", amountPaid: 100});
    });

    it("cancels and refunds when the hold expired and the car was booked meanwhile", async () => {
        const {body} = await book({paymentChoice: "online"});
        await RentalReservation.updateOne({_id: body.data.reservation._id}, {$set: {holdExpiresAt: new Date(Date.now() - 1000)}});
        expect((await book({})).status).toBe(200);
        // The finance webhook records the charge before handing it to the module
        await PaymentTransaction.updateOne({gatewayTransactionId: "pi_test"}, {$set: {status: "succeeded"}});

        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findById(body.data.reservation._id).session(session);
            await settleRentalPayment(reservation!, intentFor(10000), {session, logger, languageCode: "en-US"});
        });
        const stored = await RentalReservation.findById(body.data.reservation._id);
        expect(stored).toMatchObject({status: "cancelled", cancellationReason: "payment_after_expiry", paymentStatus: "refunded"});
        expect(stripe.createRefund).toHaveBeenCalledTimes(1);
    });

    it("leaves a booking untouched when the amount paid is not its price", async () => {
        const {body} = await book({paymentChoice: "online"});
        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findById(body.data.reservation._id).session(session);
            await settleRentalPayment(reservation!, intentFor(500), {session, logger, languageCode: "en-US"});
        });
        expect((await RentalReservation.findById(body.data.reservation._id))!.status).toBe("held");
        expect(logger.err).toHaveBeenCalled();
    });
});

describe("on the road", {timeout: 60000}, () => {
    const action = (name: string, body: Record<string, unknown>) =>
        request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);

    it("hands over, extends, and takes back the car with extra charges", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;

        const handedOver = await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        expect(handedOver.body.status).toBe("in_progress");
        expect((await Vehicle.findById(vehicleId))!.odometerKm).toBe(12000);

        const extended = await action("extend", {_id: id, returnDate: "2027-06-12", returnTime: "10:00"});
        expect(extended.body.pricing.grandTotal).toBe(150);
        expect(extended.body.returnAt).toBe("2027-06-12T08:00:00.000Z");

        const returned = await action("returnVehicle", {
            _id: id, odometerKm: 12500, fuelLevel: "half", extraCharges: [{label: "Fuel refill", amount: 40}],
        });
        expect(returned.body.status).toBe("completed");
        expect(returned.body.pricing.grandTotal).toBe(190);
        expect(returned.body.paymentStatus).toBe("unpaid");
    });

    it("refuses an extension into another customer's booking", async () => {
        const first = await book({});
        await book({...trip({pickupDate: "2027-06-11", pickupTime: "12:00", returnDate: "2027-06-12", returnTime: "12:00"}), expectedTotal: 50});
        const extended = await action("extend", {_id: first.body.data.reservation._id, returnDate: "2027-06-11", returnTime: "18:00"});
        expect(extended.body.error_code).toBe("vehicle_unavailable");
    });

    it("records a no-show only after the pickup time has passed", async () => {
        const {body} = await book({});
        const early = await action("noShow", {_id: body.data.reservation._id});
        expect(early.body.error_code).toBe("rental_no_show_too_early");
    });

    it("expires a lapsed hold and cancels its payment intent", async () => {
        const {body} = await book({paymentChoice: "online"});
        await RentalReservation.updateOne({_id: body.data.reservation._id}, {$set: {holdExpiresAt: new Date(Date.now() - 1000)}});
        await runRentalHoldExpiry();
        expect((await RentalReservation.findById(body.data.reservation._id))!.status).toBe("expired");
        expect(stripe.cancelPaymentIntent).toHaveBeenCalledWith("pi_test");
    });
});
