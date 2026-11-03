import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {createVehicleDamageFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/createVehicleDamage.form.validator";
import {editVehicleDamageFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/editVehicleDamage.form.validator";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import {vehicleDamageService} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage.service";
import {vehicleDamageToDTO, vehicleDamagesToDTO} from "@carRentalModule/utilities/mappers/vehicleDamage/vehicleDamageMapper.dto";
import {vehicleDamagesToSelect} from "@carRentalModule/utilities/mappers/vehicleDamage/vehicleDamageMapper.select";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import {assertCompanyVehicle, damageReported} from "@carRentalModule/utilities/services/vehicleRecords";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {VehicleDamageActions} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage.actions";
import {VEHICLE_DAMAGE_PHOTOS_MAX, VehicleDamageSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.schema-def";

const photosUpload = mediaUploadMW({
    fields: {photos: VEHICLE_DAMAGE_PHOTOS_MAX},
    fieldMimeTypes: {photos: ["image/jpeg", "image/png", "image/webp"]},
    maxFileSize: 20 * 1024 * 1024,
});

/** A damage tied to a booking must be on the car of that booking, in the same company. */
async function assertReservationOfVehicle(
    reservationId: unknown,
    vehicleId: unknown,
    ctx: {companyId: ObjectId; session: ClientSession; languageCode: string},
): Promise<void> {
    const matches = await RentalReservation.exists({
        _id: new ObjectId(String(reservationId)),
        company: ctx.companyId,
        vehicle: new ObjectId(String(vehicleId)),
    }).session(ctx.session);
    if (!matches) {
        throw apiValidationException("vehicle_damage_reservation_mismatch", "", null, ctx.languageCode);
    }
}

/** A claim is made on a policy of the damaged car. */
async function assertPolicyOfVehicle(
    insuranceId: unknown,
    vehicleId: unknown,
    ctx: {companyId: ObjectId; session: ClientSession; languageCode: string},
): Promise<void> {
    const matches = await VehicleInsurance.exists({
        _id: new ObjectId(String(insuranceId)),
        company: ctx.companyId,
        vehicle: new ObjectId(String(vehicleId)),
        deletedAt: null,
    }).session(ctx.session);
    if (!matches) {
        throw apiValidationException("vehicle_damage_policy_mismatch", "", null, ctx.languageCode);
    }
}

export const basePath = "/api/carRental/vehicleDamage";

export const {router} = createCrudRouter({
    collectionName: "vehicledamages",
    model: VehicleDamage,
    service: vehicleDamageService,
    entityName: "VehicleDamage",
    createSchema: createVehicleDamageFormSchema,
    editSchema: editVehicleDamageFormSchema,
    toDTO: vehicleDamageToDTO,
    toDTOArray: vehicleDamagesToDTO,
    toSelect: vehicleDamagesToSelect,
    selectSearchField: "description",
    selectProjection: "_id area severity reportedAt",
    actions: VehicleDamageActions,
    defaultSort: {reportedAt: -1},
    createMiddleware: [photosUpload],
    editMiddleware: [photosUpload],
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        const ctx = {companyId: company._id, session, languageCode};
        await assertCompanyVehicle(params.vehicle, ctx);
        if (params.reservation) await assertReservationOfVehicle(params.reservation, params.vehicle, ctx);
        if (params.insurance) await assertPolicyOfVehicle(params.insurance, params.vehicle, ctx);
        return buildCreateDataFromSchemaDef(VehicleDamageSchemaDef)(params);
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        const ctx = {companyId: company._id, session, languageCode};
        const update = buildUpdateDataFromSchemaDef(VehicleDamageSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, ctx);
        const reservation = update.reservation !== undefined ? update.reservation : existing.reservation?._id;
        if (reservation) await assertReservationOfVehicle(reservation, update.vehicle ?? existing.vehicle?._id, ctx);
        if (update.insurance) await assertPolicyOfVehicle(update.insurance, update.vehicle ?? existing.vehicle?._id, ctx);
        return update;
    },
    afterCreate: async (created, {company, session, languageCode}) => {
        await damageReported(created, {companyId: company._id, session, languageCode});
    },
    // A deleted damage leaves its repair's list; restored, it goes back to a repair still live.
    afterDelete: async ({session}, doc) => {
        if (doc.repair) await VehicleMaintenance.updateOne({_id: doc.repair}, {$pull: {damages: doc._id}}, {session});
    },
    afterRestore: async ({session}, doc) => {
        if (!doc.repair) return;
        const repair = await VehicleMaintenance.findOneAndUpdate(
            {_id: doc.repair, deletedAt: null, status: {$ne: "cancelled"}},
            {$addToSet: {damages: doc._id}},
            {session},
        );
        // The repair was cancelled or deleted meanwhile, or completed: the damage follows it.
        if (!repair) await VehicleDamage.updateOne({_id: doc._id}, {$set: {status: "open"}, $unset: {repair: 1}}, {session});
        else if (repair.status === "completed" && doc.status !== "repaired") {
            await VehicleDamage.updateOne({_id: doc._id}, {$set: {status: "repaired", repairedAt: new Date()}}, {session});
        }
    },
});
