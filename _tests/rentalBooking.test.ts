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
    // Records the tenant like the real resolver (D16).
    const {setRequestTenant} = await import("@coreModule/utilities/endpoints/tenantScope");
    return {
        resolveCompanyByOrigin: async () => {
            if (originCompany.current) setRequestTenant(originCompany.current._id.toString());
            return originCompany.current;
        },
    };
});
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
import * as vehicleRoute from "@carRentalModule/api/carRental/private/checked/vehicle";
import * as vehicleBlockRoute from "@carRentalModule/api/carRental/private/vehicleBlock";
import * as vehicleDamageRoute from "@carRentalModule/api/carRental/private/vehicleDamage";
import * as vehicleFineRoute from "@carRentalModule/api/carRental/private/vehicleFine";
import * as vehicleTransferRoute from "@carRentalModule/api/carRental/private/vehicleTransfer";
import * as vehicleMaintenanceRoute from "@carRentalModule/api/carRental/private/vehicleMaintenance";
import * as vehicleInsuranceRoute from "@carRentalModule/api/carRental/private/vehicleInsurance";
import * as vehicleDocumentRoute from "@carRentalModule/api/carRental/private/vehicleDocument";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import * as plannerRoute from "@carRentalModule/api/carRental/private/rentalPlanner";
import * as counterRoute from "@carRentalModule/api/carRental/private/rentalCounter";
import * as denyEntryRoute from "@carRentalModule/api/carRental/private/rentalDenyEntry";
import RentalDenyEntry from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";
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
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import {generateRentalAgreementPdf} from "@carRentalModule/utilities/pdf/rentalAgreementPdf";
import {settleRentalPayment} from "@carRentalModule/workflows/rentalLifecycle";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {runRentalHoldExpiry} from "@carRentalModule/utilities/cronJobs/rentalHoldExpiryJob";
import {buildRentalReport} from "@carRentalModule/utilities/services/rentalReports";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";

const companyId = new ObjectId();
/** The tests act on this company's data, as its requests and jobs do (D16). */
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const otherCompanyId = new ObjectId();
const userId = new ObjectId();
// carRental pilots tenant-scope enforcement (D16): its routes run enforced, as in the dev profiles.
const app = appFor([
    reservationRoute, vehicleRoute, vehicleBlockRoute, vehicleDamageRoute, vehicleFineRoute, vehicleTransferRoute, vehicleMaintenanceRoute, vehicleInsuranceRoute, vehicleDocumentRoute,
    plannerRoute, counterRoute, storefrontRoute, denyEntryRoute,
].map((route) => ({...route, module: "carRental"})));
const logger: any = {err: vi.fn(), warn: vi.fn(), debug: vi.fn(), start: vi.fn(), finish: vi.fn()};

let admin: TestCaller;
let outsider: TestCaller;
let fleetAdmin: TestCaller;
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

const insure = (vehicle: ObjectId, input: {validFrom?: string; expiresAt?: string; coverage?: string} = {}) => VehicleInsurance.create({
    company: companyId,
    vehicle,
    insurer: "Helvetia",
    policyNumber: `POL-${new ObjectId().toString().slice(-6)}`,
    coverage: input.coverage ?? "full_casco",
    validFrom: new Date(input.validFrom ?? "2020-01-01"),
    expiresAt: new Date(input.expiresAt ?? "2030-01-01"),
    status: "active",
});

beforeAll(async () => {
    await connectTestDatabase();
    // Every registered model (audit log, users…): an index still building aborts a transaction that touches it.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    admin = {
        userId: userId.toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([RentalReservation, Vehicle, VehicleBlock, VehicleDamage, VehicleFine, VehicleTransfer]),
    };
    // One header cannot carry every model's tags: the service log and the papers get their own caller.
    fleetAdmin = {...admin, permissions: allPermissionTags([RentalReservation, VehicleMaintenance, VehicleInsurance, VehicleDocument])};
    outsider = {...admin, companyId: otherCompanyId.toString()};
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    // Raw collection deletes: the soft-delete plugin would only mark the rows deleted
    await Promise.all([CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, VehicleBlock, RentalReservation, PaymentTransaction, Currency, RentalPromoCode, RentalExtra, VehicleDamage, VehicleFine, Invoice, InvoiceCounter, VehicleTransfer,
        VehicleMaintenance, VehicleInsurance, VehicleDocument]
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
    // A car is only handed over while insured to the return.
    await insure(vehicle._id);
    locationId = location._id.toString();
    categoryId = category._id.toString();
    vehicleId = vehicle._id.toString();
}));

describe("booking a car", {timeout: 60000}, () => {
    it("confirms a pay-at-pickup booking with a full snapshot and a vehicle", () => asCompany(async () => {
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
    }));

    it("books the last car exactly once when two customers try at the same moment", () => asCompany(async () => {
        const responses = await Promise.all([book({}), book({}), book({})]);
        const statuses = responses.map((response) => response.status).sort();
        expect(statuses).toEqual([200, 409, 409]);
        // Under load a loser can run out of transaction retries before it sees the booked car (TD-B124): still a loss.
        for (const failed of responses.filter((response) => response.status === 409)) {
            expect(["rental_category_unavailable", "concurrent_request_retry"]).toContain(failed.body.error_code);
        }
        expect(await RentalReservation.countDocuments({})).toBe(1);
    }));

    it("lets a booking start after the turnaround and refuses one inside it", () => asCompany(async () => {
        expect((await book({})).status).toBe(200);
        // Previous return 10:00 + 60 min buffer: 10:30 clashes, 11:00 is free
        const clash = await book({...trip({pickupDate: "2027-06-11", pickupTime: "10:30", returnDate: "2027-06-12", returnTime: "10:30"}), expectedTotal: 50});
        expect(clash.body.error_code).toBe("rental_category_unavailable");
        const next = await book({...trip({pickupDate: "2027-06-11", pickupTime: "11:00", returnDate: "2027-06-12", returnTime: "11:00"}), expectedTotal: 50});
        expect(next.status).toBe(200);
    }));

    it("returns the same reservation for a retried request", () => asCompany(async () => {
        const idempotencyKey = `key-${new ObjectId().toString()}`;
        const first = await book({idempotencyKey});
        const second = await book({idempotencyKey});
        expect(second.status).toBe(200);
        expect(second.body.data.reservation._id).toBe(first.body.data.reservation._id);
        expect(await RentalReservation.countDocuments({})).toBe(1);
    }));

    it("refuses a price the server no longer agrees with", () => asCompany(async () => {
        const response = await book({expectedTotal: 80});
        expect(response.status).toBe(409);
        expect(response.body.error_code).toBe("rental_price_changed");
    }));

    it("refuses a pickup time skipped by the spring-forward change", () => asCompany(async () => {
        const response = await book(trip({pickupDate: "2027-03-28", pickupTime: "02:30", returnDate: "2027-03-29", returnTime: "10:00"}));
        expect(response.body.error_code).toBe("rental_invalid_pickup_time");
    }));

    it("frees the car once an online hold runs out, before any sweeper runs", () => asCompany(async () => {
        const held = await book({paymentChoice: "online"});
        expect(held.body.data.reservation.status).toBe("held");
        expect(held.body.data.payment.clientSecret).toBe("secret");
        expect((await book({})).status).toBe(409);

        await RentalReservation.updateOne({}, {$set: {holdExpiresAt: new Date(Date.now() - 1000)}});
        expect((await book({})).status).toBe(200);
    }));

    it("refuses public booking until it is switched on", () => asCompany(async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {publicBookingEnabled: false}});
        expect((await book({})).body.error_code).toBe("car_rental_not_configured");
    }));
});

describe("staff work on reservations", {timeout: 60000}, () => {
    it("never shows one company's reservation to another", () => asCompany(async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const own = await request(app).post("/api/carRental/rentalReservation/single").set(callerHeader(admin)).send({_id: id});
        expect(own.status).toBe(200);
        const foreign = await request(app).post("/api/carRental/rentalReservation/single").set(callerHeader(outsider)).send({_id: id});
        expect(foreign.status).not.toBe(200);
        const foreignCancel = await request(app).post("/api/carRental/rentalReservation/cancel").set(callerHeader(outsider)).send({_id: id});
        expect(foreignCancel.body.error_code).toBe("rental_reservation_not_found");
    }));

    it("refuses an action to a role that can read reservations but not run that action (D14)", () => asCompany(async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const viewer: TestCaller = {...admin, isAdmin: false, permissions: admin.permissions!.filter((tag) => !tag.includes("[action:"))};

        const refused = await request(app).post("/api/carRental/rentalReservation/recordPayment").set(callerHeader(viewer)).send({_id: id, amount: 50});
        expect(refused.body.error_code).toBe("user_permissions_not_sufficient");
        expect((await RentalReservation.findById(id).lean())!.paymentStatus).not.toBe("paid");
    }));

    it("records a counter payment and refunds it minus the late-cancellation fee", () => asCompany(async () => {
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
    }));

    it("refuses to block a car over a booking, and to retire a car that has one", () => asCompany(async () => {
        await book({});
        const block = await request(app).put("/api/carRental/vehicleBlock").set(callerHeader(admin)).send({
            vehicle: vehicleId, startAt: "2027-06-10T00:00:00.000Z", endAt: "2027-06-10T12:00:00.000Z", reason: "maintenance",
        });
        expect(block.body.error_code).toBe("vehicle_block_overlaps_reservation");

        const retire = await request(app).patch("/api/carRental/vehicle").set(callerHeader(admin)).send({_id: vehicleId, make: "VW", model: "Golf", plate: "ZH 1", status: "retired"});
        expect(retire.body.error_code).toBe("vehicle_has_future_reservations");
        expect((await Vehicle.findById(vehicleId))!.status).toBe("active");
    }));
});

describe("online payment arrives", {timeout: 60000}, () => {
    const intentFor = (amountMinor: number) => ({id: "pi_test", amountMinor, currencyCode: "chf"});

    it("confirms a held booking", () => asCompany(async () => {
        const {body} = await book({paymentChoice: "online"});
        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findById(body.data.reservation._id).session(session);
            await settleRentalPayment(reservation!, intentFor(10000), {session, logger, languageCode: "en-US"});
        });
        const stored = await RentalReservation.findById(body.data.reservation._id);
        expect(stored).toMatchObject({status: "confirmed", paymentStatus: "paid"});
        expect(String(stored!.amountPaid)).toBe("100.00");
    }));

    it("cancels and refunds when the hold expired and the car was booked meanwhile", () => asCompany(async () => {
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
    }));

    it("leaves a booking untouched when the amount paid is not its price", () => asCompany(async () => {
        const {body} = await book({paymentChoice: "online"});
        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findById(body.data.reservation._id).session(session);
            await settleRentalPayment(reservation!, intentFor(500), {session, logger, languageCode: "en-US"});
        });
        expect((await RentalReservation.findById(body.data.reservation._id))!.status).toBe("held");
        expect(logger.err).toHaveBeenCalled();
    }));
});

describe("fees, promo codes and protection", {timeout: 60000}, () => {
    const quote = (body: Record<string, unknown>) =>
        request(app).post("/api/carRental/rentalStorefront/quote").set(callerHeader(admin)).send({...trip(), category: categoryId, ...body});

    it("charges young drivers per day and refuses a driver under the category minimum", () => asCompany(async () => {
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
    }));

    it("adds the return location's one-way fee, else the company's", () => asCompany(async () => {
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
    }));

    it("discounts the rental days with a promo code and stops it once it is used up", () => asCompany(async () => {
        await RentalPromoCode.create({company: companyId, code: "SUMMER10", type: "percent", value: 10, usageLimit: 1});
        const discounted = await quote({promoCode: "summer10"});
        expect(discounted.body.data.lines).toContainEqual(expect.objectContaining({kind: "discount", code: "promo", total: -10}));
        expect(discounted.body.data.grandTotal).toBe(90);

        const booked = await book({promoCode: "SUMMER10", expectedTotal: 90});
        expect(booked.status).toBe(200);
        expect((await RentalPromoCode.findOne({code: "SUMMER10"}))!.usageCount).toBe(1);
        expect((await quote({promoCode: "SUMMER10"})).body.error_code).toBe("rental_promo_code_used_up");
        expect((await quote({promoCode: "NOPE"})).body.error_code).toBe("rental_promo_code_invalid");
    }));

    it("refuses a promo code outside its pickup window or below its minimum days", () => asCompany(async () => {
        await RentalPromoCode.create({company: companyId, code: "LONG", type: "fixed", value: 25, minRentalDays: 5});
        await RentalPromoCode.create({company: companyId, code: "WINTER", type: "fixed", value: 25, tripFrom: new Date("2027-12-01"), tripUntil: new Date("2028-02-28")});
        expect((await quote({promoCode: "LONG"})).body.error_code).toBe("rental_promo_code_not_applicable");
        expect((await quote({promoCode: "WINTER"})).body.error_code).toBe("rental_promo_code_not_applicable");
    }));

    it("takes the protection package's deposit and allows only one package", () => asCompany(async () => {
        const basic = await RentalExtra.create({company: companyId, name: "Super cover", kind: "protection", pricing: "per_day", price: 12, maxQuantity: 1, excessAmount: 0, depositAmount: 100});
        const other = await RentalExtra.create({company: companyId, name: "Medium cover", kind: "protection", pricing: "per_day", price: 8, maxQuantity: 1});
        const covered = await quote({extras: [{extra: basic._id.toString(), quantity: 1}]});
        expect(covered.body.data.depositAmount).toBe(100);
        expect(covered.body.data.grandTotal).toBe(124);
        const both = await quote({extras: [{extra: basic._id.toString(), quantity: 1}, {extra: other._id.toString(), quantity: 1}]});
        expect(both.body.error_code).toBe("rental_protection_one_only");
    }));
});

describe("where cars are", {timeout: 60000}, () => {
    const action = (name: string, body: Record<string, unknown>) =>
        request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);
    const driver = {role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10", licenseNumber: "CH-1", licenseExpiresAt: "2030-01-01"};
    let baselId: string;

    beforeEach(() => asCompany(async () => {
        const basel = await RentalLocation.create({
            company: companyId, name: "Basel", timezone: "Europe/Zurich",
            openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
        });
        baselId = basel._id.toString();
    }));

    it("puts the car where it was returned and asks for a transfer when it is booked elsewhere", () => asCompany(async () => {
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
    }));

    it("lays out each car's bookings and blocks for the planner window", () => asCompany(async () => {
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
    }));

    it("lists the day's pickups at the counter, in the location's time zone", () => asCompany(async () => {
        const {body} = await book({});
        const counter = (date: string) => request(app).post("/api/carRental/rentalCounter").set(callerHeader(admin)).send({date, location: locationId});
        const day = await counter("2027-06-09");
        expect(day.status).toBe(200);
        expect(day.body.data.pickups.map((entry: {_id: string}) => entry._id)).toEqual([body.data.reservation._id]);
        expect(day.body.data.returns).toEqual([]);
        expect((await counter("2027-06-10")).body.data.pickups).toEqual([]);
    }));

    it("blocks the car on a transfer and counts it at the destination once it arrives", () => asCompany(async () => {
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
    }));
});

describe("on the road", {timeout: 60000}, () => {
    const action = (name: string, body: Record<string, unknown>) =>
        request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);

    const driver = {
        role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10",
        licenseNumber: "CH-123456", licenseCountry: "Switzerland", licenseExpiresAt: "2030-01-31",
    };

    it("keeps drivers' licences out of the reservation list; the reservation's own read returns them (SEC-06)", () => asCompany(async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});

        const listed = await request(app).post("/api/carRental/rentalReservation").set(callerHeader(admin)).send({limit: 10, offset: 0});
        expect(listed.body.data).toHaveLength(1);
        expect(listed.body.data[0].drivers ?? []).toEqual([]); // the mapper turns a field left out into []

        const opened = await request(app).post("/api/carRental/rentalReservation/single").set(callerHeader(admin)).send({_id: id});
        expect(opened.body.drivers).toEqual([driver]);
    }));

    it("hands over, extends, and takes back the car with extra charges", () => asCompany(async () => {
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

        // The customer's review is shown under the first name and the last name's initial (TD-B265).
        const reviewed = await request(app).post("/api/carRental/rentalStorefront/manage/review").set(callerHeader(admin))
            .send({token: body.data.manageToken, rating: 5, comment: "Clean car."});
        expect([reviewed.status, reviewed.body.error_code]).toEqual([200, undefined]);
        expect((await RentalReview.findOne({reservation: id}))!.authorName).toBe("Ada L.");
    }));

    it("refuses the handover until every driver has a licence valid to the return day", () => asCompany(async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const handover = () => action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});

        // The online booking named the customer as main driver, without a licence yet.
        expect((await handover()).body.error_code).toBe("rental_driver_license_missing");
        // The trip ends on 11 June 2027; a licence valid only to the day before is refused already when the drivers
        // are saved, not first at the handover.
        const shortLicence = await action("saveDrivers", {_id: id, drivers: [driver, {...driver, role: "additional", firstName: "Charles", licenseExpiresAt: "2027-06-10"}]});
        expect(shortLicence.body.error_code).toBe("rental_driver_license_expired");
        expect((await handover()).body.error_code).toBe("rental_driver_license_missing");
        await action("saveDrivers", {_id: id, drivers: [driver, {...driver, role: "additional", firstName: "Charles", licenseExpiresAt: "2027-06-11"}]});
        expect((await handover()).body.status).toBe("in_progress");
    }));

    it("refuses a driver list without one main driver or with a driver under the minimum age", () => asCompany(async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        const twoMain = await action("saveDrivers", {_id: id, drivers: [driver, {...driver, firstName: "Charles"}]});
        expect(twoMain.body.error_code).toBe("rental_driver_primary_required");
        // 21 is the category minimum: still 20 on 9 June 2027.
        const young = await action("saveDrivers", {_id: id, drivers: [{...driver, birthDate: "2006-06-10"}]});
        expect(young.body.error_code).toBe("rental_driver_too_young");
        const birthday = await action("saveDrivers", {_id: id, drivers: [{...driver, birthDate: "2006-06-09"}]});
        expect(birthday.status).toBe(200);
        // A licence issued after it expires, or after the pickup day, is a typing mistake.
        const backwards = await action("saveDrivers", {_id: id, drivers: [{...driver, licenseIssuedAt: "2031-01-01", licenseExpiresAt: "2030-01-01"}]});
        expect(backwards.body.error_code).toBe("rental_driver_license_dates_invalid");
        const issuedLater = await action("saveDrivers", {_id: id, drivers: [{...driver, licenseIssuedAt: "2027-07-01"}]});
        expect(issuedLater.body.error_code).toBe("rental_driver_license_dates_invalid");
    }));

    it("keeps the damage the customer saw at pickup and files new damage found at the return", () => asCompany(async () => {
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
    }));

    it("charges damage to the customer, never beyond the protection package's excess", () => asCompany(async () => {
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
        // Money is stored as Decimal128 (TD-B29)
        expect(stored!.pricing.lines.filter((line) => line.kind === "charge" && line.code === "damage").map((line) => String(line.total))).toEqual(["200.00"]);
        expect(String(stored!.pricing.grandTotal)).toBe("320.00");
        expect(stored!.timeline.map((entry) => entry.event)).toContain("charge_added");
        // The return invoiced the rental; the later damage charge got its own invoice.
        const invoices = await Invoice.find({sourceId: id}).sort({number: 1});
        expect(invoices.map((invoice) => String(invoice.total))).toEqual(["120.00", "200.00"]);
        expect(invoices[0].lines.map((line) => line.description)).toEqual(["Compact", "Medium cover"]);
        expect(invoices[1]).toMatchObject({number: expect.stringMatching(/^INV-\d{4}-000002$/), sourceNumber: stored!.number});
    }));

    it("holds a cash deposit and keeps part of it for what is owed", () => asCompany(async () => {
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
    }));

    it("holds the card for a short rental, then releases the hold", () => asCompany(async () => {
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
    }));

    it("saves the card for a long rental and charges it later without the customer", () => asCompany(async () => {
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
    }));

    it("matches a fine to the driver at the time and charges it with the handling fee to the saved card", () => asCompany(async () => {
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
        expect((await fines("/chargeCustomer", {_id: fine!._id.toString()})).body.error_code).toBe("rental_fine_invalid_status");
        const stored = await RentalReservation.findById(id);
        expect(stored!.pricing.lines.filter((line) => line.code === "fine" || line.code === "fine_admin").map((line) => String(line.total))).toEqual(["120.00", "25.00"]);
        expect(String(stored!.amountPaid)).toBe("545.00");
        expect(stripe.createPaymentIntent).toHaveBeenLastCalledWith(expect.objectContaining({amount: 145, offSession: expect.anything()}));

        // The authority annulled it: before the return nothing was invoiced, so the lines go and the card is refunded.
        const annulled = await fines("/annul", {_id: fine!._id.toString()});
        expect(annulled.body).toMatchObject({status: "cancelled"});
        expect(annulled.body.chargedAmount).toBeUndefined();
        const after = await RentalReservation.findById(id);
        expect(after!.pricing.lines.some((line) => line.code === "fine" || line.code === "fine_admin")).toBe(false);
        expect(String(after!.amountPaid)).toBe("400.00");
        // The whole 145 card charge goes back.
        expect(stripe.createRefund).toHaveBeenCalledWith(expect.objectContaining({gatewayTransactionId: "pi_off"}));
        expect(after!.timeline.map((entry) => entry.event)).toContain("charge_removed");
    }));

    it("refuses an extension into another customer's booking", () => asCompany(async () => {
        const first = await book({});
        await book({...trip({pickupDate: "2027-06-11", pickupTime: "12:00", returnDate: "2027-06-12", returnTime: "12:00"}), expectedTotal: 50});
        const extended = await action("extend", {_id: first.body.data.reservation._id, returnDate: "2027-06-11", returnTime: "18:00"});
        expect(extended.body.error_code).toBe("vehicle_unavailable");
    }));

    it("records a no-show only after the pickup time has passed", () => asCompany(async () => {
        const {body} = await book({});
        const early = await action("noShow", {_id: body.data.reservation._id});
        expect(early.body.error_code).toBe("rental_no_show_too_early");
    }));

    it("expires a lapsed hold and cancels its payment intent", () => asCompany(async () => {
        const {body} = await book({paymentChoice: "online"});
        await RentalReservation.updateOne({_id: body.data.reservation._id}, {$set: {holdExpiresAt: new Date(Date.now() - 1000)}});
        await runRentalHoldExpiry(companyId);
        expect((await RentalReservation.findById(body.data.reservation._id))!.status).toBe("expired");
        expect(stripe.cancelPaymentIntent).toHaveBeenCalledWith("pi_test");
    }));
});

describe("fleet workflows", {timeout: 60000}, () => {
    const action = (name: string, body: Record<string, unknown>) =>
        request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);
    const fleet = (path: string, body: Record<string, unknown>, caller: TestCaller = fleetAdmin) =>
        request(app).post(`/api/carRental/${path}`).set(callerHeader(caller)).send(body);
    const create = (entity: string, body: Record<string, unknown>, caller: TestCaller = fleetAdmin) =>
        request(app).put(`/api/carRental/${entity}`).set(callerHeader(caller)).send(body);
    const driver = {role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10", licenseNumber: "CH-1", licenseExpiresAt: "2030-01-01"};
    const damage = (body: Record<string, unknown> = {}) =>
        create("vehicleDamage", {vehicle: vehicleId, reportedAt: "2027-05-01T10:00:00.000Z", area: "front", severity: "moderate", description: "Dent in the bumper", ...body}, admin);

    it("sends damages to one repair that blocks the car, and repairs them when it is completed", () => asCompany(async () => {
        const dent = await damage({estimatedCost: 300});
        expect(dent.body.status).toBe("open");
        // Linked to the policy that covered the car on the day.
        const policy = await VehicleInsurance.findOne({vehicle: vehicleId});
        expect(String((await VehicleDamage.findById(dent.body._id))!.insurance)).toBe(String(policy!._id));
        const scratch = await damage({area: "left", severity: "minor", description: "Scratch on the door"});

        const scheduled = await fleet("vehicleDamage/scheduleRepair", {_id: dent.body._id, serviceDate: "2027-05-03 08:00", readyAt: "2027-05-05 18:00", provider: "Garage Meier"}, admin);
        expect(scheduled.body.status).toBe("in_repair");
        const repairId = scheduled.body.repair._id;
        expect(await VehicleMaintenance.findById(repairId)).toMatchObject({type: "repair", status: "scheduled", cost: 300, provider: "Garage Meier"});
        expect(await VehicleBlock.countDocuments({vehicle: vehicleId, reason: "repair", deletedAt: null})).toBe(1);
        const joined = await fleet("vehicleDamage/scheduleRepair", {_id: scratch.body._id, repair: repairId}, admin);
        expect(joined.body.repair._id).toBe(repairId);
        expect((await fleet("vehicleDamage/scheduleRepair", {_id: scratch.body._id, repair: repairId}, admin)).body.error_code).toBe("vehicle_damage_not_open");

        const completed = await fleet("vehicleMaintenance/complete", {_id: repairId});
        expect(completed.body.status).toBe("completed");
        const repaired = await VehicleDamage.find({_id: {$in: [dent.body._id, scratch.body._id]}});
        expect(repaired.map((entry) => entry.status)).toEqual(["repaired", "repaired"]);
        expect(repaired.every((entry) => entry.repairedAt)).toBe(true);
        const block = await VehicleBlock.findOne({vehicle: vehicleId, reason: "repair"});
        expect(block!.endAt.getTime()).toBeLessThanOrEqual(Date.now());
        expect((await fleet("vehicleMaintenance/cancel", {_id: repairId})).body.error_code).toBe("vehicle_maintenance_not_scheduled");

        // The repair's cost counts once, as repair; what the insurer paid back is recovered.
        await VehicleDamage.updateOne({_id: dent.body._id}, {$set: {insurerPaidAmount: 250}});
        const report = await buildRentalReport(new ObjectId(companyId), {from: "2027-05-01", to: "2027-05-31", timezone: "Europe/Zurich"});
        expect(report.byVehicle[0]).toMatchObject({maintenanceCost: 0, repairCost: 300, recovered: 250, finesCost: 0});
    }));

    it("frees the car and reopens the damage when a repair is cancelled", () => asCompany(async () => {
        const dent = await damage({severity: "major"});
        expect((await Vehicle.findById(vehicleId))!.readiness).toBe("needs_check");
        const scheduled = await fleet("vehicleDamage/scheduleRepair", {_id: dent.body._id, serviceDate: "2027-05-03 08:00", readyAt: "2027-05-05 18:00"}, admin);
        const cancelled = await fleet("vehicleMaintenance/cancel", {_id: scheduled.body.repair._id});
        expect(cancelled.body.status).toBe("cancelled");
        expect(await VehicleDamage.findById(dent.body._id)).toMatchObject({status: "open", repair: undefined});
        expect(await VehicleBlock.countDocuments({vehicle: vehicleId, reason: "repair", deletedAt: null})).toBe(0);
        expect((await fleet("vehicleDamage/scheduleRepair", {_id: dent.body._id}, admin)).body.error_code).toBe("vehicle_repair_date_required");
    }));

    it("refuses a repair window over a booking", () => asCompany(async () => {
        await book({});
        const dent = await damage();
        const clash = await fleet("vehicleDamage/scheduleRepair", {_id: dent.body._id, serviceDate: "2027-06-10 08:00", readyAt: "2027-06-12 18:00"}, admin);
        expect(clash.body.error_code).toBe("vehicle_block_overlaps_reservation");
        expect((await VehicleDamage.findById(dent.body._id))!.status).toBe("open");
    }));

    it("keeps a transfer's or repair's block out of hand edits", () => asCompany(async () => {
        const basel = await RentalLocation.create({
            company: companyId, name: "Basel", timezone: "Europe/Zurich",
            openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
        });
        await create("vehicleTransfer", {vehicle: vehicleId, fromLocation: locationId, toLocation: basel._id.toString(), departAt: "2027-05-01 08:00", arriveAt: "2027-05-01 11:00"}, admin);
        const managed = await VehicleBlock.findOne({vehicle: vehicleId, reason: "transfer"});
        expect(managed!.source).toBe("transfer");
        const blocks = (method: "patch" | "delete", body: Record<string, unknown>) => request(app)[method]("/api/carRental/vehicleBlock").set(callerHeader(admin)).send(body);
        expect((await blocks("patch", {_id: managed!._id.toString(), vehicle: vehicleId, startAt: "2027-05-01 08:00", endAt: "2027-05-01 11:00", reason: "other", note: "x"})).body.error_code).toBe("vehicle_block_managed");
        expect((await blocks("delete", {_id: managed!._id.toString()})).body.error_code).toBe("vehicle_block_managed");

        const own = await create("vehicleBlock", {vehicle: vehicleId, startAt: "2027-05-10 08:00", endAt: "2027-05-11 08:00", reason: "other"}, admin);
        expect((await blocks("delete", {_id: own.body._id})).status).toBe(200);
    }));

    it("takes a deleted damage off its repair, and puts it back when restored", () => asCompany(async () => {
        const dent = await damage();
        const scheduled = await fleet("vehicleDamage/scheduleRepair", {_id: dent.body._id, serviceDate: "2027-05-03 08:00"}, admin);
        const repairId = scheduled.body.repair._id;
        await request(app).delete("/api/carRental/vehicleDamage").set(callerHeader(admin)).send({_id: dent.body._id});
        expect((await VehicleMaintenance.findById(repairId))!.damages).toHaveLength(0);
        await request(app).patch("/api/carRental/vehicleDamage/restore").set(callerHeader(admin)).send({_id: dent.body._id});
        expect((await VehicleMaintenance.findById(repairId))!.damages.map(String)).toEqual([dent.body._id]);
        expect((await VehicleDamage.findById(dent.body._id))!.status).toBe("in_repair");

        // Cancelled while the damage was deleted: restored, the damage is open again.
        await request(app).delete("/api/carRental/vehicleDamage").set(callerHeader(admin)).send({_id: dent.body._id});
        await fleet("vehicleMaintenance/cancel", {_id: repairId});
        await request(app).patch("/api/carRental/vehicleDamage/restore").set(callerHeader(admin)).send({_id: dent.body._id});
        expect(await VehicleDamage.findById(dent.body._id)).toMatchObject({status: "open", repair: undefined});
    }));

    it("credits the invoice when a fine charged after the return is annulled", () => asCompany(async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {fineAdminFee: 25}});
        const {body} = await book({});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        await RentalReservation.updateOne({_id: id}, {$set: {"handover.at": new Date("2027-06-09T08:15:00Z")}});
        await action("returnVehicle", {_id: id, odometerKm: 12300, fuelLevel: "full"});
        await RentalReservation.updateOne({_id: id}, {$set: {"returnInfo.at": new Date("2027-06-11T08:00:00Z")}});
        const before = (await RentalReservation.findById(id))!.pricing.grandTotal;

        const created = await create("vehicleFine", {reference: "TR-9", vehicle: vehicleId, offenceAt: "2027-06-10 14:30", type: "speeding", authority: "Kapo", amount: 120}, admin);
        await fleet("vehicleFine/chargeCustomer", {_id: created.body._id}, admin);
        const fineInvoice = await Invoice.findOne({sourceId: id, kind: "invoice"}).sort({number: -1});
        expect(String(fineInvoice!.total)).toBe("145.00");

        const annulled = await fleet("vehicleFine/annul", {_id: created.body._id}, admin);
        expect(annulled.body.status).toBe("cancelled");
        const note = await Invoice.findOne({sourceId: id, kind: "credit_note"});
        expect(note).toMatchObject({creditedInvoice: fineInvoice!._id});
        expect(String(note!.total)).toBe("-145.00");
        expect((await Invoice.findById(fineInvoice!._id))!.status).toBe("credited");
        const stored = await RentalReservation.findById(id);
        expect(String(stored!.pricing.grandTotal)).toBe(String(before));
        expect(stored!.invoicedLineCount).toBe(stored!.pricing.lines.length);
    }));

    it("chains a renewal to the policy it renews, once", () => asCompany(async () => {
        const old = await VehicleInsurance.findOne({vehicle: vehicleId});
        const renewal = {vehicle: vehicleId, insurer: "Helvetia", policyNumber: "POL-NEW", coverage: "full_casco", validFrom: "2030-01-01", expiresAt: "2031-01-01", supersedes: old!._id.toString()};
        const renewed = await create("vehicleInsurance", renewal);
        expect(renewed.status).toBe(200);
        expect(renewed.body.supersedes._id).toBe(old!._id.toString());
        expect(String((await VehicleInsurance.findById(old!._id))!.supersededBy)).toBe(renewed.body._id);
        expect((await create("vehicleInsurance", {...renewal, policyNumber: "POL-TWICE"})).body.error_code).toBe("vehicle_record_not_renewable");
        expect((await create("vehicleInsurance", {...renewal, policyNumber: "POL-OTHER", coverage: "third_party", supersedes: renewed.body._id})).body.error_code)
            .toBe("vehicle_record_not_renewable");

        // A deleted renewal no longer renews; restored, it does again.
        const remove = () => request(app).delete("/api/carRental/vehicleInsurance").set(callerHeader(fleetAdmin)).send({_id: renewed.body._id});
        await remove();
        expect((await VehicleInsurance.findById(old!._id))!.supersededBy).toBeUndefined();
        await request(app).patch("/api/carRental/vehicleInsurance/restore").set(callerHeader(fleetAdmin)).send({_id: renewed.body._id});
        expect(String((await VehicleInsurance.findById(old!._id))!.supersededBy)).toBe(renewed.body._id);
        await remove();
        expect((await create("vehicleInsurance", {...renewal, policyNumber: "POL-AGAIN"})).status).toBe(200);
    }));

    it("refuses the handover while a road paper runs out before the return, until it is renewed", () => asCompany(async () => {
        const {body} = await book({});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        const inspection = await create("vehicleDocument", {vehicle: vehicleId, type: "technical_inspection", issuedAt: "2025-06-10", expiresAt: "2027-06-10"});
        expect((await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"})).body.error_code).toBe("rental_vehicle_papers_expired");

        await create("vehicleDocument", {vehicle: vehicleId, type: "technical_inspection", issuedAt: "2027-06-01", expiresAt: "2029-06-01", supersedes: inspection.body._id});
        const handedOver = await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        expect(handedOver.body.status).toBe("in_progress");
    }));

    it("refuses the handover of a car whose insurance ran short after it was booked", () => asCompany(async () => {
        const {body} = await book({});
        await VehicleInsurance.updateMany({vehicle: vehicleId}, {$set: {expiresAt: new Date("2027-06-10T00:00:00Z")}});
        await action("saveDrivers", {_id: body.data.reservation._id, drivers: [driver]});
        const refused = await action("handover", {_id: body.data.reservation._id, odometerKm: 12000, fuelLevel: "full"});
        expect(refused.body.error_code).toBe("rental_vehicle_papers_expired");
    }));

    it("never books a car whose insurance or road papers run out during the trip (TD-B264)", () => asCompany(async () => {
        await VehicleInsurance.updateMany({vehicle: vehicleId}, {$set: {expiresAt: new Date("2027-06-10T00:00:00Z")}});
        expect((await book({})).body.error_code).toBe("rental_category_unavailable");

        await VehicleInsurance.updateMany({vehicle: vehicleId}, {$set: {expiresAt: new Date("2030-01-01T00:00:00Z")}});
        await create("vehicleDocument", {vehicle: vehicleId, type: "road_tax", issuedAt: "2026-06-10", expiresAt: "2027-06-10"});
        expect((await book({})).body.error_code).toBe("rental_category_unavailable");
    }));

    it("still books a car with no insurance on record: the fleet may not record it yet, the handover asks for it (TD-B264)", () => asCompany(async () => {
        await VehicleInsurance.deleteMany({vehicle: vehicleId});
        expect((await book({})).status).toBe(200);
    }));

    it("marks the cars whose papers run out in the Change car list, without hiding them (TD-B264)", () => asCompany(async () => {
        const lapsing = await Vehicle.create({company: companyId, category: categoryId, make: "VW", model: "Polo", plate: "ZH 2", homeLocation: locationId, status: "active"});
        await insure(lapsing._id, {expiresAt: "2027-06-10"});
        const {body} = await book({});
        expect(String(body.data.reservation.vehicle ?? (await RentalReservation.findById(body.data.reservation._id))!.vehicle)).toBe(vehicleId);

        const free = await action("freeVehicles", {_id: body.data.reservation._id});
        expect(free.body.data).toEqual([expect.objectContaining({value: String(lapsing._id), papersLapse: true})]);
    }));

    it("names the driver to the authority and charges only the handling fee, invoiced after the return", () => asCompany(async () => {
        await CarRentalConfig.updateOne({company: companyId}, {$set: {fineAdminFee: 25}});
        const {body} = await book({});
        const id = body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        await RentalReservation.updateOne({_id: id}, {$set: {"handover.at": new Date("2027-06-09T08:15:00Z")}});
        await action("returnVehicle", {_id: id, odometerKm: 12300, fuelLevel: "full"});
        await RentalReservation.updateOne({_id: id}, {$set: {"returnInfo.at": new Date("2027-06-11T08:00:00Z")}});
        const invoicesBefore = await Invoice.countDocuments({sourceId: id});

        const created = await create("vehicleFine", {reference: "TR-1", vehicle: vehicleId, offenceAt: "2027-06-10 14:30", type: "speeding", authority: "Kapo", amount: 120}, admin);
        expect(created.body).toMatchObject({status: "driver_identified", driverName: "Ada Lovelace"});
        const nominated = await fleet("vehicleFine/nominateDriver", {_id: created.body._id}, admin);
        expect(nominated.body).toMatchObject({status: "transferred", chargedAmount: 25});
        const stored = await RentalReservation.findById(id);
        expect(stored!.pricing.lines.filter((line) => line.code === "fine" || line.code === "fine_admin").map((line) => String(line.total))).toEqual(["25.00"]);
        expect(await Invoice.countDocuments({sourceId: id})).toBe(invoicesBefore + 1);
        expect((await fleet("vehicleFine/recordPayment", {_id: created.body._id, paidAt: "2027-07-01", paidAmount: 120}, admin)).body.error_code).toBe("rental_fine_invalid_status");
    }));

    it("matches a fine during a transfer, and records what the company paid", () => asCompany(async () => {
        const basel = await RentalLocation.create({
            company: companyId, name: "Basel", timezone: "Europe/Zurich",
            openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({dayOfWeek, startTime: "07:00", endTime: "22:00"})),
        });
        await create("vehicleTransfer", {vehicle: vehicleId, fromLocation: locationId, toLocation: basel._id.toString(), departAt: "2027-05-01 08:00", arriveAt: "2027-05-01 11:00"}, admin);
        const transfer = await VehicleTransfer.findOne({vehicle: vehicleId});
        await fleet("vehicleTransfer/start", {_id: transfer!._id.toString()}, admin);

        const created = await create("vehicleFine", {reference: "TR-2", vehicle: vehicleId, offenceAt: "2027-05-01 09:30", type: "speeding", authority: "Kapo", amount: 80}, admin);
        expect(created.body).toMatchObject({status: "received", transfer: {_id: transfer!._id.toString()}});
        expect(created.body.reservation).toBeUndefined();
        const paid = await fleet("vehicleFine/recordPayment", {_id: created.body._id, paidAt: "2027-05-20", paidAmount: 70, paymentReference: "EBANK-1"}, admin);
        expect(paid.body).toMatchObject({status: "paid_by_company", paidAmount: 70, paymentReference: "EBANK-1"});
        expect((await fleet("vehicleFine/recordPayment", {_id: created.body._id, paidAt: "2027-05-21", paidAmount: 70}, admin)).body.error_code).toBe("rental_fine_invalid_status");

        const contested = await create("vehicleFine", {reference: "TR-3", vehicle: vehicleId, offenceAt: "2027-03-01 09:30", type: "parking", authority: "Stadt", amount: 40}, admin);
        expect((await fleet("vehicleFine/dispute", {_id: contested.body._id}, admin)).body.status).toBe("disputed");
        expect((await fleet("vehicleFine/chargeCustomer", {_id: contested.body._id}, admin)).body.error_code).toBe("rental_fine_invalid_status");
        expect((await fleet("vehicleFine/annul", {_id: contested.body._id}, admin)).body.status).toBe("cancelled");
    }));
});

describe("deny list", () => {
    it("lists entries without licence numbers; an entry's own read has it (SEC-06)", () => asCompany(async () => {
        const manager = {...admin, permissions: allPermissionTags([RentalDenyEntry])};
        const created = await request(app).put("/api/carRental/rentalDenyEntry").set(callerHeader(manager)).send({licenseNumber: "zz-deny-1", reason: "Licence reported lost"});
        expect(created.status).toBe(200);

        const listed = await request(app).post("/api/carRental/rentalDenyEntry").set(callerHeader(manager)).send({limit: 10, offset: 0});
        expect(listed.status).toBe(200);
        expect(listed.body.data).toHaveLength(1);
        expect(listed.body.data[0].licenseNumber).toBeUndefined();

        const opened = await request(app).post("/api/carRental/rentalDenyEntry/single").set(callerHeader(manager)).send({_id: created.body._id});
        expect(opened.body.licenseNumber).toBe("ZZ-DENY-1");
    }));
});
