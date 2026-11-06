import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {VehicleMaintenance as VehicleMaintenanceDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenance.dto";
import VehicleMaintenance, {type IVehicleMaintenance} from "./vehicleMaintenance";
import VehicleBlock from "../vehicleBlock/vehicleBlock";
import VehicleDamage from "../vehicleDamage/vehicleDamage";
import {vehicleMaintenanceToDTO} from "@carRentalModule/utilities/mappers/vehicleMaintenance/vehicleMaintenanceMapper.dto";
import {releaseService, syncVehicleServiceDue} from "@carRentalModule/utilities/services/vehicleRecords";

type ActionParams = TransactionRequiredParams & {_id: string};

async function loadScheduled(params: ActionParams): Promise<IVehicleMaintenance> {
    const record = ObjectId.isValid(params._id)
        ? await VehicleMaintenance.findOne({_id: new ObjectId(params._id), company: params.company._id, deletedAt: null}).session(params.session)
        : null;
    if (!record) throw apiValidationException("vehicleMaintenance_not_found", "", null, params.languageCode);
    if (record.status !== "scheduled") throw apiValidationException("vehicle_maintenance_not_scheduled", "", null, params.languageCode);
    return record;
}

export class VehicleMaintenanceActions {
    /**
     * The car is back from the service: its block ends now, the damages it fixed are
     * repaired, and the vehicle's next service due date and km follow this record.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async complete(params: ActionParams): Promise<VehicleMaintenanceDto> {
        const {company, session} = params;
        const record = await loadScheduled(params);
        const now = new Date();
        record.status = "completed";
        await record.save({session});
        if (record.block) await VehicleBlock.updateOne({_id: record.block, endAt: {$gt: now}}, {$set: {endAt: now}}, {session});
        const damageIds = record.damages.map((damage) => nestedEntityToRef(damage)!);
        if (damageIds.length) {
            await VehicleDamage.updateMany({_id: {$in: damageIds}, repair: record._id}, {$set: {status: "repaired", repairedAt: now}}, {session});
        }
        await syncVehicleServiceDue(nestedEntityToRef(record.vehicle)!, {companyId: company._id, session});
        return vehicleMaintenanceToDTO(record);
    }

    /** The service will not happen: the car is free for bookings again and its damages are open. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async cancel(params: ActionParams): Promise<VehicleMaintenanceDto> {
        const record = await loadScheduled(params);
        record.status = "cancelled";
        await record.save({session: params.session});
        await releaseService(record, params);
        return vehicleMaintenanceToDTO(record);
    }
}
