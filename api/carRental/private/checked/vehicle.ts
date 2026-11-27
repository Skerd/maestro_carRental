import {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {VehicleActions} from "@carRentalModule/database/schemas/vehicle/vehicle.actions";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {restoreUnlessKeyTaken} from "@coreModule/api/restoreUnlessKeyTaken";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    VEHICLE_IMAGES_MAX,
    VEHICLE_LISTING_IMAGES_MAX,
    VEHICLE_VIDEOS_MAX,
    VehicleSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import {createVehicleFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/createVehicle.form.validator";
import {editVehicleFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/editVehicle.form.validator";
import {vehicleSelectFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicleSelect.form.validator";
import Vehicle, {type IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import type {UserContext} from "@coreModule/utilities/types/types";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {vehicleToDTO, vehiclesToDTO} from "@carRentalModule/utilities/mappers/vehicle/vehicleMapper.dto";
import {vehiclesToSelect} from "@carRentalModule/utilities/mappers/vehicle/vehicleMapper.select";
import {blockingReservationFilter, countUpcomingExactBookings, lockVehicle} from "@carRentalModule/utilities/services/rentalAvailability";

import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {withRentalCurrency} from "@carRentalModule/utilities/services/rentalCurrency";
import {vehicleHub} from "@carRentalModule/utilities/services/vehicleHub";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {assertValidSeasons, withSeasonCurrency} from "@carRentalModule/utilities/services/rentalRateSeasons";
import {applyCatalogModel} from "@carRentalModule/utilities/services/vehicleCatalogFill";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {effectiveVehicleRates} from "armonia/src/modules/carRental/helpers/vehicleRates";
import type {Vehicle as VehicleDto} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.dto";
/** Each car with what booking it exactly costs: its own prices, else its group's (D198). */
async function withRates(docs: IVehicle[], companyId: ObjectId): Promise<VehicleDto[]> {
    const groups = new Map((await vehicleCategoryService.find(
        {company: companyId, _id: {$in: docs.map((doc) => nestedEntityToRef(doc.category))}},
        {withDeleted: true},
        undefined,
        "dailyRate weekendDailyRate weeklyRate rateSeasons depositAmount",
    )).map((group) => [String(group._id), group]));
    return docs.map((doc) => {
        const group = groups.get(String(nestedEntityToRef(doc.category)));
        return {...vehicleToDTO(doc), ...(group ? {rates: effectiveVehicleRates(group, doc)} : {})};
    });
}

async function vehicleWithHub(doc: IVehicle, {company, actionUserCtx, languageCode}: {company: {_id: ObjectId}; actionUserCtx: UserContext; languageCode: string}) {
    const [vehicle] = (await withRentalCurrency(await withRates([doc], company._id), company._id, languageCode)).map(withSeasonCurrency);
    return {...vehicle, ...(await vehicleHub(doc._id, {companyId: company._id, actionUserCtx, languageCode, currency: vehicle.currency}))};
}

const mediaUpload = mediaUploadMW({
    fields: {images: VEHICLE_IMAGES_MAX, videos: VEHICLE_VIDEOS_MAX, listingImages: VEHICLE_LISTING_IMAGES_MAX},
    fieldMimeTypes: {
        images: ["image/jpeg", "image/png", "image/webp"],
        listingImages: ["image/jpeg", "image/png", "image/webp"],
        videos: ["video/mp4", "video/webm", "video/quicktime"],
    },
    maxFileSize: 250 * 1024 * 1024,
});

export const basePath = "/api/carRental/vehicle";

export const {router} = createCrudRouter({
    actions: VehicleActions,
    collectionName: "vehicles",
    model: Vehicle,
    service: vehicleService,
    entityName: "Vehicle",
    createSchema: createVehicleFormSchema,
    editSchema: editVehicleFormSchema,
    selectSchema: vehicleSelectFormSchema,
    toDTO: vehicleToDTO,
    toDTOArray: vehiclesToDTO,
    // Every amount is in the rental currency (UX-07).
    enrichList: async (docs, params: any) => withRentalCurrency(await withRates(docs, params.company._id), params.company._id, params.languageCode),
    // The single read is the car's hub: its bookings, damages, services, papers, fines and blocks (UX-03); an edit
    // returns it too, so the open sheet keeps its lists.
    enrichSingle: (doc, params: any) => vehicleWithHub(doc, params),
    enrichUpdate: (doc, params: any) => vehicleWithHub(doc, params),
    toSelect: vehiclesToSelect,
    selectSearchField: "plate",
    selectProjection: "_id plate make model",
    defaultSort: {plate: 1},
    extraSelectFilter: ({category, includeInactive}: any) => ({
        ...(includeInactive ? {} : {status: "active"}),
        ...(category ? {category: new ObjectId(String(category))} : {}),
    }),
    createMiddleware: [mediaUpload],
    editMiddleware: [mediaUpload],
    // A car's own seasons are checked like a category's (D198).
    // A car's own seasons are checked like a category's (D198); a catalog model fills its names and specs (D199).
    buildCreateData: async (params: any) => {
        assertValidSeasons(params.rateSeasons, params.languageCode);
        return applyCatalogModel(await buildCreateDataFromSchemaDef(VehicleSchemaDef)(params), params);
    },
    buildUpdateData: async (params: any, writeFields) => {
        assertValidSeasons(params.rateSeasons, params.languageCode);
        return applyCatalogModel(await buildUpdateDataFromSchemaDef(VehicleSchemaDef)(params, writeFields), params);
    },
    /**
     * A vehicle that goes out of service or into another category would leave its
     * upcoming bookings without a matching car: those must be reassigned first.
     * Taking the lock keeps a booking from slipping in while this commits.
     */
    afterUpdate: async (params: any, existing) => {
        const {company, session, languageCode, status, category, listedAlone} = params;
        const leavesService = status !== undefined && status !== "active" && existing.status === "active";
        const changesCategory = category !== undefined && String(category) !== String(existing.category);
        // A car booked exactly stays rented on its own until those bookings have another car (D198).
        if (listedAlone === false && existing.listedAlone) {
            const exact = await countUpcomingExactBookings(existing._id, {companyId: company._id, session});
            if (exact > 0) {
                throw apiValidationException("vehicle_has_future_exact_reservations", "", null, languageCode, [String(exact)]);
            }
        }
        if (!leavesService && !changesCategory) return;

        await lockVehicle(existing._id, {companyId: company._id, session, languageCode, requireActive: false});
        const upcoming = await rentalReservationService.count({
            company: company._id,
            vehicle: existing._id,
            blockedUntil: {$gt: new Date()},
            ...blockingReservationFilter(new Date()),
        }, {session: session});
        if (upcoming > 0) {
            throw apiValidationException("vehicle_has_future_reservations", "", null, languageCode, [String(upcoming)]);
        }
    },
    overrideRestoreHandler: restoreUnlessKeyTaken({
        model: Vehicle,
        service: vehicleService,
        entityName: "Vehicle",
        keys: ["plate"],
        errorCode: "vehicle_plate_taken",
    }),
});
