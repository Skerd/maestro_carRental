import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {CarRentalConfigSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.schema-def";
import {createCarRentalConfigFormSchema} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/createCarRentalConfig.form.validator";
import {editCarRentalConfigFormSchema} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/editCarRentalConfig.form.validator";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {CarRentalConfigActions} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.actions";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import {carRentalConfigToDTO, carRentalConfigsToDTO} from "@carRentalModule/utilities/mappers/carRentalConfig/carRentalConfigMapper.dto";
import {carRentalConfigsToSelect} from "@carRentalModule/utilities/mappers/carRentalConfig/carRentalConfigMapper.select";

/**
 * Public booking only goes live once a customer could actually complete one: a
 * location to pick up at and a public category with a car in it.
 */
async function assertReadyForPublicBooking(companyId: ObjectId, session: ClientSession, languageCode: string): Promise<void> {
    const location = await RentalLocation.exists({company: companyId, isActive: true, pickupAllowed: true, deletedAt: null}).session(session);
    if (!location) throw apiValidationException("rental_setup_missing_location", "", null, languageCode);
    const categories = await VehicleCategory.find({company: companyId, isPublic: true, deletedAt: null}).select("_id").session(session);
    const vehicle = categories.length
        ? await Vehicle.exists({company: companyId, status: "active", category: {$in: categories.map((c) => c._id)}, deletedAt: null}).session(session)
        : null;
    if (!vehicle) throw apiValidationException("rental_setup_missing_vehicle", "", null, languageCode);
}

export const basePath = "/api/carRental/carRentalConfig";

// One settings document per company (unique index); the settings page creates it through `ensure`.
export const {router} = createCrudRouter({
    collectionName: "carrentalconfigs",
    model: CarRentalConfig,
    service: carRentalConfigService,
    entityName: "CarRentalConfig",
    createSchema: createCarRentalConfigFormSchema,
    editSchema: editCarRentalConfigFormSchema,
    toDTO: carRentalConfigToDTO,
    toDTOArray: carRentalConfigsToDTO,
    toSelect: carRentalConfigsToSelect,
    selectSearchField: "_id",
    actions: CarRentalConfigActions,
    buildCreateData: buildCreateDataFromSchemaDef(CarRentalConfigSchemaDef),
    buildUpdateData: async (params: any, writeFields) => {
        if (params.publicBookingEnabled === true && writeFields.publicBookingEnabled) {
            await assertReadyForPublicBooking(params.company._id, params.session, params.languageCode);
        }
        return buildUpdateDataFromSchemaDef(CarRentalConfigSchemaDef)(params, writeFields);
    },
    rateLimits: {read: 60, write: 30, delete: 0},
});
