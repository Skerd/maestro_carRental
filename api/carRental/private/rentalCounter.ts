import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {type AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {addLocalDays, localToUtc} from "@coreModule/utilities/time/timeWindows";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {rentalCounterFormSchema, type RentalCounterFormType, type RentalCounterResponse} from "armonia/src/modules/carRental/api/carRental/private/rentalCounter/rentalCounter";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {rentalReservationsToDTO} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";

export const basePath = "/api/carRental/rentalCounter";
export const router = Router();

/** The counter's day at a location: who picks up, who returns, and who is late. */
router.post(
    "/",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(rentalCounterFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & RentalCounterFormType): Promise<RentalCounterResponse> => {
        const {company, actionUserCtx, languageCode} = params;
        const readFields = SchemaGuard.sanitizeFields(RentalReservation, getModelCollectedData("rentalreservations").readFields!, "read", actionUserCtx, languageCode);
        if (!readFields.pickupAt || !readFields.contact) throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
        const populate = SchemaGuard.generatePopulate(readFields, RentalReservation.schema).populate;

        const location = await RentalLocation.findOne({company: company._id, deletedAt: null, ...(params.location ? {_id: new ObjectId(params.location)} : {})})
            .sort({name: 1}).select("timezone");
        const timezone = location?.timezone ?? "UTC";
        const start = localToUtc(params.date, "00:00", timezone) ?? new Date(`${params.date}T00:00:00Z`);
        const end = localToUtc(addLocalDays(params.date, 1), "00:00", timezone) ?? new Date(start.getTime() + 86400000);
        const base = {company: company._id, deletedAt: null};
        const at = (field: "pickupLocation" | "returnLocation") => (params.location ? {[field]: new ObjectId(params.location)} : {});

        const [pickups, returns, overdue] = await Promise.all([
            RentalReservation.find({...base, ...at("pickupLocation"), status: "confirmed", pickupAt: {$gte: start, $lt: end}}).sort({pickupAt: 1}).populate(populate),
            RentalReservation.find({...base, ...at("returnLocation"), status: "in_progress", returnAt: {$gte: start, $lt: end}}).sort({returnAt: 1}).populate(populate),
            RentalReservation.find({...base, ...at("returnLocation"), status: "in_progress", returnAt: {$lt: start}}).sort({returnAt: 1}).populate(populate),
        ]);
        return {data: {timezone, pickups: rentalReservationsToDTO(pickups), returns: rentalReservationsToDTO(returns), overdue: rentalReservationsToDTO(overdue)}};
    }),
);
