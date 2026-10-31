import {Router, type Request, type Response} from "express";
import {ObjectId} from "mongodb";
import authMW, {type AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {generateRentalAgreementPdf} from "@carRentalModule/utilities/pdf/rentalAgreementPdf";

export const basePath = "/api/carRental/rentalAgreementPdf";
export const router = Router();

/** The rental agreement of a handed-over booking, for staff who may read its prices and drivers. */
router.get(
    "/:reservationId",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType, queryParams: {reservationId: string}, _req: Request, res: Response) => {
        const {company, actionUserCtx, languageCode} = params;
        const readFields = SchemaGuard.sanitizeFields(RentalReservation, getModelCollectedData("rentalreservations").readFields!, "read", actionUserCtx, languageCode);
        if (!readFields.pricing || !readFields.drivers) throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
        const reservation = ObjectId.isValid(queryParams.reservationId)
            ? await RentalReservation.findOne({_id: new ObjectId(queryParams.reservationId), company: company._id, deletedAt: null})
            : null;
        if (!reservation?.handover) throw apiValidationException("rental_reservation_not_found", "", null, languageCode);
        const buffer = await generateRentalAgreementPdf(reservation, languageCode);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(`${reservation.number}.pdf`)}"`);
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    }),
);
