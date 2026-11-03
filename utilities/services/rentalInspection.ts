import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import Media from "@coreModule/database/schemas/media/media";
import type {ReturnRentalReservationFormType} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.schema-def";
import type {CreateInput} from "@coreModule/database/services/baseCrudService";
import VehicleDamage, {type IVehicleDamage} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import {vehicleDamageService} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage.service";
import {damageReported} from "./vehicleRecords";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

type InspectionCtx = {session: ClientSession; languageCode: string; logger?: any; auditUserId?: string | ObjectId};

export type NewDamageInput = NonNullable<ReturnRentalReservationFormType["newDamages"]>[number];
/** Media ids from a form; the contract types them as `string | File` (files are uploaded first). */
export type MediaIdsInput = ReadonlyArray<{toString(): string}> | undefined;

/** Uploaded files named in a form, after checking they are this company's. */
export async function companyMediaIds(ids: MediaIdsInput, companyId: ObjectId, ctx: InspectionCtx): Promise<ObjectId[]> {
    const unique = [...new Set((ids ?? []).map(String))].map((id) => new ObjectId(id));
    if (!unique.length) return [];
    const found = await Media.countDocuments({_id: {$in: unique}, company: companyId}).session(ctx.session);
    if (found !== unique.length) throw apiValidationException("rental_media_not_found", "", null, ctx.languageCode);
    return unique;
}

/**
 * The damage reports the customer acknowledged at handover: each must be an open
 * (or in-repair) report of the car being handed over.
 */
export async function acknowledgedDamageIds(
    ids: ReadonlyArray<string> | undefined,
    reservation: IRentalReservation,
    companyId: ObjectId,
    ctx: InspectionCtx,
): Promise<ObjectId[]> {
    const unique = [...new Set((ids ?? []).map(String))].map((id) => new ObjectId(id));
    if (!unique.length) return [];
    const found = await VehicleDamage.countDocuments({
        _id: {$in: unique},
        company: companyId,
        vehicle: reservation.vehicle,
        status: {$in: ["open", "in_repair"]},
        deletedAt: null,
    }).session(ctx.session);
    if (found !== unique.length) throw apiValidationException("vehicle_damage_reservation_mismatch", "", null, ctx.languageCode);
    return unique;
}

/** Damage found at the return becomes damage reports on the car, linked to this booking. */
export async function recordReturnDamages(
    reservation: IRentalReservation,
    damages: NewDamageInput[],
    input: {companyId: ObjectId; now: Date},
    ctx: InspectionCtx,
): Promise<void> {
    for (const damage of damages) {
        const photos = await companyMediaIds(damage.photos, input.companyId, ctx);
        const data: CreateInput<IVehicleDamage> = {
            company: input.companyId,
            vehicle: reservation.vehicle,
            reservation: reservation._id,
            reportedAt: input.now,
            area: damage.area,
            severity: damage.severity,
            description: damage.description,
            photos,
            status: "open",
            ...(damage.estimatedCost !== undefined ? {estimatedCost: damage.estimatedCost} : {}),
        };
        const created = await vehicleDamageService.create(data, {session: ctx.session, logger: ctx.logger, languageCode: ctx.languageCode, auditUserId: ctx.auditUserId});
        await damageReported(created, {companyId: input.companyId, session: ctx.session, languageCode: ctx.languageCode});
    }
}
