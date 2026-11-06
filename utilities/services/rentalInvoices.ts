import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {decimalToNumber, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {MoneyInput} from "armonia/src/modules/core/helpers/money";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    type IInvoice,
} from "@financeModule/database/schemas/invoice/invoice";
import {invoiceService} from "@financeModule/database/schemas/invoice/invoice.service";
import {generateInvoicePdf} from "@financeModule/utilities/pdf/invoicePdf";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

import {rentalBusinessAccountService} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount.service";
type Ctx = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    auditUserId?: string | ObjectId;
};

/**
 * Invoices the booking's price lines not invoiced yet: everything at the return,
 * then each later charge (damage, fines) on its own invoice. Returns undefined
 * when there is nothing new to invoice.
 */
export async function invoiceNewLines(
    reservation: IRentalReservation,
    ctx: Ctx,
    issuedAt?: Date,
): Promise<IInvoice | undefined> {
    const from = reservation.invoicedLineCount ?? 0;
    const lines = reservation.pricing.lines.slice(from);
    if (!lines.length) return undefined;
    const {contact} = reservation;
    const account = reservation.businessAccount
        ? await rentalBusinessAccountService.findById(nestedEntityToRef(reservation.businessAccount), {session: ctx.session})
        : null;
    const customer = account
        ? {
              name: account.name,
              email: account.billingEmail,
              vatNumber: account.vatNumber,
              address: account.address,
          }
        : {
              name: `${contact.firstName} ${contact.lastName}`.trim(),
              email: contact.email,
          };
    const invoice = await invoiceService.issue(
        {
            company: nestedEntityToRef(reservation.company)!,
            sourceType: "rentalReservation",
            sourceId: reservation._id,
            sourceNumber: reservation.number,
            customer,
            lines: lines.map((line) => ({
                description: line.label,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                total: line.total,
            })),
            vatRate: reservation.pricing.vatRate,
            pricesIncludeVat: reservation.pricing.pricesIncludeVat,
            currency: nestedEntityToRef(reservation.pricing.currency)!,
            issuedAt,
        },
        ctx,
    );
    reservation.invoicedLineCount = reservation.pricing.lines.length;
    await reservation.save({session: ctx.session});
    return invoice;
}

/**
 * Credits booking lines that were already invoiced (a charge taken back), each on the
 * invoice that holds it: a credit note per invoice, for those lines only.
 */
export async function creditInvoicedLines(
    reservation: IRentalReservation,
    lines: {description: string; total: MoneyInput}[],
    ctx: Ctx,
): Promise<void> {
    const company = nestedEntityToRef(reservation.company)!;
    const invoices = await invoiceService.find({
        company,
        sourceType: "rentalReservation",
        sourceId: reservation._id,
        kind: "invoice",
        status: "issued",
        deletedAt: null,
    }, {session: ctx.session}, undefined, undefined, {issuedAt: -1});
    const byInvoice = new Map<string, {invoice: IInvoice; lines: typeof lines}>();
    for (const line of lines) {
        const invoice = invoices.find((candidate) =>
            candidate.lines.some((invoiced) => invoiced.description === line.description && decimalToNumber(invoiced.total) === decimalToNumber(line.total)),
        );
        if (!invoice) throw apiValidationException("rental_charge_not_found", "", null, ctx.languageCode);
        const group = byInvoice.get(String(invoice._id)) ?? {invoice, lines: []};
        group.lines.push(line);
        byInvoice.set(String(invoice._id), group);
    }
    for (const {invoice, lines: credited} of byInvoice.values()) {
        await invoiceService.credit(invoice._id, {...ctx, company}, credited);
    }
}

/** The invoice as an email attachment, read again after commit so it carries its fiscal codes when registered. */
export function invoiceAttachment(invoiceId: ObjectId, languageCode: string) {
    return async () => {
        const invoice = await invoiceService.findById(invoiceId, {});
        return invoice
            ? [
                  {
                      filename: `${invoice.number}.pdf`,
                      content: await generateInvoicePdf(invoice, languageCode),
                  },
              ]
            : [];
    };
}
