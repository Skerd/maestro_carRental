import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleFine, {IVehicleFine} from "./vehicleFine";

export class VehicleFineService extends BaseCrudService<IVehicleFine, typeof VehicleFine> {
    constructor() {
        super(VehicleFine, "VehicleFine");
    }
}

export const vehicleFineService = new VehicleFineService();
