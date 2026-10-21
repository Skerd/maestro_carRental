import type {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleMaintenanceSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenance.schema-def";
import {createVehicleMaintenanceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/createVehicleMaintenance.form.validator";
import {editVehicleMaintenanceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/editVehicleMaintenance.form.validator";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import {vehicleMaintenanceService} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance.service";
import {vehicleMaintenanceToDTO, vehicleMaintenancesToDTO} from "@carRentalModule/utilities/mappers/vehicleMaintenance/vehicleMaintenanceMapper.dto";
import {vehicleMaintenancesToSelect} from "@carRentalModule/utilities/mappers/vehicleMaintenance/vehicleMaintenanceMapper.select";
import {assertCompanyVehicle, recordAttachmentsUpload, syncVehicleServiceDue} from "@carRentalModule/utilities/services/vehicleRecords";

export const basePath = "/api/carRental/vehicleMaintenance";

/** The vehicle (or vehicles, when a record moves to another car) whose next service to recompute. */
function affectedVehicles(...ids: unknown[]): ObjectId[] {
    const unique = new Map(ids.filter(Boolean).map((id) => [String(id), id as ObjectId]));
    return [...unique.values()];
}

export const {router} = createCrudRouter({
    collectionName: "vehiclemaintenances",
    model: VehicleMaintenance,
    service: vehicleMaintenanceService,
    entityName: "VehicleMaintenance",
    createSchema: createVehicleMaintenanceFormSchema,
    editSchema: editVehicleMaintenanceFormSchema,
    toDTO: vehicleMaintenanceToDTO,
    toDTOArray: vehicleMaintenancesToDTO,
    toSelect: vehicleMaintenancesToSelect,
    selectSearchField: "provider",
    selectProjection: "_id type serviceDate",
    defaultSort: {serviceDate: -1},
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        return buildCreateDataFromSchemaDef(VehicleMaintenanceSchemaDef)(params);
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleMaintenanceSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        return update;
    },
    afterCreate: async (created, {company, session}) => {
        await syncVehicleServiceDue(created.vehicle._id, {companyId: company._id, session});
    },
    afterUpdate: async ({company, session, _id}, existing) => {
        const updated = await VehicleMaintenance.findById(_id).select("vehicle").session(session);
        for (const vehicleId of affectedVehicles(existing.vehicle?._id, updated?.vehicle?._id)) {
            await syncVehicleServiceDue(vehicleId, {companyId: company._id, session});
        }
    },
    afterDelete: async ({company, session}, doc) => {
        await syncVehicleServiceDue(doc.vehicle._id, {companyId: company._id, session});
    },
});
