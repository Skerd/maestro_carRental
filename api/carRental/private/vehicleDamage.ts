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
import {assertCompanyVehicle} from "@carRentalModule/utilities/services/vehicleRecords";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
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
    defaultSort: {reportedAt: -1},
    createMiddleware: [photosUpload],
    editMiddleware: [photosUpload],
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        const ctx = {companyId: company._id, session, languageCode};
        await assertCompanyVehicle(params.vehicle, ctx);
        if (params.reservation) await assertReservationOfVehicle(params.reservation, params.vehicle, ctx);
        return buildCreateDataFromSchemaDef(VehicleDamageSchemaDef)(params);
    },
    buildUpdateData: async (params: any, writeFields) => {
        const {company, session, languageCode, existing} = params;
        const ctx = {companyId: company._id, session, languageCode};
        const update = buildUpdateDataFromSchemaDef(VehicleDamageSchemaDef)(params, writeFields);
        if (update.vehicle) await assertCompanyVehicle(update.vehicle, ctx);
        const reservation = update.reservation !== undefined ? update.reservation : existing.reservation?._id;
        if (reservation) await assertReservationOfVehicle(reservation, update.vehicle ?? existing.vehicle?._id, ctx);
        return update;
    },
});
