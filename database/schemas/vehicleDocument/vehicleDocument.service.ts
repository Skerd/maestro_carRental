import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleDocument, {IVehicleDocument} from "./vehicleDocument";
import type {FilterQuery} from "mongoose";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";

export class VehicleDocumentService extends BaseCrudService<IVehicleDocument, typeof VehicleDocument> {
    constructor() {
        super(VehicleDocument, "VehicleDocument");
    }

    /** A batch of records with their car's plate and status, for the fleet reminders. */
    findWithVehicle(filter: FilterQuery<IVehicleDocument>, limit: number) {
        return this.model.find(filter).populate<{vehicle: IVehicle | null}>("vehicle", "plate status").limit(limit).exec();
    }
}

export const vehicleDocumentService = new VehicleDocumentService();
