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
import {matchFine} from "@carRentalModule/utilities/services/rentalFines";
import {withRentalCurrency} from "@carRentalModule/utilities/services/rentalCurrency";

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
    // Every amount is in the rental currency (UX-07).
    enrichList: (docs, params: any) => withRentalCurrency(vehicleFinesToDTO(docs), params.company._id, params.languageCode),
    enrichSingle: async (doc, params: any) => (await withRentalCurrency([vehicleFineToDTO(doc)], params.company._id, params.languageCode))[0],
    enrichUpdate: async (doc, params: any) => (await withRentalCurrency([vehicleFineToDTO(doc)], params.company._id, params.languageCode))[0],
    toSelect: vehicleFinesToSelect,
    selectSearchField: "reference",
    // The label reads the reference and the authority (TD-B234).
    selectProjection: "_id reference authority",
    defaultSort: {offenceAt: -1},
    actions: VehicleFineActions,
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    /**
     * A new fine is matched to the booking that had the car at the time and its main
     * driver, or else to the staff transfer and its driver. The status follows the match.
     */
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        const vehicleId = await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        const data = await buildCreateDataFromSchemaDef(VehicleFineSchemaDef)(params);
        const match = await matchFine({companyId: company._id, vehicleId, offenceAt: new Date(data.offenceAt)}, session);
        return {
            ...data,
            reservation: match.reservation?._id,
            transfer: match.transfer?._id,
            driverName: match.driverName,
            status: match.reservation || match.driverName ? "driver_identified" : "received",
        };
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleFineSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        return update;
    },
});
