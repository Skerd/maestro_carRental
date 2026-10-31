import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleTransfer, {IVehicleTransfer} from "./vehicleTransfer";

export class VehicleTransferService extends BaseCrudService<IVehicleTransfer, typeof VehicleTransfer> {
    constructor() {
        super(VehicleTransfer, "VehicleTransfer");
    }
}

export const vehicleTransferService = new VehicleTransferService();
