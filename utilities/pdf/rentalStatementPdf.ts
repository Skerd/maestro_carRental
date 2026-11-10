import {PDFDocument} from "pdf-lib";
import {minorToNumber, sumMinor, toMinor, type MoneyInput} from "armonia/src/modules/core/helpers/money";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {
    PdfWriter,
    embedStandardFonts,
    pdfMoney,
    safePdfText,
} from "@coreModule/utilities/pdf/pdfWriter";
import type {IRentalBusinessAccount} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";

export type StatementInvoice = {
    number: string;
    issuedAt: Date;
    /** As stored (`Decimal128`), in the invoice currency. */
    total: MoneyInput;
    currency: string;
    /** The currency's `decimalPlaces`. */
    decimalPlaces: number;
};

/**
 * One page listing a business account's invoices for a month, dated in the company's time zone, with one exact total
 * per currency (amounts in different currencies are never added together).
 */
export async function generateRentalStatementPdf(
    account: Pick<
        IRentalBusinessAccount,
        "name" | "vatNumber" | "address" | "billingEmail"
    >,
    month: string,
    invoices: StatementInvoice[],
    timeZone: string,
): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const fonts = await embedStandardFonts(doc);
    const writer = new PdfWriter(doc, fonts);
    writer.text(safePdfText(account.name), {size: 16, bold: true});
    writer.gap(18);
    writer.paragraph(
        `${account.vatNumber}${account.address ? ` · ${account.address}` : ""}`,
    );
    writer.paragraph(account.billingEmail);
    writer.gap(8);
    writer.text(month, {size: 12, bold: true});
    writer.gap(16);
    writer.rule();
    writer.gap(10);
    const totals = new Map<string, {decimalPlaces: number; amounts: bigint[]}>();
    for (const invoice of invoices) {
        const amount = toMinor(invoice.total, invoice.decimalPlaces);
        const total = totals.get(invoice.currency) ?? {decimalPlaces: invoice.decimalPlaces, amounts: []};
        total.amounts.push(amount);
        totals.set(invoice.currency, total);
        writer.ensure(14);
        writer.text(
            `${localDateOf(invoice.issuedAt, timeZone)}   ${invoice.number}   ${pdfMoney(minorToNumber(amount, invoice.decimalPlaces), invoice.currency, invoice.decimalPlaces)}`,
            {size: 10},
        );
        writer.gap(14);
    }
    writer.gap(6);
    writer.rule();
    writer.gap(12);
    for (const [currency, {decimalPlaces, amounts}] of totals) {
        writer.ensure(16);
        writer.text(pdfMoney(minorToNumber(sumMinor(amounts), decimalPlaces), currency, decimalPlaces), {size: 12, bold: true});
        writer.gap(16);
    }
    return Buffer.from(await doc.save());
}
