import * as fs from "fs";
import * as path from "path";
import {CLIENT_SIDE, CONSTANTS, EMAIL, clientHostFor} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";

const imagePath = path.join(__dirname, "./static/images/image-1.png");
const imageCID = "imageCID@example.com";
const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "rentalCustomer");

export type RentalCustomerEmailKind = "confirmed" | "cancelled" | "reminder";

const KIND_KEYS: Record<RentalCustomerEmailKind, {subject: string; heading: string; intro: string; closing: string}> = {
    confirmed: {subject: "subjectConfirmed", heading: "headingConfirmed", intro: "introConfirmed", closing: "closingConfirmed"},
    cancelled: {subject: "subjectCancelled", heading: "headingCancelled", intro: "introCancelled", closing: "closingCancelled"},
    reminder: {subject: "subjectReminder", heading: "headingReminder", intro: "introReminder", closing: "closingReminder"},
};

export type RentalCustomerEmail = {
    kind: RentalCustomerEmailKind;
    companyId: string;
    companyName: string;
    languageCode: string;
    email: string;
    fullName: string;
    number: string;
    categoryName: string;
    /** Already formatted in the location's timezone. */
    pickupAt: string;
    pickupLocation: string;
    returnAt: string;
    returnLocation: string;
    total: string;
    manageToken: string;
};

/** Escapes a customer- or staff-entered value before it goes into the HTML. */
function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Sends a rental email to the customer over the company's SMTP. Does nothing when email is off. */
export async function sendRentalCustomerMail(data: RentalCustomerEmail): Promise<void> {
    if (!EMAIL.ENABLED) return;
    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US";
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["rentalCustomer"], languageCode, LOCALES_ROOT) as Record<string, string>;
    const keys = KIND_KEYS[data.kind];
    const safe = (value: string) => escapeHtml(value);

    const bodyInner = applyPlaceholders(fs.readFileSync(path.join(TEMPLATE_DIR, "body.html"), "utf8"), {
        greeting: applyPlaceholders(strings.greeting, {fullName: safe(data.fullName)}),
        intro: strings[keys.intro],
        closing: strings[keys.closing],
        labelNumber: strings.labelNumber,
        labelCar: strings.labelCar,
        labelPickup: strings.labelPickup,
        labelReturn: strings.labelReturn,
        labelTotal: strings.labelTotal,
        number: safe(data.number),
        categoryName: safe(data.categoryName),
        pickupAt: safe(data.pickupAt),
        pickupLocation: safe(data.pickupLocation),
        returnAt: safe(data.returnAt),
        returnLocation: safe(data.returnLocation),
        total: safe(data.total),
        manageUrl: `${clientHostFor("rental")}/manage?token=${encodeURIComponent(data.manageToken)}`,
        manageLinkText: strings.manageLinkText,
    });
    const html = applyPlaceholders(fs.readFileSync(path.join(TEMPLATE_DIR, "rentalCustomer.html"), "utf8"), {
        heading: strings[keys.heading],
        imageAlt: strings.imageAlt,
        copyright: applyPlaceholders(strings.copyright, {pageName}),
        username: safe(data.fullName),
        bodyInner,
        pageName,
    });
    const subject = applyPlaceholders(strings[keys.subject], {number: data.number, companyName: data.companyName});

    await sendMail(data.companyId, {
        to: data.email,
        subject,
        html,
        attachments: [{filename: "companyTick.png", path: imagePath, cid: imageCID}],
    });
}
