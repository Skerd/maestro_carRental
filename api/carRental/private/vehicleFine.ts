import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleFineSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.schema-def";
import {createVehicleFineFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/createVehicleFine.form.validator";
import {editVehicleFineFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/editVehicleFine.form.validator";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import {vehicleFineService} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine.service";
import {vehicleFineToDTO, vehicleFinesToDTO} from "@carRentalModule/utilities/mappers/vehicleFine/vehicleFineMapper.dto";
import {vehicleFinesToSelect} from "@carRentalModule/utilities/mappers/vehicleFine/vehicleFineMapper.select";
import {VehicleFineActions} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine.actions";
import {assertCompanyVehicle, recordAttachmentsUpload} from "@carRentalModule/utilities/services/vehicleRecords";
import {bookingAtOffence, mainDriverName} from "@carRentalModule/utilities/services/rentalFines";

export const basePath = "/api/carRental/vehicleFine";

export const {router} = createCrudRouter({
    collectionName: "vehiclefines",
    model: VehicleFine,
    service: vehicleFineService,
    entityName: "VehicleFine",
    createSchema: createVehicleFineFormSchema,
    editSchema: editVehicleFineFormSchema,
    toDTO: vehicleFineToDTO,
    toDTOArray: vehicleFinesToDTO,
    toSelect: vehicleFinesToSelect,
    selectSearchField: "reference",
    defaultSort: {offenceAt: -1},
    actions: VehicleFineActions,
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    /** A new fine is matched to the booking that had the car at the time, and its main driver. */
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        const vehicleId = await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        const data = await buildCreateDataFromSchemaDef(VehicleFineSchemaDef)(params);
        const booking = await bookingAtOffence({companyId: company._id, vehicleId, offenceAt: new Date(data.offenceAt)}, session);
        if (!booking) return data;
        return {...data, reservation: booking._id, driverName: mainDriverName(booking), status: data.status === "received" || !data.status ? "driver_identified" : data.status};
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleFineSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        return update;
    },
});
