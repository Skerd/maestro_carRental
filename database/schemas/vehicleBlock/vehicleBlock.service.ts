import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleBlock, {IVehicleBlock} from "./vehicleBlock";

export class VehicleBlockService extends BaseCrudService<IVehicleBlock, typeof VehicleBlock> {
    constructor() {
        super(VehicleBlock, "VehicleBlock");
    }
}

export const vehicleBlockService = new VehicleBlockService();
