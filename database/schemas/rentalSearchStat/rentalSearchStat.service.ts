import type {ObjectId} from "mongodb";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalSearchStat, {IRentalSearchStat} from "./rentalSearchStat";

export class RentalSearchStatService extends BaseCrudService<IRentalSearchStat, typeof RentalSearchStat> {
    constructor() {
        super(RentalSearchStat, "RentalSearchStat");
    }

    /** Counts a day's searches at one pickup branch in one round trip: one upserted counter per category. */
    recordSearches(at: {company: ObjectId; day: string; location: ObjectId}, rows: {category: ObjectId; available: boolean}[]) {
        return this.model.bulkWrite(rows.map((row) => ({
            updateOne: {
                filter: {company: at.company, day: at.day, category: row.category, location: at.location},
                update: {$inc: {searches: 1, unavailable: row.available ? 0 : 1}},
                upsert: true,
            },
        })));
    }
}

export const rentalSearchStatService = new RentalSearchStatService();
