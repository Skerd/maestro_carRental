import {beforeEach, describe, expect, it, vi} from "vitest";
import * as fs from "fs";

const {sent} = vi.hoisted(() => ({sent: [] as {to: string; subject: string; html: string}[]}));
vi.mock("@coreModule/utilities/emails/mailDeliveryService", () => ({
    sendMail: vi.fn(async (_companyId: string, mail: {to: string; subject: string; html: string}) => {
        sent.push(mail);
    }),
}));
vi.mock("@coreModule/environment", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@coreModule/environment")>();
    return {...actual, EMAIL: {...actual.EMAIL, ENABLED: true}, CLIENT_SIDE: {...actual.CLIENT_SIDE, NAME: "Arpeggio"}};
});

import {sendRentalCustomerMail, type RentalCustomerEmailKind} from "@carRentalModule/utilities/emails/sendRentalCustomerMail";

const mail = (kind: RentalCustomerEmailKind, languageCode = "en-US") => sendRentalCustomerMail({
    kind,
    companyId: "6ad653ec4b21ee6f13d1083a",
    companyName: "Rent & Go",
    languageCode,
    email: "ada@example.com",
    fullName: "Ada <Lovelace>",
    number: "RR-20261020-ABCD1234",
    categoryName: "Compact",
    pickupAt: "Mon, 9 Nov 2026, 10:00",
    pickupLocation: "Zurich Airport",
    returnAt: "Wed, 11 Nov 2026, 10:00",
    returnLocation: "Zurich Airport",
    total: "CHF 120.00",
    manageToken: "tok.en/value",
});

beforeEach(() => {
    sent.length = 0;
});

describe("rental customer email", () => {
    it("uses the client email shell with a summary card and a manage button", async () => {
        await mail("confirmed");
        const {subject, html} = sent[0];
        expect(subject).toBe("Booking RR-20261020-ABCD1234 confirmed — Rent & Go");
        expect(html).toContain("Your car is booked");
        expect(html).toContain("Your booking");
        expect(html).toContain("Zurich Airport");
        expect(html).toContain("/manage?token=tok.en%2Fvalue");
        expect(html).toContain("© " + new Date().getFullYear() + " Arpeggio");
        // The customer's name is escaped and no placeholder is left unfilled
        expect(html).toContain("Ada &lt;Lovelace&gt;");
        expect(html).not.toMatch(/\{[a-zA-Z]+\}/);
        if (process.env.EMAIL_PREVIEW_DIR) fs.writeFileSync(`${process.env.EMAIL_PREVIEW_DIR}/rental-confirmed.html`, html);
    });

    it("renders every kind in every language without leftovers", async () => {
        for (const languageCode of ["en-US", "de-CH", "fr-FR", "it-IT", "sq-AL"]) {
            for (const kind of ["confirmed", "cancelled", "reminder"] as const) await mail(kind, languageCode);
        }
        expect(sent).toHaveLength(15);
        for (const {subject, html} of sent) {
            expect(subject).not.toBe("");
            expect(html).not.toMatch(/\{[a-zA-Z]+\}/);
        }
    });
});
