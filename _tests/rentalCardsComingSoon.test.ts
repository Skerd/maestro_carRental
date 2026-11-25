import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";

// Card payments are "Coming soon" (D190): whatever the gateway and the stored policy say, nothing goes to a card.
vi.mock("armonia/src/modules/finance/helpers/cardPaymentAvailability", () => ({CARD_PAYMENTS_AVAILABLE: false}));
vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
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
vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({sendRentalCustomerMail: vi.fn(async () => undefined)}));
// A gateway that would take every card: the switch alone must keep it unused.
const {stripe} = vi.hoisted(() => ({
    stripe: {
        isEnabled: () => true,
        toMinorUnits: (amount: number) => Math.round(amount * 100),
        createRefund: vi.fn(async () => ({id: "re_1", status: "succeeded"})),
        cancelPaymentIntent: vi.fn(async () => ({id: "pi", status: "canceled"})),
        createPaymentIntent: vi.fn(async () => ({id: "pi_test", clientSecret: "secret", status: "succeeded"})),
        retrievePaymentIntent: vi.fn(async () => ({id: "pi_test", status: "requires_capture"})),
        capturePaymentIntent: vi.fn(async () => ({id: "pi_test", status: "succeeded"})),
        createSetupIntent: vi.fn(async () => ({id: "seti_test", clientSecret: "setup_secret", status: "requires_payment_method", customerId: "cus_test"})),
        retrieveSetupIntent: vi.fn(async () => ({id: "seti_test", status: "succeeded", customerId: "cus_test", paymentMethodId: "pm_test"})),
    },
}));
vi.mock("@financeModule/utilities/services/payment/paymentService", () => ({getPaymentAdapter: () => stripe}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import Currency from "@coreModule/database/schemas/currency/currency";
import PaymentTransaction from "@financeModule/database/schemas/paymentTransaction/paymentTransaction";
import Invoice, {InvoiceCounter} from "@financeModule/database/schemas/invoice/invoice";
import * as reservationRoute from "@carRentalModule/api/carRental/private/rentalReservation";
import * as vehicleFineRoute from "@carRentalModule/api/carRental/private/vehicleFine";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {resolvePaymentChoice} from "@carRentalModule/workflows/rentalReservationService";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";

const companyId = new ObjectId();
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const app = appFor([reservationRoute, vehicleFineRoute, storefrontRoute].map((route) => ({...route, module: "carRental"})));

let admin: TestCaller;
let locationId: string;
let categoryId: string;
let vehicleId: string;

const trip = {pickupLocation: "", returnLocation: "", pickupDate: "2027-06-09", pickupTime: "10:00", returnDate: "2027-06-11", returnTime: "10:00"};
const contact = {firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+41 79 000 00 00"};
const driver = {role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10", licenseNumber: "CH-1", licenseExpiresAt: "2030-01-01"};
const where = () => ({...trip, pickupLocation: locationId, returnLocation: locationId, category: categoryId, contact, idempotencyKey: `key-${new ObjectId().toString()}`});
const book = (body: Record<string, unknown> = {}) => request(app).post("/api/carRental/rentalStorefront/book").set(callerHeader(admin)).send({
    ...where(), driverBirthDate: "1990-12-10", paymentChoice: "pay_at_pickup", acceptTerms: true, expectedTotal: 100, ...body,
});
const action = (name: string, body: Record<string, unknown>) =>
    request(app).post(`/api/carRental/rentalReservation/${name}`).set(callerHeader(admin)).send(body);
const savedCardDeposit = {method: "saved_card", status: "held", amount: 500, capturedAmount: 0, paymentMethodId: "pm_test", stripeCustomerId: "cus_test", heldAt: new Date()};

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    admin = {
        userId: new ObjectId().toString(),
        companyId: companyId.toString(),
        isAdmin: true,
        permissions: allPermissionTags([RentalReservation, VehicleFine]),
    };
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await Promise.all([CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, VehicleInsurance, VehicleFine, RentalReservation, PaymentTransaction, Currency, Invoice, InvoiceCounter]
        .map((model) => model.collection.deleteMany({})));
    vi.clearAllMocks();
    const currency = await Currency.create({name: "Swiss franc", symbol: "CHF", abbreviation: "CHF", decimalPlaces: 2, company: companyId});
    // The company asked for payment online when booking, before cards were switched off.
    await CarRentalConfig.create({
        company: companyId, currency: currency._id, publicBookingEnabled: true, turnaroundBufferMinutes: 60, minRentalHours: 4,
        freeCancellationHours: 48, cancellationFeePercent: 20, paymentPolicy: "prepay_online", fineAdminFee: 25,
    });
    const location = await RentalLocation.create({
        company: companyId, name: "Zurich Airport", timezone: "Europe/Zurich",
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
    locationId = location._id.toString();
    categoryId = category._id.toString();
    vehicleId = vehicle._id.toString();
}));

describe("card payments coming soon (D190)", {timeout: 60000}, () => {
    it("resolves every policy and request to pay at the desk", () => {
        const ctx = {onlinePaymentAvailable: true, grandTotal: 100, languageCode: "en-US"};
        for (const paymentPolicy of ["pay_at_pickup", "prepay_online", "customer_choice"] as const) {
            expect(resolvePaymentChoice({paymentPolicy}, "online", ctx)).toBe("pay_at_pickup");
        }
    });

    it("tells the site that a prepay company is paid at the desk, with no card form", () => asCompany(async () => {
        const response = await request(app).post("/api/carRental/rentalStorefront/config").set(callerHeader(admin)).send({});
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({paymentPolicy: "pay_at_pickup", onlinePaymentAvailable: false});
        expect(response.body.data.stripePublishableKey).toBeUndefined();
    }));

    it("confirms a prepay booking as pay at the desk and never opens a card payment", () => asCompany(async () => {
        const response = await book({paymentChoice: "online"});
        expect(response.status).toBe(200);
        expect(response.body.data.payment).toBeUndefined();
        expect(response.body.data.reservation).toMatchObject({status: "confirmed", paymentChoice: "pay_at_pickup", amountDue: 100, canPayBalance: false});
        expect(stripe.createPaymentIntent).not.toHaveBeenCalled();

        const paid = await request(app).post("/api/carRental/rentalStorefront/manage/pay").set(callerHeader(admin)).send({token: response.body.data.manageToken});
        expect(paid.status).toBe(403);
        expect(paid.body.error_code).toBe("rental_card_payments_coming_soon");
        expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    }));

    it("refuses a staff booking that waits for an online payment", () => asCompany(async () => {
        const response = await request(app).put("/api/carRental/rentalReservation").set(callerHeader(admin)).send({...where(), paymentChoice: "online"});
        expect(response.status).toBe(403);
        expect(response.body.error_code).toBe("rental_card_payments_coming_soon");
        expect(await RentalReservation.countDocuments({})).toBe(0);
        const atDesk = await request(app).put("/api/carRental/rentalReservation").set(callerHeader(admin)).send({...where(), paymentChoice: "pay_at_pickup"});
        expect(atDesk.status).toBe(200);
    }));

    it("refuses a card deposit and takes it in cash at the desk", () => asCompany(async () => {
        const id = (await book()).body.data.reservation._id;
        const card = await action("takeDeposit", {_id: id, method: "card", amount: 250});
        expect(card.status).toBe(403);
        expect(card.body.error_code).toBe("rental_card_payments_coming_soon");
        expect((await RentalReservation.findById(id))!.deposit).toBeUndefined();
        expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
        expect(stripe.createSetupIntent).not.toHaveBeenCalled();

        const cash = await action("takeDeposit", {_id: id, method: "cash", amount: 250});
        expect(cash.body.data.reservation.deposit).toMatchObject({method: "cash", status: "held", amount: 250});
        expect(cash.body.data.payment).toBeUndefined();
    }));

    it("neither captures a card deposit nor charges a saved card, and still charges the fine to the booking", () => asCompany(async () => {
        const id = (await book()).body.data.reservation._id;
        await action("saveDrivers", {_id: id, drivers: [driver]});
        await action("handover", {_id: id, odometerKm: 12000, fuelLevel: "full"});
        await RentalReservation.updateOne({_id: id}, {$set: {"handover.at": new Date("2027-06-09T08:15:00Z"), deposit: savedCardDeposit}});

        const settle = await action("settleDeposit", {_id: id, keepAmount: 50});
        expect(settle.status).toBe(403);
        expect(settle.body.error_code).toBe("rental_card_payments_coming_soon");

        await request(app).put("/api/carRental/vehicleFine").set(callerHeader(admin)).send({
            reference: "TR-2027-118", vehicle: vehicleId, offenceAt: "2027-06-10 14:30", type: "speeding", authority: "Kantonspolizei Zürich", amount: 120,
        });
        const fine = await VehicleFine.findOne({reference: "TR-2027-118"});
        const charged = await request(app).post("/api/carRental/vehicleFine/chargeCustomer").set(callerHeader(admin)).send({_id: fine!._id.toString()});
        expect(charged.body).toMatchObject({status: "charged", chargedAmount: 145});
        const stored = await RentalReservation.findById(id);
        // On the booking and owed, paid at the desk: the saved card is left alone.
        expect(String(stored!.amountPaid)).toBe("0.00");
        expect(String(stored!.pricing.grandTotal)).toBe("245.00");
        expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
        expect(stripe.capturePaymentIntent).not.toHaveBeenCalled();
    }));
});
