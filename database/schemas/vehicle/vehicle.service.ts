import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Vehicle, {IVehicle} from "./vehicle";

export class VehicleService extends BaseCrudService<IVehicle, typeof Vehicle> {
    constructor() {
        super(Vehicle, "Vehicle");
    }
}

export const vehicleService = new VehicleService();
