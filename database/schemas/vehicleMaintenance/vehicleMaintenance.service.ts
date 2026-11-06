import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleMaintenance, {IVehicleMaintenance} from "./vehicleMaintenance";
import type {ClientSession, FilterQuery} from "mongoose";

export class VehicleMaintenanceService extends BaseCrudService<IVehicleMaintenance, typeof VehicleMaintenance> {
    constructor() {
        super(VehicleMaintenance, "VehicleMaintenance");
    }

    /** The most recent service record among those matching, with only the `select`ed fields. */
    findLatest(filter: FilterQuery<IVehicleMaintenance>, select: string, session?: ClientSession) {
        return this.model.findOne(filter).sort({serviceDate: -1, _id: -1}).select(select).session(session ?? null);
    }

    /** Links a damage to its repair, unless the repair was cancelled or deleted meanwhile (then null). */
    addDamageToOpenRepair(repairId: unknown, damageId: unknown, session?: ClientSession) {
        return this.model.findOneAndUpdate(
            {_id: repairId, deletedAt: null, status: {$ne: "cancelled"}},
            {$addToSet: {damages: damageId}},
            {session},
        );
    }
}

export const vehicleMaintenanceService = new VehicleMaintenanceService();
