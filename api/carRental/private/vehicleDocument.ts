import type {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
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

/** A renewal renews a document of the same car and type that no other document renewed yet. */
async function assertRenewableDocument(data: Record<string, any>, ctx: {companyId: ObjectId; session: ClientSession; languageCode: string}): Promise<void> {
    const renewable = await vehicleDocumentService.exists({
        _id: data.supersedes,
        company: ctx.companyId,
        vehicle: data.vehicle,
        type: data.type,
        supersededBy: null,
        deletedAt: null,
    }, {session: ctx.session});
    if (!renewable) throw apiValidationException("vehicle_record_not_renewable", "", null, ctx.languageCode);
}

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
        const data = buildCreateDataFromSchemaDef(VehicleDocumentSchemaDef)(params);
        if (data.supersedes) await assertRenewableDocument(data, {companyId: company._id, session, languageCode});
        return data;
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleDocumentSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        rearmExpiry(update, existing);
        return update;
    },
    afterCreate: async (created, {session}) => {
        if (created.supersedes) await vehicleDocumentService.updateOne({_id: created.supersedes}, {$set: {supersededBy: created._id}}, {session: session});
    },
    // A deleted renewal no longer renews: the record it renewed can be renewed again.
    afterDelete: async ({session}, doc) => {
        if (doc.supersedes) await vehicleDocumentService.updateOne({_id: doc.supersedes, supersededBy: doc._id}, {$unset: {supersededBy: 1}}, {session: session});
    },
    // Restored, it renews its record again, unless another renewal took that place meanwhile.
    afterRestore: async ({session}, doc) => {
        if (doc.supersedes) await vehicleDocumentService.updateOne({_id: doc.supersedes, supersededBy: null}, {$set: {supersededBy: doc._id}}, {session: session});
    },
});
