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
        createPaymentIntent: vi.fn(async (input: {offSession?: unknown}) => (input.offSession
            ? {id: "pi_off", status: "succeeded"}
            : {id: "pi_test", clientSecret: "secret", status: "requires_payment_method"})),
        retrievePaymentIntent: vi.fn(async () => ({id: "pi_test", status: "requires_capture"})),
        capturePaymentIntent: vi.fn(async () => ({id: "pi_test", status: "succeeded"})),
        createSetupIntent: vi.fn(async () => ({id: "seti_test", clientSecret: "setup_secret", status: "requires_payment_method", customerId: "cus_test"})),
        retrieveSetupIntent: vi.fn(async () => ({id: "seti_test", status: "succeeded", customerId: "cus_test", paymentMethodId: "pm_test"})),
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
import * as vehicleDamageRoute from "@carRentalModule/api/carRental/private/vehicleDamage";
import * as vehicleFineRoute from "@carRentalModule/api/carRental/private/vehicleFine";
import * as vehicleTransferRoute from "@carRentalModule/api/carRental/private/vehicleTransfer";
import * as plannerRoute from "@carRentalModule/api/carRental/private/rentalPlanner";
import * as counterRoute from "@carRentalModule/api/carRental/private/rentalCounter";
import VehicleTransfer from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import Invoice, {InvoiceCounter} from "@financeModule/database/schemas/invoice/invoice";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalPromoCode from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import {generateRentalAgreementPdf} from "@carRentalModule/utilities/pdf/rentalAgreementPdf";
import {settleRentalPayment} from "@carRentalModule/utilities/services/rentalLifecycle";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {runRentalHoldExpiry} from "@carRentalModule/utilities/cronJobs/rentalHoldExpiryJob";

// Transactions need a replica set; WiredTiger so concurrent requests really conflict
let replSet: MongoMemoryReplSet;
const companyId = new ObjectId();
const otherCompanyId = new ObjectId();
const userId = new ObjectId();
const app = appFor([reservationRoute, vehicleRoute, vehicleBlockRoute, vehicleDamageRoute, vehicleFineRoute, vehicleTransferRoute, plannerRoute, counterRoute, storefrontRoute]);
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
    driverBirthDate: "1990-12-10",
    paymentChoice: "pay_at_pickup",
    acceptTerms: true,
    expectedTotal: 100,
    idempotencyKey: `key-${new ObjectId().toString()}`,
    ...body,
});

beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({replSet: {count: 1, storageEngine: "wiredTiger"}});
    await mongoose.connect(replSet.getUri());
    await Promise.all([RentalReservation.init(), Vehicle.init(), CarRentalConfig.init(), RentalPromoCode.init(), RentalExtra.init(), VehicleDamage.init(), VehicleFine.init(), Invoice.init(), InvoiceCounter.init(), VehicleTransfer.init()]);
    admin = {
        userId: userId.toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([RentalReservation, Vehicle, VehicleBlock, VehicleDamage, VehicleFine, VehicleTransfer]),
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
    await Promise.all([CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, VehicleBlock, RentalReservation, PaymentTransaction, Currency, RentalPromoCode, RentalExtra, VehicleDamage, VehicleFine, Invoice, InvoiceCounter, VehicleTransfer]
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
        company: companyId, name: "Compact", slug: "compact", seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 50, mileagePolicy: "unlimited", minDriverAge: 21,
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

describe("fees, promo codes and protection", {timeout: 60000}, () => {
    const quote = (body: Record<string, unknown>) =>
        request(app).post("/api/carRental/rentalStorefront/quote").set(callerHeader(admin)).send({...trip(), category: categoryId, ...body});

    it("charges young drivers per day and refuses a driver under the category minimum", async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {youngDriverUnderAge: 25, youngDriverDailyFee: 15}});
        const young = await quote({driverBirthDate: "2004-01-01"});
        expect(young.body.data.lines).toContainEqual(expect.objectContaining({kind: "fee", code: "young_driver", quantity: 2, unitPrice: 15, total: 30}));
        expect(young.body.data.grandTotal).toBe(130);
        expect((await quote({driverBirthDate: "1990-01-01"})).body.data.grandTotal).toBe(100);

        const booked = await book({driverBirthDate: "2004-01-01", expectedTotal: 130});
        expect(booked.status).toBe(200);
        const stored = await RentalReservation.findById(booked.body.data.reservation._id);
        expect(stored!.drivers).toMatchObject([{role: "primary", firstName: "Ada", birthDate: "2004-01-01"}]);
        expect((await book({driverBirthDate: "2008-01-01", expectedTotal: 130})).body.error_code).toBe("rental_driver_too_young");
    });

    it("adds the return location's one-way fee, else the company's", async () => {
        const other = await RentalLocation.create({
            company: companyId, name: "Basel", timezone: "Europe/Zurich", oneWayFee: 80,
            openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
        });
        const oneWay = await quote({returnLocation: other._id.toString()});
        expect(oneWay.body.data.lines).toContainEqual(expect.objectContaining({code: "one_way", total: 80}));
        await RentalLocation.updateOne({_id: other._id}, {$unset: {oneWayFee: 1}});
        await CarRentalConfig.updateOne({company: companyId}, {$set: {oneWayFee: 40}});
        expect((await quote({returnLocation: other._id.toString()})).body.data.grandTotal).toBe(140);
        expect((await quote({})).body.data.grandTotal).toBe(100);
    });

    it("discounts the rental days with a promo code and stops it once it is used up", async () => {
        await RentalPromoCode.create({company: companyId, code: "SUMMER10", type: "percent", value: 10, usageLimit: 1});
        const discounted = await quote({promoCode: "summer10"});
        expect(discounted.body.data.lines).toContainEqual(expect.objectContaining({kind: "discount", code: "promo", total: -10}));
        expect(discounted.body.data.grandTotal).toBe(90);

        const booked = await book({promoCode: "SUMMER10", expectedTotal: 90});
        expect(booked.status).toBe(200);
        expect((await RentalPromoCode.findOne({code: "SUMMER10"}))!.usageCount).toBe(1);
        expect((await quote({promoCode: "SUMMER10"})).body.error_code).toBe("rental_promo_code_used_up");
        expect((await quote({promoCode: "NOPE"})).body.error_code).toBe("rental_promo_code_invalid");
    });

    it("refuses a promo code outside its pickup window or below its minimum days", async () => {
        await RentalPromoCode.create({company: companyId, code: "LONG", type: "fixed", value: 25, minRentalDays: 5});
        await RentalPromoCode.create({company: companyId, code: "WINTER", type: "fixed", value: 25, tripFrom: new Date("2027-12-01"), tripUntil: new Date("2028-02-28")});
        expect((await quote({promoCode: "LONG"})).body.error_code).toBe("rental_promo_code_not_applicable");
        expect((await quote({promoCode: "WINTER"})).body.error_code).toBe("rental_promo_code_not_applicable");
    });

    it("takes the protection package's deposit and allows only one package", async () => {
        const basic = await RentalExtra.create({company: companyId, name: "Super cover", kind: "protection", pricing: "per_day", price: 12, maxQuantity: 1, excessAmount: 0, depositAmount: 100});
        const other = await RentalExtra.create({company: companyId, name: "Medium cover", kind: "protection", pricing: "per_day", price: 8, maxQuantity: 1});
        const covered = await quote({extras: [{extra: basic._id.toString(), quantity: 1}]});
        expect(covered.body.data.depositAmount).toBe(100);
        expect(covered.body.data.grandTotal).toBe(124);
        const both = await quote({extras: [{extra: basic._id.toString(), quantity: 1}, {extra: other._id.toString(), quantity: 1}]});
        expect(both.body.error_code).toBe("rental_protection_one_only");
    });
});

describe("where cars are", {timeout: 60000}, () => {
    const action = (name: string, body: Record<string, unknown>) =>
        request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);
    const driver = {role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10", licenseNumber: "CH-1", licenseExpiresAt: "2030-01-01"};
    let baselId: string;

    beforeEach(async () => {
        const basel = await RentalLocation.create({
            company: companyId, name: "Basel", timezone: "Europe/Zurich",
            openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
        });
        baselId = basel._id.toString();
    });

    it("puts the car where it was returned and asks for a transfer when it is booked elsewhere", async () => {
        const {body} = await book({returnLocation: baselId, expectedTotal: 100});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        await action("returnVehicle", {_id: id, odometerKm: 12300, fuelLevel: "full"});
        const car = await Vehicle.findById(vehicleId);
        expect(String(car!.currentLocation)).toBe(baselId);
        expect(car!.readiness).toBe("needs_cleaning");

        // The next booking picks up in Zurich, but the only car is in Basel.
        const next = await book({...trip({pickupDate: "2027-06-20", returnDate: "2027-06-21"}), expectedTotal: 50});
        expect((await RentalReservation.findById(next.body.data.reservation._id))!.needsTransfer).toBe(true);

        const ready = await request(app).post("/api/carRental/vehicle/setReadiness").set(callerHeader(admin)).send({_id: vehicleId, readiness: "ready"});
        expect(ready.body.readiness).toBe("ready");
    });

    it("lays out each car's bookings and blocks for the planner window", async () => {
        const {body} = await book({});
        await request(app).put("/api/carRental/vehicleTransfer").set(callerHeader(admin)).send({
            vehicle: vehicleId, fromLocation: locationId, toLocation: baselId, departAt: "2027-06-12 08:00", arriveAt: "2027-06-12 11:00",
        });
        const planner = await request(app).post("/api/carRental/rentalPlanner").set(callerHeader(admin)).send({from: "2027-06-08", days: 7});
        expect(planner.status).toBe(200);
        expect(planner.body.data).toMatchObject({timezone: "Europe/Zurich", from: "2027-06-07T22:00:00.000Z"});
        expect(planner.body.data.vehicles).toEqual([expect.objectContaining({_id: vehicleId, plate: "ZH 1", categoryName: "Compact", locationName: "Zurich Airport"})]);
        expect(planner.body.data.reservations.map((entry: {_id: string}) => entry._id)).toEqual([body.data.reservation._id]);
        expect(planner.body.data.blocks).toEqual([expect.objectContaining({reason: "transfer"})]);
        const elsewhere = await request(app).post("/api/carRental/rentalPlanner").set(callerHeader(admin)).send({from: "2027-06-08", days: 7, location: baselId});
        expect(elsewhere.body.data.vehicles).toEqual([]);
    });

    it("lists the day's pickups at the counter, in the location's time zone", async () => {
        const {body} = await book({});
        const counter = (date: string) => request(app).post("/api/carRental/rentalCounter").set(callerHeader(admin)).send({date, location: locationId});
        const day = await counter("2027-06-09");
        expect(day.status).toBe(200);
        expect(day.body.data.pickups.map((entry: {_id: string}) => entry._id)).toEqual([body.data.reservation._id]);
        expect(day.body.data.returns).toEqual([]);
        expect((await counter("2027-06-10")).body.data.pickups).toEqual([]);
    });

    it("blocks the car on a transfer and counts it at the destination once it arrives", async () => {
        const planned = await request(app).put("/api/carRental/vehicleTransfer").set(callerHeader(admin)).send({
            vehicle: vehicleId, fromLocation: locationId, toLocation: baselId, departAt: "2027-06-01 08:00", arriveAt: "2027-06-01 11:00",
        });
        expect(planned.status).toBe(200);
        const transfer = await VehicleTransfer.findOne({vehicle: vehicleId});
        expect(transfer).toMatchObject({status: "planned"});
        expect(await VehicleBlock.countDocuments({vehicle: vehicleId, reason: "transfer", deletedAt: null})).toBe(1);
        // A booking that would pick up in Zurich after the transfer needs the car brought back.
        const after = await book({});
        expect((await RentalReservation.findById(after.body.data.reservation._id))!.needsTransfer).toBe(true);

        const done = await request(app).post("/api/carRental/vehicleTransfer/complete").set(callerHeader(admin)).send({_id: transfer!._id.toString()});
        expect(done.body.status).toBe("done");
        expect(String((await Vehicle.findById(vehicleId))!.currentLocation)).toBe(baselId);
        const same = await request(app).put("/api/carRental/vehicleTransfer").set(callerHeader(admin)).send({
            vehicle: vehicleId, fromLocation: baselId, toLocation: baselId, departAt: "2027-07-01 08:00", arriveAt: "2027-07-01 11:00",
        });
        expect(same.body.error_code).toBe("rental_transfer_same_location");
    });
});

describe("on the road", {timeout: 60000}, () => {
    const action = (name: string, body: Record<string, unknown>) =>
        request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);

    const driver = {
        role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10",
        licenseNumber: "CH-123456", licenseCountry: "Switzerland", licenseExpiresAt: "2030-01-31",
    };

    it("hands over, extends, and takes back the car with extra charges", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const saved = await action("saveDrivers", {_id: id, drivers: [driver]});
        expect(saved.body.drivers).toEqual([driver]);

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

    it("refuses the handover until every driver has a licence valid to the return day", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const handover = () => action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});

        // The online booking named the customer as main driver, without a licence yet.
        expect((await handover()).body.error_code).toBe("rental_driver_license_missing");
        // The trip ends on 11 June 2027; a licence valid only to the day before is not enough.
        await action("saveDrivers", {_id: id, drivers: [driver, {...driver, role: "additional", firstName: "Charles", licenseExpiresAt: "2027-06-10"}]});
        expect((await handover()).body.error_code).toBe("rental_driver_license_expired");
        await action("saveDrivers", {_id: id, drivers: [driver, {...driver, role: "additional", firstName: "Charles", licenseExpiresAt: "2027-06-11"}]});
        expect((await handover()).body.status).toBe("in_progress");
    });

    it("refuses a driver list without one main driver or with a driver under the minimum age", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const twoMain = await action("saveDrivers", {_id: id, drivers: [driver, {...driver, firstName: "Charles"}]});
        expect(twoMain.body.error_code).toBe("rental_driver_primary_required");
        // 21 is the category minimum: still 20 on 9 June 2027.
        const young = await action("saveDrivers", {_id: id, drivers: [{...driver, birthDate: "2006-06-10"}]});
        expect(young.body.error_code).toBe("rental_driver_too_young");
        const birthday = await action("saveDrivers", {_id: id, drivers: [{...driver, birthDate: "2006-06-09"}]});
        expect(birthday.status).toBe(200);
    });

    it("keeps the damage the customer saw at pickup and files new damage found at the return", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        const scratch = await VehicleDamage.create({
            company: companyId, vehicle: vehicleId, reportedAt: new Date("2027-05-01"), area: "rear", severity: "minor", description: "Scratch on the bumper", status: "open",
        });
        const fixed = await VehicleDamage.create({
            company: companyId, vehicle: vehicleId, reportedAt: new Date("2027-04-01"), area: "front", severity: "minor", description: "Old dent", status: "repaired",
        });

        const refused = await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full", acknowledgedDamages: [fixed._id.toString()]});
        expect(refused.body.error_code).toBe("vehicle_damage_reservation_mismatch");
        expect((await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full", photos: [new ObjectId().toString()]})).body.error_code).toBe("rental_media_not_found");

        const handedOver = await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full", acknowledgedDamages: [scratch._id.toString()]});
        expect(handedOver.body.handover.acknowledgedDamages).toEqual([scratch._id.toString()]);
        expect(handedOver.body.agreement).toEqual({});

        const returned = await action("returnVehicle", {
            _id: id, odometerKm: 12400, fuelLevel: "full",
            newDamages: [{area: "left", severity: "moderate", description: "Door dent", estimatedCost: 300}],
        });
        expect(returned.body.returnInfo.damageNoted).toBe(true);
        const filed = await VehicleDamage.findOne({reservation: id});
        expect(filed).toMatchObject({area: "left", severity: "moderate", status: "open", estimatedCost: 300});

        const pdf = await generateRentalAgreementPdf((await RentalReservation.findById(id))!, "en-US");
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("charges damage to the customer, never beyond the protection package's excess", async () => {
        const cover = await RentalExtra.create({company: companyId, name: "Medium cover", kind: "protection", pricing: "per_rental", price: 20, maxQuantity: 1, excessAmount: 200});
        const {body} = await book({extras: [{extra: cover._id.toString(), quantity: 1}], expectedTotal: 120});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        await action("returnVehicle", {
            _id: id, odometerKm: 12100, fuelLevel: "full",
            newDamages: [{area: "left", severity: "major", description: "Door dent"}, {area: "rear", severity: "minor", description: "Scratch"}],
        });
        const [dent, scratch] = await VehicleDamage.find({reservation: id}).sort({area: 1});
        const charge = (damageId: string, amount: number) =>
            request(app).post("/api/carRental/vehicleDamage/chargeToCustomer").set(callerHeader(admin)).send({_id: damageId, amount});

        const first = await charge(dent._id.toString(), 450);
        expect(first.body.chargedAmount).toBe(200);
        expect((await charge(dent._id.toString(), 10)).body.error_code).toBe("vehicle_damage_already_charged");
        expect((await charge(scratch._id.toString(), 50)).body.error_code).toBe("vehicle_damage_excess_reached");

        const stored = await RentalReservation.findById(id);
        expect(stored!.pricing.lines).toContainEqual(expect.objectContaining({kind: "charge", code: "damage", total: 200}));
        expect(stored!.pricing.grandTotal).toBe(320);
        expect(stored!.timeline.map((entry) => entry.event)).toContain("charge_added");
        // The return invoiced the rental; the later damage charge got its own invoice.
        const invoices = await Invoice.find({sourceId: id}).sort({number: 1});
        expect(invoices.map((invoice) => invoice.total)).toEqual([120, 200]);
        expect(invoices[0].lines.map((line) => line.description)).toEqual(["Compact", "Medium cover"]);
        expect(invoices[1]).toMatchObject({number: expect.stringMatching(/^INV-\d{4}-000002$/), sourceNumber: stored!.number});
    });

    it("holds a cash deposit and keeps part of it for what is owed", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const taken = await action("takeDeposit", {_id: id, method: "cash", amount: 300});
        expect(taken.body.data.reservation.deposit).toMatchObject({method: "cash", status: "held", amount: 300});
        expect((await action("takeDeposit", {_id: id, method: "cash"})).body.error_code).toBe("rental_deposit_already_taken");
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        expect((await action("settleDeposit", {_id: id, keepAmount: 400})).body.error_code).toBe("rental_deposit_keep_too_high");
        const settled = await action("settleDeposit", {_id: id, keepAmount: 60});
        expect(settled.body.deposit).toMatchObject({status: "captured", capturedAmount: 60});
        expect(settled.body.amountPaid).toBe(60);
    });

    it("holds the card for a short rental, then releases the hold", async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const taken = await action("takeDeposit", {_id: id, method: "card", amount: 250});
        expect(taken.body.data.payment).toMatchObject({kind: "payment", clientSecret: "secret"});
        expect(stripe.createPaymentIntent).toHaveBeenLastCalledWith(expect.objectContaining({amount: 250, captureMethod: "manual"}));
        expect(taken.body.data.reservation.deposit).toMatchObject({method: "card_hold", status: "pending"});
        expect((await action("refreshDeposit", {_id: id})).body.deposit.status).toBe("held");
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        const released = await action("settleDeposit", {_id: id, keepAmount: 0});
        expect(released.body.deposit.status).toBe("released");
        expect(stripe.cancelPaymentIntent).toHaveBeenCalledWith("pi_test");
    });

    it("saves the card for a long rental and charges it later without the customer", async () => {
        const {body} = await book({...trip({returnDate: "2027-06-17"}), expectedTotal: 400});
        const id = body.data.reservation._id;
        const taken = await action("takeDeposit", {_id: id, method: "card", amount: 500});
        expect(taken.body.data.payment).toMatchObject({kind: "setup", clientSecret: "setup_secret"});
        const held = await action("refreshDeposit", {_id: id});
        expect(held.body.deposit).toMatchObject({method: "saved_card", status: "held", hasSavedCard: true});
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        const charged = await action("settleDeposit", {_id: id, keepAmount: 100});
        expect(charged.body.amountPaid).toBe(100);
        expect(stripe.createPaymentIntent).toHaveBeenLastCalledWith(expect.objectContaining({amount: 100, offSession: {customerId: "cus_test", paymentMethodId: "pm_test"}}));
        expect(await PaymentTransaction.countDocuments({gatewayTransactionId: "pi_off", status: "succeeded"})).toBe(1);
    });

    it("matches a fine to the driver at the time and charges it with the handling fee to the saved card", async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {fineAdminFee: 25}});
        const {body} = await book({...trip({returnDate: "2027-06-17"}), expectedTotal: 400});
        const id = body.data.reservation._id;
        await action("takeDeposit", {_id: id, method: "card", amount: 500});
        await action("refreshDeposit", {_id: id});
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        await RentalReservation.updateOne({_id: id}, {$set: {"handover.at": new Date("2027-06-09T08:15:00Z")}});
        await action("settleDeposit", {_id: id, keepAmount: 400});

        const fines = (path: string, payload: Record<string, unknown>) =>
            request(app).post(`/api/carRental/vehicleFine${path}`).set(callerHeader(admin)).send(payload);
        const created = await request(app).put("/api/carRental/vehicleFine").set(callerHeader(admin)).send({
            reference: "TR-2027-118", vehicle: vehicleId, offenceAt: "2027-06-10 14:30", type: "speeding", authority: "Kantonspolizei Zürich", amount: 120,
        });
        expect(created.status).toBe(200);
        const fine = await VehicleFine.findOne({reference: "TR-2027-118"});
        expect(String(fine!.reservation)).toBe(id);
        expect(fine).toMatchObject({driverName: "Ada Lovelace", status: "driver_identified"});

        const charged = await fines("/chargeCustomer", {_id: fine!._id.toString()});
        expect(charged.body).toMatchObject({status: "charged", chargedAmount: 145});
        expect((await fines("/chargeCustomer", {_id: fine!._id.toString()})).body.error_code).toBe("rental_fine_already_charged");
        const stored = await RentalReservation.findById(id);
        expect(stored!.pricing.lines.filter((line) => line.code === "fine" || line.code === "fine_admin").map((line) => line.total)).toEqual([120, 25]);
        expect(stored!.amountPaid).toBe(545);
        expect(stripe.createPaymentIntent).toHaveBeenLastCalledWith(expect.objectContaining({amount: 145, offSession: expect.anything()}));
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
        await runRentalHoldExpiry(companyId);
        expect((await RentalReservation.findById(body.data.reservation._id))!.status).toBe("expired");
        expect(stripe.cancelPaymentIntent).toHaveBeenCalledWith("pi_test");
    });
});
