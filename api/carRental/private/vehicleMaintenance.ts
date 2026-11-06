import {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleMaintenanceSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenance.schema-def";
import {createVehicleMaintenanceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/createVehicleMaintenance.form.validator";
import {editVehicleMaintenanceFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/editVehicleMaintenance.form.validator";
import {vehicleMaintenanceSelectFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenanceSelect.form.validator";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import {vehicleMaintenanceService} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance.service";
import {vehicleMaintenanceToDTO, vehicleMaintenancesToDTO} from "@carRentalModule/utilities/mappers/vehicleMaintenance/vehicleMaintenanceMapper.dto";
import {vehicleMaintenancesToSelect} from "@carRentalModule/utilities/mappers/vehicleMaintenance/vehicleMaintenanceMapper.select";
import {VehicleMaintenanceActions} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance.actions";
import {assertCompanyVehicle, blockForService, recordAttachmentsUpload, releaseService, syncVehicleServiceDue} from "@carRentalModule/utilities/services/vehicleRecords";

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
    selectProjection: "_id type serviceDate provider",
    selectSchema: vehicleMaintenanceSelectFormSchema,
    extraSelectFilter: ({vehicle, scheduledRepairs}: any) => ({
        ...(vehicle ? {vehicle: new ObjectId(String(vehicle))} : {}),
        ...(scheduledRepairs ? {type: "repair", status: "scheduled"} : {}),
    }),
    defaultSort: {serviceDate: -1},
    actions: VehicleMaintenanceActions,
    createMiddleware: [recordAttachmentsUpload],
    editMiddleware: [recordAttachmentsUpload],
    /** A scheduled service with a ready date blocks the car until then; a past one is just logged. */
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        const ctx = {companyId: company._id, session, languageCode};
        const vehicleId = await assertCompanyVehicle(params.vehicle, ctx);
        const data = buildCreateDataFromSchemaDef(VehicleMaintenanceSchemaDef)(params);
        if (data.status !== "scheduled") {
            delete data.readyAt;
            return data;
        }
        if (!data.readyAt) return data;
        const block = await blockForService({vehicleId, type: data.type, serviceDate: new Date(data.serviceDate), readyAt: new Date(data.readyAt)}, ctx);
        return {...data, block};
    },
    // The status moves by the complete and cancel actions, and the blocked window is fixed once saved.
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        const update = buildUpdateDataFromSchemaDef(VehicleMaintenanceSchemaDef)(params, writeFields);
        delete update.status;
        delete update.readyAt;
        if (existing.block) {
            delete update.vehicle;
            delete update.serviceDate;
        }
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, {companyId: company._id, session, languageCode});
        return update;
    },
    afterCreate: async (created, {company, session}) => {
        await syncVehicleServiceDue(created.vehicle._id, {companyId: company._id, session});
    },
    afterUpdate: async ({company, session, _id}, existing) => {
        const updated = await vehicleMaintenanceService.findById(_id, {session: session}, undefined, "vehicle");
        for (const vehicleId of affectedVehicles(existing.vehicle?._id, updated?.vehicle?._id)) {
            await syncVehicleServiceDue(vehicleId, {companyId: company._id, session});
        }
    },
    afterDelete: async ({company, session}, doc) => {
        if (doc.status === "scheduled") await releaseService(doc, {session});
        await syncVehicleServiceDue(doc.vehicle._id, {companyId: company._id, session});
    },
});
