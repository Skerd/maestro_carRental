import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleMaintenance, {IVehicleMaintenance} from "./vehicleMaintenance";

export class VehicleMaintenanceService extends BaseCrudService<IVehicleMaintenance, typeof VehicleMaintenance> {
    constructor() {
        super(VehicleMaintenance, "VehicleMaintenance");
    }
}

export const vehicleMaintenanceService = new VehicleMaintenanceService();
