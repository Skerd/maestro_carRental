import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleInsurance, {IVehicleInsurance} from "./vehicleInsurance";

export class VehicleInsuranceService extends BaseCrudService<IVehicleInsurance, typeof VehicleInsurance> {
    constructor() {
        super(VehicleInsurance, "VehicleInsurance");
    }
}

export const vehicleInsuranceService = new VehicleInsuranceService();
