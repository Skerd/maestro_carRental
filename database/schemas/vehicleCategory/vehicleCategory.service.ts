import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleCategory, {IVehicleCategory} from "./vehicleCategory";
import type {FilterQuery, SortOrder} from "mongoose";
import type {ObjectId} from "mongodb";

export class VehicleCategoryService extends BaseCrudService<IVehicleCategory, typeof VehicleCategory> {
    constructor() {
        super(VehicleCategory, "VehicleCategory");
    }

    /** One page of category cards for the portal. */
    findPortalCards(filter: FilterQuery<IVehicleCategory>, sort: Record<string, SortOrder>, skip: number, limit: number) {
        return this.model.find(filter)
            .select("company name slug seats transmission images dailyRate")
            .sort(sort)
            .skip(skip).limit(limit)
            .lean<{_id: ObjectId; company: ObjectId; name: string; slug: string; seats: number; transmission: "manual" | "automatic"; images?: ObjectId[]; dailyRate: number}[]>();
    }
}

export const vehicleCategoryService = new VehicleCategoryService();
