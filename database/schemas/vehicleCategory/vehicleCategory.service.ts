import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleCategory, {IVehicleCategory} from "./vehicleCategory";
import type {ClientSession, FilterQuery, SortOrder} from "mongoose";
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

    /** A live class as the platform's report desk reads it (D191): by its id alone, whichever company owns it. */
    findReportable(id: ObjectId, session?: ClientSession) {
        return this.model.findOne({_id: id, deletedAt: null})
            .select("company name slug hiddenByPlatform")
            .session(session ?? null)
            .lean<{_id: ObjectId; company: ObjectId; name: string; slug?: string; hiddenByPlatform?: boolean}>();
    }
}

export const vehicleCategoryService = new VehicleCategoryService();
