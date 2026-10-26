import * as fs from "fs";
import * as path from "path";
import {CLIENT_SIDE, CONSTANTS, EMAIL, clientHostFor} from "@coreModule/environment";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {
    ctaButtonHtml,
    currentYear,
    escapeHtml,
    layoutStrings,
    localized,
    pushRow,
    summaryCardHtml,
    type SummaryRow,
} from "@coreModule/utilities/emails/emailLayout";
import {sendMail} from "@coreModule/utilities/emails/mailDeliveryService";

const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const TEMPLATE_DIR = path.join(__dirname, "templates", "rentalCustomer");

export type RentalCustomerEmailKind = "confirmed" | "cancelled" | "reminder";

/** Copy suffix per kind: `subject{X}`, `heading{X}`, `preheader{X}`, `intro{X}`, `closing{X}`. */
const KIND_SUFFIX: Record<RentalCustomerEmailKind, string> = {
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    reminder: "Reminder",
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
    /** Set when booked on the central portal: the manage link opens the company's portal page. */
    portalSlug?: string;
};

function readTemplate(filename: string): string {
    return fs.readFileSync(path.join(TEMPLATE_DIR, filename), "utf8");
}

/**
 * Sends a rental email to the customer over the company's SMTP, in the same shell
 * as the property-management client emails. Does nothing when email is off.
 */
export async function sendRentalCustomerMail(data: RentalCustomerEmail): Promise<void> {
    if (!EMAIL.ENABLED) return;
    const languageCode = data.languageCode || CONSTANTS.DEFAULT_LANGUAGE || "en-US";
    const pageName = CLIENT_SIDE.NAME ?? "";
    const strings = loadEmailStrings(["rentalCustomer"], languageCode, LOCALES_ROOT);
    const loc = strings as Record<string, string>;
    const suffix = KIND_SUFFIX[data.kind];

    const rows: SummaryRow[] = [];
    pushRow(rows, loc.labelNumber, data.number);
    pushRow(rows, loc.labelCar, data.categoryName);
    pushRow(rows, loc.labelPickup, `${data.pickupAt}, ${data.pickupLocation}`);
    pushRow(rows, loc.labelReturn, `${data.returnAt}, ${data.returnLocation}`);
    pushRow(rows, loc.labelTotal, data.total);

    const manageBase = data.portalSlug ? `${clientHostFor("portal")}/car-rental/${data.portalSlug}` : clientHostFor("rental");
    const manageUrl = `${manageBase}/manage?token=${encodeURIComponent(data.manageToken)}`;
    const bodyInner = applyPlaceholders(readTemplate("body.html"), {
        intro: loc[`intro${suffix}`] ?? "",
        detailsSummary: summaryCardHtml(loc.summaryTitle ?? "", rows),
        cta: ctaButtonHtml(loc.manageLinkText ?? "", manageUrl, loc.fallbackLabel ?? ""),
        closing: loc[`closing${suffix}`] ?? "",
    });

    let html = applyPlaceholders(readTemplate("rentalCustomer.html"), layoutStrings(strings, `heading${suffix}`, `preheader${suffix}`));
    html = applyPlaceholders(html, {
        greeting: localized(strings, "greeting", {fullName: escapeHtml(data.fullName)}),
        bodyInner,
        companyName: escapeHtml(data.companyName),
        pageName,
        year: currentYear(),
    });
    const subject = applyPlaceholders(loc[`subject${suffix}`] ?? "", {number: data.number, companyName: data.companyName});

    await sendMail(data.companyId, {to: data.email, subject, html});
}
