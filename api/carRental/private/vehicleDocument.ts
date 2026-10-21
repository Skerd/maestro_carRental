import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleDocumentSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleDocument/vehicleDocument.schema-def";
import {createVehicleDocumentFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDocument/createVehicleDocument.form.validator";
import {editVehicleDocumentFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDocument/editVehicleDocument.form.validator";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import {vehicleDocumentService} from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument.service";
import {vehicleDocumentToDTO, vehicleDocumentsToDTO} from "@carRentalModule/utilities/mappers/vehicleDocument/vehicleDocumentMapper.dto";
import {vehicleDocumentsToSelect} from "@carRentalModule/utilities/mappers/vehicleDocument/vehicleDocumentMapper.select";
import {assertCompanyVehicle, rearmExpiry, recordAttachmentsUpload} from "@carRentalModule/utilities/services/vehicleRecords";

export const basePath = "/api/carRental/vehicleDocument";

export const {router} = createCrudRouter({
    collectionName: "vehicledocuments",
    model: VehicleDocument,
    service: vehicleDocumentService,
    entityName: "VehicleDocument",
    createSchema: createVehicleDocumentFormSchema,
    editSchema: editVehicleDocumentFormSchema,
    toDTO: vehicleDocumentToDTO,
    toDTOArray: vehicleDocumentsToDTO,
    toSelect: vehicleDocumentsToSelect,
    selectSearchField: "documentNumber",
    selectProjection: "_id type documentNumber",
    defaultSort: {expiresAt: -1},
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        return buildCreateDataFromSchemaDef(VehicleDocumentSchemaDef)(params);
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleDocumentSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        rearmExpiry(update, existing);
        return update;
    },
});
