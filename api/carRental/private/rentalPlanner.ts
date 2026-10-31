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
import {
    rentalPlannerFormSchema,
    type RentalPlannerFormType,
    type RentalPlannerResponse,
} from "armonia/src/modules/carRental/api/carRental/private/rentalPlanner/rentalPlanner";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import type {IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {projectedLocations} from "@carRentalModule/utilities/services/rentalAvailability";

export const basePath = "/api/carRental/rentalPlanner";
export const router = Router();

/**
 * The fleet planner: every active car (of a category, or projected at a location at the
 * start), with the bookings and blocks overlapping the window. Days are in the time zone
 * of the chosen location, or the company's first location.
 */
router.post(
    "/",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(rentalPlannerFormSchema),
    asyncHandler(async (params: AuthenticatedMWType & RentalPlannerFormType): Promise<RentalPlannerResponse> => {
        const {company, actionUserCtx, languageCode} = params;
        const readFields = SchemaGuard.sanitizeFields(RentalReservation, getModelCollectedData("rentalreservations").readFields!, "read", actionUserCtx, languageCode);
        if (!readFields.pickupAt || !readFields.vehicle) throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);

        const location = await RentalLocation.findOne({company: company._id, deletedAt: null, ...(params.location ? {_id: new ObjectId(params.location)} : {})})
            .sort({name: 1}).select("timezone");
        const timezone = location?.timezone ?? "UTC";
        const from = localToUtc(params.from, "00:00", timezone) ?? new Date(`${params.from}T00:00:00Z`);
        const to = localToUtc(addLocalDays(params.from, params.days), "00:00", timezone) ?? new Date(from.getTime() + params.days * 86400000);

        const vehicles = await Vehicle.find({company: company._id, status: "active", deletedAt: null, ...(params.category ? {category: new ObjectId(params.category)} : {})})
            .populate<{category: IVehicleCategory}>({path: "category", select: "name sortOrder"})
            .select("plate make model category readiness homeLocation currentLocation")
            .sort({plate: 1});
        const located = await projectedLocations(vehicles, from, company._id);
        const shown = params.location ? vehicles.filter((vehicle) => located.get(String(vehicle._id)) === params.location) : vehicles;
        const ids = shown.map((vehicle) => vehicle._id);
        const locationNames = new Map((await RentalLocation.find({company: company._id}).select("name")).map((entry) => [String(entry._id), entry.name]));

        const [reservations, blocks] = await Promise.all([
            RentalReservation.find({
                company: company._id,
                vehicle: {$in: ids},
                deletedAt: null,
                status: {$in: ["held", "confirmed", "in_progress", "completed"]},
                pickupAt: {$lt: to},
                returnAt: {$gt: from},
            }).select("number vehicle status pickupAt returnAt contact needsTransfer"),
            VehicleBlock.find({company: company._id, vehicle: {$in: ids}, deletedAt: null, startAt: {$lt: to}, endAt: {$gt: from}}).select("vehicle startAt endAt reason"),
        ]);

        return {
            data: {
                from: from.toISOString(),
                to: to.toISOString(),
                timezone,
                vehicles: shown
                    .sort((a, b) => (a.category?.sortOrder ?? 0) - (b.category?.sortOrder ?? 0) || a.plate.localeCompare(b.plate))
                    .map((vehicle) => ({
                        _id: vehicle._id.toString(),
                        plate: vehicle.plate,
                        label: `${vehicle.make} ${vehicle.model}`,
                        categoryId: String(vehicle.category?._id ?? ""),
                        categoryName: vehicle.category?.name ?? "",
                        readiness: vehicle.readiness ?? "ready",
                        locationName: locationNames.get(located.get(String(vehicle._id)) ?? ""),
                    })),
                reservations: reservations.map((reservation) => ({
                    _id: reservation._id.toString(),
                    number: reservation.number,
                    vehicle: String(reservation.vehicle),
                    status: reservation.status,
                    pickupAt: reservation.pickupAt.toISOString(),
                    returnAt: reservation.returnAt.toISOString(),
                    customer: `${reservation.contact.firstName} ${reservation.contact.lastName}`.trim(),
                    needsTransfer: reservation.needsTransfer ?? false,
                })),
                blocks: blocks.map((block) => ({
                    _id: block._id.toString(),
                    vehicle: String(block.vehicle),
                    startAt: block.startAt.toISOString(),
                    endAt: block.endAt.toISOString(),
                    reason: block.reason,
                })),
            },
        };
    }),
);
