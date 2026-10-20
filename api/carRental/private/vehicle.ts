import {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {restoreUnlessKeyTaken} from "@coreModule/api/restoreUnlessKeyTaken";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {VehicleSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import {createVehicleFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/createVehicle.form.validator";
import {editVehicleFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/editVehicle.form.validator";
import {vehicleSelectFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicleSelect.form.validator";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {vehicleToDTO, vehiclesToDTO} from "@carRentalModule/utilities/mappers/vehicle/vehicleMapper.dto";
import {vehiclesToSelect} from "@carRentalModule/utilities/mappers/vehicle/vehicleMapper.select";
import {blockingReservationFilter, lockVehicle} from "@carRentalModule/utilities/services/rentalAvailability";

export const basePath = "/api/carRental/vehicle";

export const {router} = createCrudRouter({
    collectionName: "vehicles",
    model: Vehicle,
    service: vehicleService,
    entityName: "Vehicle",
    createSchema: createVehicleFormSchema,
    editSchema: editVehicleFormSchema,
    selectSchema: vehicleSelectFormSchema,
    toDTO: vehicleToDTO,
    toDTOArray: vehiclesToDTO,
    toSelect: vehiclesToSelect,
    selectSearchField: "plate",
    selectProjection: "_id plate make model",
    defaultSort: {plate: 1},
    extraSelectFilter: ({category}: any) => ({
        status: "active",
        ...(category ? {category: new ObjectId(String(category))} : {}),
    }),
    buildCreateData: buildCreateDataFromSchemaDef(VehicleSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(VehicleSchemaDef),
    /**
     * A vehicle that goes out of service or into another category would leave its
     * upcoming bookings without a matching car: those must be reassigned first.
     * Taking the lock keeps a booking from slipping in while this commits.
     */
    afterUpdate: async (params: any, existing) => {
        const {company, session, languageCode, status, category} = params;
        const leavesService = status !== undefined && status !== "active" && existing.status === "active";
        const changesCategory = category !== undefined && String(category) !== String(existing.category);
        if (!leavesService && !changesCategory) return;

        await lockVehicle(existing._id, {companyId: company._id, session, languageCode, requireActive: false});
        const upcoming = await RentalReservation.countDocuments({
            company: company._id,
            vehicle: existing._id,
            blockedUntil: {$gt: new Date()},
            ...blockingReservationFilter(new Date()),
        }).session(session);
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
