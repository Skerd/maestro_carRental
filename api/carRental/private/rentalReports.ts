import {Router} from "express";
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
    rentalReportsFormSchema,
    type RentalReportsFormType,
    type RentalReportsResponse,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReports/rentalReports";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {buildRentalReport} from "@carRentalModule/utilities/services/rentalReports";

import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";

export const basePath = "/api/carRental/rentalReports";
export const router = Router();

/** Utilisation, revenue, rates and lost searches for a date window. */
router.post(
    "/",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    validateFormZod(rentalReportsFormSchema),
    asyncHandler(
        async (
            params: AuthenticatedMWType & RentalReportsFormType,
        ): Promise<RentalReportsResponse> => {
            const {company, actionUserCtx, languageCode} = params;
            const readFields = SchemaGuard.sanitizeFields(
                RentalReservation,
                getModelCollectedData("rentalreservations").readFields!,
                "read",
                actionUserCtx,
                languageCode,
            );
            if (!readFields.pricing)
                throw apiValidationException(
                    "user_permissions_not_sufficient",
                    "",
                    null,
                    languageCode,
                );
            if (params.to < params.from)
                throw apiValidationException(
                    "rental_return_before_pickup",
                    "",
                    null,
                    languageCode,
                );
            const location = params.location
                ? await rentalLocationService.findOne({
                      _id: new ObjectId(params.location),
                      company: company._id,
                      deletedAt: null,
                  }, {}, undefined, "timezone")
                : await rentalLocationService.findFirstTimezone({
                      company: company._id,
                      deletedAt: null,
                  });
            const [data, config] = await Promise.all([
                buildRentalReport(company._id, {
                    from: params.from,
                    to: params.to,
                    locationId: params.location,
                    timezone: location?.timezone ?? "UTC",
                }),
                carRentalConfigService.findForCompany(company._id, {languageCode}),
            ]);
            // Every amount is in the rental currency (UX-07).
            const currency = config ? await carRentalConfigService.currencyOf(config, languageCode).catch(() => undefined) : undefined;
            return {data: {...data, ...(currency ? {currency} : {})}};
        },
    ),
);
