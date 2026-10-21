import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleDocument, {IVehicleDocument} from "./vehicleDocument";

export class VehicleDocumentService extends BaseCrudService<IVehicleDocument, typeof VehicleDocument> {
    constructor() {
        super(VehicleDocument, "VehicleDocument");
    }
}

export const vehicleDocumentService = new VehicleDocumentService();
