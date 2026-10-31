import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {VehicleTransfer as VehicleTransferDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/vehicleTransfer.dto";
import VehicleTransfer, {type IVehicleTransfer} from "./vehicleTransfer";
import Vehicle from "../vehicle/vehicle";
import VehicleBlock from "../vehicleBlock/vehicleBlock";
import {vehicleTransferToDTO} from "@carRentalModule/utilities/mappers/vehicleTransfer/vehicleTransferMapper.dto";
import {assertReservationWrite} from "@carRentalModule/utilities/services/rentalAccess";

type ActionParams<F> = TransactionRequiredParams & F;

async function loadTransfer(params: ActionParams<{_id: string}>, statuses: IVehicleTransfer["status"][]): Promise<IVehicleTransfer> {
    const transfer = ObjectId.isValid(params._id)
        ? await VehicleTransfer.findOne({_id: new ObjectId(params._id), company: params.company._id, deletedAt: null}).session(params.session)
        : null;
    if (!transfer) throw apiValidationException("vehicleTransfer_not_found", "", null, params.languageCode);
    if (!statuses.includes(transfer.status)) throw apiValidationException("rental_transfer_invalid_status", "", null, params.languageCode);
    return transfer;
}

export class VehicleTransferActions {
    /** The car leaves for the other location. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async start(params: ActionParams<{_id: string}>): Promise<VehicleTransferDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const transfer = await loadTransfer(params, ["planned"]);
        transfer.status = "in_transit";
        await transfer.save({session: params.session});
        return vehicleTransferToDTO(transfer);
    }

    /** The car is at the new location: it counts there from now on, and its block ends now. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async complete(params: ActionParams<{_id: string}>): Promise<VehicleTransferDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const transfer = await loadTransfer(params, ["planned", "in_transit"]);
        const now = new Date();
        transfer.status = "done";
        if (now < transfer.arriveAt) transfer.arriveAt = now;
        await transfer.save({session: params.session});
        await Vehicle.updateOne(
            {_id: nestedEntityToRef(transfer.vehicle), company: params.company._id},
            {$set: {currentLocation: nestedEntityToRef(transfer.toLocation), ...(transfer.odometerKm ? {odometerKm: transfer.odometerKm} : {})}},
            {session: params.session},
        );
        if (transfer.block) await VehicleBlock.updateOne({_id: transfer.block, endAt: {$gt: now}}, {$set: {endAt: now}}, {session: params.session});
        return vehicleTransferToDTO(transfer);
    }

    /** The transfer will not happen: the car is free for bookings again. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async cancel(params: ActionParams<{_id: string}>): Promise<VehicleTransferDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const transfer = await loadTransfer(params, ["planned"]);
        transfer.status = "cancelled";
        await transfer.save({session: params.session});
        if (transfer.block) await VehicleBlock.updateOne({_id: transfer.block}, {$set: {deletedAt: new Date()}}, {session: params.session});
        return vehicleTransferToDTO(transfer);
    }
}
