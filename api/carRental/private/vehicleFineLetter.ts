import {Router, type Request, type Response} from "express";
import {ObjectId} from "mongodb";
import authMW, {type AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import {generateFineDriverLetterPdf} from "@carRentalModule/utilities/pdf/fineDriverLetterPdf";

export const basePath = "/api/carRental/vehicleFineLetter";
export const router = Router();

/** The driver letter for a fine, for staff who may read fines and the driver on them. */
router.get(
    "/:fineId",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 30}),
    asyncHandler(async (params: AuthenticatedMWType, queryParams: {fineId: string}, _req: Request, res: Response) => {
        const {company, actionUserCtx, languageCode} = params;
        const readFields = SchemaGuard.sanitizeFields(VehicleFine, getModelCollectedData("vehiclefines").readFields!, "read", actionUserCtx, languageCode);
        if (!readFields.driverName) throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
        const fine = ObjectId.isValid(queryParams.fineId)
            ? await VehicleFine.findOne({_id: new ObjectId(queryParams.fineId), company: company._id, deletedAt: null})
            : null;
        if (!fine) throw apiValidationException("vehicleFine_not_found", "", null, languageCode);
        const buffer = await generateFineDriverLetterPdf(fine, languageCode);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(`${fine.reference}.pdf`)}"`);
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    }),
);
