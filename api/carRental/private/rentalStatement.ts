import {Router, type Request, type Response} from "express";
import {ObjectId} from "mongodb";
import authMW, {
    type AuthenticatedMWType,
} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    rentalStatementFormSchema,
    type RentalStatementFormType,
} from "armonia/src/modules/carRental/api/carRental/private/rentalStatement/rentalStatement.form.validator";
import {DEFAULT_DECIMAL_PLACES} from "armonia/src/modules/core/helpers/money";
import {companyTimeZoneOf} from "@coreModule/utilities/time/companyTimeZone";
import {localDayInterval} from "@coreModule/utilities/time/timeWindows";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import {generateRentalStatementPdf} from "@carRentalModule/utilities/pdf/rentalStatementPdf";

import {rentalBusinessAccountService} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount.service";
import {invoiceService} from "@financeModule/database/schemas/invoice/invoice.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";

/** The first day (`YYYY-MM-01`) of the month after `month` (`YYYY-MM`). */
function firstDayOfNextMonth(month: string): string {
    const [year, monthNumber] = month.split("-").map(Number);
    return monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
}

export const basePath = "/api/carRental/rentalStatement";
export const router = Router();

router.post(
    "/",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 20}),
    validateFormZod(rentalStatementFormSchema),
    asyncHandler(
        async (
            params: AuthenticatedMWType & RentalStatementFormType,
            _query: object,
            _req: Request,
            res: Response,
        ) => {
            const {company, actionUserCtx, languageCode} = params;
            const readFields = SchemaGuard.sanitizeFields(
                RentalBusinessAccount,
                getModelCollectedData("rentalbusinessaccounts").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            if (!readFields.vatNumber)
                throw apiValidationException(
                    "user_permissions_not_sufficient",
                    "",
                    null,
                    languageCode,
                );
            const account = await rentalBusinessAccountService.findOne({
                _id: new ObjectId(params.businessAccount),
                company: company._id,
                deletedAt: null,
            }, {});
            if (!account)
                throw apiValidationException(
                    "rentalBusinessAccount_not_found",
                    "",
                    null,
                    languageCode,
                );
            // The month as the company lives it (GLB-09): an invoice at 00:30 on the 1st belongs to that month.
            const timeZone = await companyTimeZoneOf(company._id);
            const start = localDayInterval(`${params.month}-01`, timeZone).start;
            const end = localDayInterval(firstDayOfNextMonth(params.month), timeZone).start;
            const invoices = await invoiceService.find({
                company: company._id,
                deletedAt: null,
                "customer.vatNumber": account.vatNumber,
                issuedAt: {$gte: start, $lt: end},
            }, {}, undefined, "number issuedAt total currency", {issuedAt: 1});
            const currencies = await currencyService.find({
                _id: {$in: invoices.map((invoice) => invoice.currency)},
            }, {}, undefined, "abbreviation decimalPlaces");
            const currencyById = new Map(currencies.map((currency) => [String(currency._id), currency]));
            const buffer = await generateRentalStatementPdf(
                account,
                params.month,
                invoices.map((invoice) => {
                    const currency = currencyById.get(String(invoice.currency));
                    return {
                        number: invoice.number,
                        issuedAt: invoice.issuedAt,
                        total: invoice.total,
                        currency: currency?.abbreviation ?? "",
                        decimalPlaces: currency?.decimalPlaces ?? DEFAULT_DECIMAL_PLACES,
                    };
                }),
                timeZone,
            );
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="statement-${params.month}.pdf"`,
            );
            res.setHeader("Content-Length", buffer.length);
            res.send(buffer);
        },
    ),
);
