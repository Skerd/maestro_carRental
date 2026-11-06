import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalLocation, {IRentalLocation} from "./rentalLocation";
import type {FilterQuery} from "mongoose";
import type {ObjectId} from "mongodb";

export class RentalLocationService extends BaseCrudService<IRentalLocation, typeof RentalLocation> {
    constructor() {
        super(RentalLocation, "RentalLocation");
    }

    /** The timezone of the first matching location by name (the company's default for reports and planners). */
    findFirstTimezone(filter: FilterQuery<IRentalLocation>) {
        return this.model.findOne(filter).sort({name: 1}).select("timezone");
    }

    /** The company's pickup-and-return locations with their city, for the portal. */
    findPortalLocations(companyId: ObjectId) {
        return this.model.find({company: companyId, isActive: true, pickupAllowed: true, returnAllowed: true, deletedAt: null})
            .select("name address.city")
            .populate({path: "address.city", select: "name"})
            .sort({name: 1})
            .lean<{_id: ObjectId; name: string; address?: {city?: {name?: string}}}[]>();
    }
}

export const rentalLocationService = new RentalLocationService();
