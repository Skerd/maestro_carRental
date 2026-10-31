import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {
    type AuthenticatedMWType,
} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {buildCreateZodSchema} from "armonia/src/modules/core/helpers/schemaDefBuilder";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";

const PingFormDef = {
    vehicle: {type: "objectId", required: true},
    latitude: {type: "number", required: true, min: -90, max: 90},
    longitude: {type: "number", required: true, min: -180, max: 180},
} as const;

export const basePath = "/api/carRental/rentalTracker";
export const router = Router();

/** Records where a car last reported. The tracker calls this with a staff token. */
router.post(
    "/ping",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 120}),
    validateFormZod((languageCode: string, form: any = null) =>
        buildCreateZodSchema(PingFormDef, languageCode, form),
    ),
    asyncHandler(
        async (
            params: AuthenticatedMWType & {
                vehicle: string;
                latitude: number;
                longitude: number;
            },
        ): Promise<{data: {recorded: true}}> => {
            const {company, languageCode} = params;
            const vehicle = await Vehicle.findOne({
                _id: new ObjectId(params.vehicle),
                company: company._id,
                deletedAt: null,
            });
            if (!vehicle)
                throw apiValidationException(
                    "vehicle_not_found",
                    "",
                    null,
                    languageCode,
                );
            vehicle.lastLatitude = params.latitude;
            vehicle.lastLongitude = params.longitude;
            vehicle.lastReportedAt = new Date();
            await vehicle.save();
            return {data: {recorded: true}};
        },
    ),
);
