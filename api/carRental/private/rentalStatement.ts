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
import {buildCreateZodSchema} from "armonia/src/modules/core/helpers/schemaDefBuilder";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Invoice from "@financeModule/database/schemas/invoice/invoice";
import Currency from "@coreModule/database/schemas/currency/currency";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import {generateRentalStatementPdf} from "@carRentalModule/utilities/pdf/rentalStatementPdf";

const StatementFormDef = {
    businessAccount: {type: "objectId", required: true},
    /** `YYYY-MM` in UTC. The invoices issued that month for the account's VAT number. */
    month: {type: "string", required: true, min: 7, max: 7},
} as const;

export const basePath = "/api/carRental/rentalStatement";
export const router = Router();

router.post(
    "/",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 20}),
    validateFormZod((languageCode: string, form: any = null) =>
        buildCreateZodSchema(StatementFormDef, languageCode, form),
    ),
    asyncHandler(
        async (
            params: AuthenticatedMWType & {
                businessAccount: string;
                month: string;
            },
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
            if (!/^\d{4}-\d{2}$/.test(params.month))
                throw apiValidationException(
                    "rental_invalid_return_time",
                    "",
                    null,
                    languageCode,
                );
            const account = await RentalBusinessAccount.findOne({
                _id: new ObjectId(params.businessAccount),
                company: company._id,
                deletedAt: null,
            });
            if (!account)
                throw apiValidationException(
                    "rentalBusinessAccount_not_found",
                    "",
                    null,
                    languageCode,
                );
            const start = new Date(`${params.month}-01T00:00:00.000Z`);
            const end = new Date(
                Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
            );
            const invoices = await Invoice.find({
                company: company._id,
                deletedAt: null,
                "customer.vatNumber": account.vatNumber,
                issuedAt: {$gte: start, $lt: end},
            })
                .select("number issuedAt total currency")
                .sort({issuedAt: 1});
            const currencies = await Currency.find({
                _id: {$in: invoices.map((invoice) => invoice.currency)},
            }).select("abbreviation");
            const abbreviation = new Map(
                currencies.map((currency) => [
                    String(currency._id),
                    currency.abbreviation,
                ]),
            );
            const buffer = await generateRentalStatementPdf(
                account,
                params.month,
                invoices.map((invoice) => ({
                    number: invoice.number,
                    issuedAt: invoice.issuedAt,
                    total: invoice.total,
                    currency: abbreviation.get(String(invoice.currency)) ?? "",
                })),
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
