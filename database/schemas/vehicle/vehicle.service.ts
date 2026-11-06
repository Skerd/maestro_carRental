import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import Vehicle, {IVehicle} from "./vehicle";
import type {FilterQuery} from "mongoose";
import type {IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";

export class VehicleService extends BaseCrudService<IVehicle, typeof Vehicle> {
    constructor() {
        super(Vehicle, "Vehicle");
    }

    /** A batch of cars with what the service reminder needs. */
    findServiceDue(filter: FilterQuery<IVehicle>, limit: number) {
        return this.model.find(filter).select("company plate nextServiceDueAt nextServiceDueKm odometerKm").limit(limit).exec();
    }

    /** The planner's cars, with their category's name and order. */
    findForPlanner(filter: FilterQuery<IVehicle>) {
        return this.model.find(filter)
            .populate<{category: IVehicleCategory}>({path: "category", select: "name sortOrder"})
            .select("plate make model category readiness homeLocation currentLocation")
            .sort({plate: 1});
    }
}

export const vehicleService = new VehicleService();
