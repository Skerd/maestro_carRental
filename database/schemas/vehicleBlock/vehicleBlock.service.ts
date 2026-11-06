import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleBlock, {IVehicleBlock} from "./vehicleBlock";
import type {ClientSession, FilterQuery} from "mongoose";

export class VehicleBlockService extends BaseCrudService<IVehicleBlock, typeof VehicleBlock> {
    constructor() {
        super(VehicleBlock, "VehicleBlock");
    }

    /** Ids of the cars blocked by the matching blocks. */
    distinctVehicles(filter: FilterQuery<IVehicleBlock>, session?: ClientSession | null) {
        return this.model.distinct("vehicle", filter).session(session ?? null);
    }
}

export const vehicleBlockService = new VehicleBlockService();
