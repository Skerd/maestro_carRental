import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleCategory, {IVehicleCategory} from "./vehicleCategory";

export class VehicleCategoryService extends BaseCrudService<IVehicleCategory, typeof VehicleCategory> {
    constructor() {
        super(VehicleCategory, "VehicleCategory");
    }
}

export const vehicleCategoryService = new VehicleCategoryService();
