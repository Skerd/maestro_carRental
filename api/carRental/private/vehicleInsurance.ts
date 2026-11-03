import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleInsuranceSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.schema-def";
import {createVehicleInsuranceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/createVehicleInsurance.form.validator";
import {editVehicleInsuranceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/editVehicleInsurance.form.validator";
import {vehicleInsuranceSelectFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsuranceSelect.form.validator";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import {VehicleInsuranceActions} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.actions";
import {vehicleInsuranceService} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.service";
import {vehicleInsuranceToDTO, vehicleInsurancesToDTO} from "@carRentalModule/utilities/mappers/vehicleInsurance/vehicleInsuranceMapper.dto";
import {vehicleInsurancesToSelect} from "@carRentalModule/utilities/mappers/vehicleInsurance/vehicleInsuranceMapper.select";
import {assertCompanyVehicle, rearmExpiry, recordAttachmentsUpload, statusForExpiry} from "@carRentalModule/utilities/services/vehicleRecords";

export const basePath = "/api/carRental/vehicleInsurance";

/** A renewal renews a policy of the same car and coverage that no other policy renewed yet. */
async function assertRenewablePolicy(data: Record<string, any>, ctx: {companyId: ObjectId; session: ClientSession; languageCode: string}): Promise<void> {
    const renewable = await VehicleInsurance.exists({
        _id: data.supersedes,
        company: ctx.companyId,
        vehicle: data.vehicle,
        coverage: data.coverage,
        supersededBy: null,
        deletedAt: null,
    }).session(ctx.session);
    if (!renewable) throw apiValidationException("vehicle_record_not_renewable", "", null, ctx.languageCode);
}

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
    selectSchema: vehicleInsuranceSelectFormSchema,
    extraSelectFilter: ({vehicle}: any) => (vehicle ? {vehicle: new ObjectId(String(vehicle))} : {}),
    defaultSort: {expiresAt: -1},
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    actions: VehicleInsuranceActions,
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        const data = buildCreateDataFromSchemaDef(VehicleInsuranceSchemaDef)(params);
        if (data.supersedes) await assertRenewablePolicy(data, {companyId: company._id, session, languageCode});
        // The form does not choose a status. A past end date is how old policies are entered.
        delete data.status;
        if (data.expiresAt) data.status = statusForExpiry(data.expiresAt);
        return data;
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        if (existing.status === "cancelled") {
            throw apiValidationException("vehicleInsurance_cancelled", "", null, languageCode);
        }
        const update = buildUpdateDataFromSchemaDef(VehicleInsuranceSchemaDef)(params, writeFields);
        delete update.status;
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        const previous = existing.expiresAt ? new Date(existing.expiresAt).getTime() : undefined;
        rearmExpiry(update, existing);
        if (update.expiresAt) {
            const next = new Date(update.expiresAt);
            if (next.getTime() !== previous) update.status = statusForExpiry(next);
        }
        return update;
    },
    afterCreate: async (created, {session}) => {
        if (created.supersedes) await VehicleInsurance.updateOne({_id: created.supersedes}, {$set: {supersededBy: created._id}}, {session});
    },
    // A deleted renewal no longer renews: the record it renewed can be renewed again.
    afterDelete: async ({session}, doc) => {
        if (doc.supersedes) await VehicleInsurance.updateOne({_id: doc.supersedes, supersededBy: doc._id}, {$unset: {supersededBy: 1}}, {session});
    },
    // Restored, it renews its record again, unless another renewal took that place meanwhile.
    afterRestore: async ({session}, doc) => {
        if (doc.supersedes) await VehicleInsurance.updateOne({_id: doc.supersedes, supersededBy: null}, {$set: {supersededBy: doc._id}}, {session});
    },
});
