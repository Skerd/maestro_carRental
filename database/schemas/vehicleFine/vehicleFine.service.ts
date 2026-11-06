import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleFine, {IVehicleFine} from "./vehicleFine";
import type {FilterQuery} from "mongoose";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";

export class VehicleFineService extends BaseCrudService<IVehicleFine, typeof VehicleFine> {
    constructor() {
        super(VehicleFine, "VehicleFine");
    }

    /** A batch of fines with their car's plate, for the fleet reminders. */
    findWithVehiclePlate(filter: FilterQuery<IVehicleFine>, limit: number) {
        return this.model.find(filter).populate<{vehicle: IVehicle | null}>("vehicle", "plate").limit(limit).exec();
    }
}

export const vehicleFineService = new VehicleFineService();
