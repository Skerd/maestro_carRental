import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {Decimal128, ObjectId} from "mongodb";
import request from "supertest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// No Redis in tests.
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {PdfWriter} from "@coreModule/utilities/pdf/pdfWriter";
import Company from "@coreModule/database/schemas/company/company";
import Currency from "@coreModule/database/schemas/currency/currency";
import Invoice from "@financeModule/database/schemas/invoice/invoice";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import * as rentalStatementRoute from "@carRentalModule/api/carRental/private/rentalStatement";

const companyId = new ObjectId();
const accountId = new ObjectId();
const chf = new ObjectId();
const jpy = new ObjectId();
const VAT = "CHE-123.456.789";
const app = appFor([{...rentalStatementRoute, module: "carRental"}]);
const accountant: TestCaller = {
    userId: new ObjectId().toString(),
    companyId: companyId.toString(),
    isAdmin: true,
    permissions: allPermissionTags([RentalBusinessAccount]),
    modules: ["core", "finance", "carRental"],
};
/** Every text the PDF writer draws, in order. */
const drawn: string[] = [];

/** An invoice for the account, issued at `issuedAt` (UTC), of `total` in `currency`. */
const invoice = (number: string, issuedAt: string, total: string, currency: ObjectId) => ({
    _id: new ObjectId(), company: companyId, number, issuedAt: new Date(issuedAt), total: Decimal128.fromString(total), currency,
    customer: {name: "Fleet AG", vatNumber: VAT}, deletedAt: null,
});

beforeAll(async () => {
    await connectTestDatabase();
    await asCrossTenant("test fixtures", async () => {
        await Company.collection.insertOne({_id: companyId, name: "Rent Zürich", timezone: "Europe/Zurich", deletedAt: null});
        await RentalBusinessAccount.collection.insertOne({_id: accountId, company: companyId, name: "Fleet AG", vatNumber: VAT, billingEmail: "billing@fleet.ch", deletedAt: null});
        await Currency.collection.insertMany([
            {_id: chf, company: companyId, name: "Swiss franc", abbreviation: "CHF", decimalPlaces: 2, deletedAt: null},
            {_id: jpy, company: companyId, name: "Yen", abbreviation: "JPY", decimalPlaces: 0, deletedAt: null},
        ]);
        await Invoice.collection.insertMany([
            // 00:30 on 1 March in Zurich is still 28 February in UTC
            invoice("INV-1", "2027-02-28T23:30:00Z", "0.10", chf),
            invoice("INV-2", "2027-03-15T10:00:00Z", "0.20", chf),
            invoice("INV-3", "2027-03-20T10:00:00Z", "1000", jpy),
            // 00:30 on 1 April in Zurich (summer time) is 31 March in UTC: April's
            invoice("INV-4", "2027-03-31T22:30:00Z", "5.00", chf),
            // 23:30 on 28 February in Zurich: February's
            invoice("INV-5", "2027-02-28T22:30:00Z", "7.00", chf),
        ]);
    });
    const text = PdfWriter.prototype.text;
    vi.spyOn(PdfWriter.prototype, "text").mockImplementation(function (this: PdfWriter, value, options) {
        drawn.push(value);
        return text.call(this, value, options);
    });
}, 120000);

afterAll(async () => {
    vi.restoreAllMocks();
    await disconnectTestDatabase();
});

describe("a business account's monthly statement", {timeout: 30000}, () => {
    // Regression (B1, B2): the month was cut in UTC, dates printed in UTC, totals added as floats across currencies
    // and labelled with the last invoice's currency.
    it("lists the month's invoices in the company's time zone with one exact total per currency", async () => {
        const response = await request(app).post("/api/carRental/rentalStatement").set(callerHeader(accountant))
            .send({businessAccount: accountId.toString(), month: "2027-03"});
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/pdf");

        expect(drawn).toEqual(expect.arrayContaining([
            "2027-03-01   INV-1   CHF 0.10",
            "2027-03-15   INV-2   CHF 0.20",
            "2027-03-20   INV-3   JPY 1,000",
            "CHF 0.30",
            "JPY 1,000",
        ]));
        expect(drawn.some((line) => line.includes("INV-4") || line.includes("INV-5"))).toBe(false);
    });

    // Regression (B3): a bad month answered `rental_invalid_return_time`.
    it("refuses a month that is not YYYY-MM as a form error", async () => {
        for (const month of ["2027-13", "2027-3", "March"]) {
            const response = await request(app).post("/api/carRental/rentalStatement").set(callerHeader(accountant))
                .send({businessAccount: accountId.toString(), month});
            expect(response.status).toBe(400);
            expect(response.body.error_code).toBe("form_not_correct");
        }
    });
});
