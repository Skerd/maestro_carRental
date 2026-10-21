import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {restoreUnlessKeyTaken} from "@coreModule/api/restoreUnlessKeyTaken";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {VehicleCategorySchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";
import {createVehicleCategoryFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/createVehicleCategory.form.validator";
import {editVehicleCategoryFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/editVehicleCategory.form.validator";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {vehicleCategoryToDTO, vehicleCategoriesToDTO} from "@carRentalModule/utilities/mappers/vehicleCategory/vehicleCategoryMapper.dto";
import {vehicleCategoriesToSelect} from "@carRentalModule/utilities/mappers/vehicleCategory/vehicleCategoryMapper.select";

const mediaUpload = mediaUploadMW({
    fields: {images: 12, videos: 3},
    fieldMimeTypes: {
        images: ["image/jpeg", "image/png", "image/webp"],
        videos: ["video/mp4", "video/webm", "video/quicktime"],
    },
    maxFileSize: 250 * 1024 * 1024,
});

function assertValidSeasons(seasons: {startDate: string; endDate: string}[] | undefined, languageCode: string): void {
    if (seasons?.some((season) => season.endDate < season.startDate)) {
        throw apiValidationException("rental_season_end_before_start", "", null, languageCode);
    }
}

export const basePath = "/api/carRental/vehicleCategory";

export const {router} = createCrudRouter({
    collectionName: "vehiclecategories",
    model: VehicleCategory,
    service: vehicleCategoryService,
    entityName: "VehicleCategory",
    createSchema: createVehicleCategoryFormSchema,
    editSchema: editVehicleCategoryFormSchema,
    toDTO: vehicleCategoryToDTO,
    toDTOArray: vehicleCategoriesToDTO,
    toSelect: vehicleCategoriesToSelect,
    defaultSort: {sortOrder: 1, name: 1},
    createMiddleware: [mediaUpload],
    editMiddleware: [mediaUpload],
    buildCreateData: (params: any) => {
        assertValidSeasons(params.rateSeasons, params.languageCode);
        return buildCreateDataFromSchemaDef(VehicleCategorySchemaDef)(params);
    },
    buildUpdateData: (params: any, writeFields) => {
        assertValidSeasons(params.rateSeasons, params.languageCode);
        return buildUpdateDataFromSchemaDef(VehicleCategorySchemaDef)(params, writeFields);
    },
    overrideRestoreHandler: restoreUnlessKeyTaken({
        model: VehicleCategory,
        service: vehicleCategoryService,
        entityName: "VehicleCategory",
        keys: ["slug"],
        errorCode: "vehicle_category_slug_taken",
    }),
});
