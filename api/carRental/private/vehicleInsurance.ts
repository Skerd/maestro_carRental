import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleInsuranceSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.schema-def";
import {createVehicleInsuranceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/createVehicleInsurance.form.validator";
import {editVehicleInsuranceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/editVehicleInsurance.form.validator";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import {vehicleInsuranceService} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.service";
import {vehicleInsuranceToDTO, vehicleInsurancesToDTO} from "@carRentalModule/utilities/mappers/vehicleInsurance/vehicleInsuranceMapper.dto";
import {vehicleInsurancesToSelect} from "@carRentalModule/utilities/mappers/vehicleInsurance/vehicleInsuranceMapper.select";
import {assertCompanyVehicle, rearmExpiry, recordAttachmentsUpload} from "@carRentalModule/utilities/services/vehicleRecords";

export const basePath = "/api/carRental/vehicleInsurance";

export const {router} = createCrudRouter({
    collectionName: "vehicleinsurances",
    model: VehicleInsurance,
    service: vehicleInsuranceService,
    entityName: "VehicleInsurance",
    createSchema: createVehicleInsuranceFormSchema,
    editSchema: editVehicleInsuranceFormSchema,
    toDTO: vehicleInsuranceToDTO,
    toDTOArray: vehicleInsurancesToDTO,
    toSelect: vehicleInsurancesToSelect,
    selectSearchField: "policyNumber",
    selectProjection: "_id policyNumber insurer",
    defaultSort: {expiresAt: -1},
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        return buildCreateDataFromSchemaDef(VehicleInsuranceSchemaDef)(params);
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleInsuranceSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        rearmExpiry(update, existing);
        return update;
    },
});
