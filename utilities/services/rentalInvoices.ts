import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import Invoice, {
    type IInvoice,
} from "@financeModule/database/schemas/invoice/invoice";
import {invoiceService} from "@financeModule/database/schemas/invoice/invoice.service";
import {generateInvoicePdf} from "@financeModule/utilities/pdf/invoicePdf";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";

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
        ? await RentalBusinessAccount.findById(
              nestedEntityToRef(reservation.businessAccount),
          ).session(ctx.session)
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

/** The invoice as an email attachment, read again after commit so it carries its fiscal codes when registered. */
export function invoiceAttachment(invoiceId: ObjectId, languageCode: string) {
    return async () => {
        const invoice = await Invoice.findById(invoiceId);
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
