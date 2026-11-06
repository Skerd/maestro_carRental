import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleInsurance, {IVehicleInsurance} from "./vehicleInsurance";
import type {ClientSession, FilterQuery} from "mongoose";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";

export class VehicleInsuranceService extends BaseCrudService<IVehicleInsurance, typeof VehicleInsurance> {
    constructor() {
        super(VehicleInsurance, "VehicleInsurance");
    }

    /** A batch of records with their car's plate and status, for the fleet reminders. */
    findWithVehicle(filter: FilterQuery<IVehicleInsurance>, limit: number) {
        return this.model.find(filter).populate<{vehicle: IVehicle | null}>("vehicle", "plate status").limit(limit).exec();
    }

    /** The id of the matching policy with the lowest coverage order. */
    findFirstByCoverage(filter: FilterQuery<IVehicleInsurance>, session?: ClientSession) {
        return this.model.findOne(filter).sort({coverage: 1}).select("_id").session(session ?? null);
    }
}

export const vehicleInsuranceService = new VehicleInsuranceService();
