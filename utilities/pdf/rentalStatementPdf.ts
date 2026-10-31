import {PDFDocument} from "pdf-lib";
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
    total: number;
    currency: string;
};

/** One page listing a business account's invoices for a month. */
export async function generateRentalStatementPdf(
    account: Pick<
        IRentalBusinessAccount,
        "name" | "vatNumber" | "address" | "billingEmail"
    >,
    month: string,
    invoices: StatementInvoice[],
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
    let total = 0;
    let currency = invoices[0]?.currency ?? "";
    for (const invoice of invoices) {
        currency = invoice.currency;
        total += invoice.total;
        writer.ensure(14);
        writer.text(
            `${invoice.issuedAt.toISOString().slice(0, 10)}   ${invoice.number}   ${pdfMoney(invoice.total, invoice.currency)}`,
            {size: 10},
        );
        writer.gap(14);
    }
    writer.gap(6);
    writer.rule();
    writer.gap(12);
    writer.text(pdfMoney(total, currency), {size: 12, bold: true});
    writer.gap(16);
    return Buffer.from(await doc.save());
}
