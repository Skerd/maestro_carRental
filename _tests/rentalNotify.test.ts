import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import {Types} from "mongoose";

// D178: a booking made signed in links to the customer's account on the portal; a guest's booking is in no account.
const {sent, companyId} = vi.hoisted(() => {
    process.env.SINFONIA_CLIENT_URLS = "core=http://panel.example.test:5211,portal=http://portal.example.test:5212";
    return {sent: [] as {accountUrl?: string; manageUrl: string}[], companyId: {value: ""}};
});
vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({
    sendRentalCustomerMail: vi.fn(async (mail: {accountUrl?: string; manageUrl: string}) => {
        sent.push(mail);
    }),
}));
vi.mock("@coreModule/database/schemas/company/company.service", async () => {
    const {ObjectId: Id} = await import("mongodb");
    return {companyService: {findById: vi.fn(async () => ({_id: new Id(companyId.value), name: "Rent & Go", siteSlug: "rent-go"}))}};
});
vi.mock("@coreModule/database/schemas/currency/currency.service", () => ({
    currencyService: {findById: vi.fn(async () => ({abbreviation: "EUR"}))},
}));
vi.mock("@coreModule/utilities/security/recordAccessToken", () => ({generateRecordAccessToken: () => "token"}));

import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {notifyRentalCustomer} from "@carRentalModule/utilities/services/rentalNotify";

const company = new ObjectId();
companyId.value = company.toString();

function reservation(customer?: ObjectId) {
    return new RentalReservation({
        company,
        number: "RR-20261201-ABCD1234",
        pickupAt: new Date("2026-12-01T09:00:00Z"),
        returnAt: new Date("2026-12-03T09:00:00Z"),
        snapshot: {categoryName: "Compact", pickupLocationName: "Airport", returnLocationName: "Airport", timezone: "Europe/Tirane"},
        contact: {firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+355690000000"},
        pricing: {currency: new ObjectId(), grandTotal: Types.Decimal128.fromString("120.00")},
        ...(customer ? {customer} : {}),
    });
}

beforeEach(() => {
    sent.length = 0;
});

describe("notifyRentalCustomer", () => {
    it("links a signed-in customer's booking to their account on the portal apex", async () => {
        await notifyRentalCustomer("confirmed", reservation(new ObjectId()), {languageCode: "en-US"});
        expect(sent).toHaveLength(1);
        expect(sent[0].accountUrl).toBe("http://portal.example.test:5212/account");
        expect(sent[0].manageUrl).toBe("http://rent-go.portal.example.test:5212/car-rental/manage");
    });

    it("leaves the account link out of a guest's booking", async () => {
        await notifyRentalCustomer("confirmed", reservation(), {languageCode: "en-US"});
        expect(sent).toHaveLength(1);
        expect(sent[0].accountUrl).toBeUndefined();
    });
});
