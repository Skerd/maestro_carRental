import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleDamage, {IVehicleDamage} from "./vehicleDamage";

export class VehicleDamageService extends BaseCrudService<IVehicleDamage, typeof VehicleDamage> {
    constructor() {
        super(VehicleDamage, "VehicleDamage");
    }
}

export const vehicleDamageService = new VehicleDamageService();
