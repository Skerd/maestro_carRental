import type {ObjectId} from "mongodb";
import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalReview, {IRentalReview} from "./rentalReview";

export class RentalReviewService extends BaseCrudService<IRentalReview, typeof RentalReview> {
    constructor() {
        super(RentalReview, "RentalReview");
    }

    /**
     * The companies' published reviews per car class, for the portal's cards (D178): the average out of 5 and how many.
     * A review belongs to a reservation, which names the class.
     */
    async publishedRatingsByCategory(companyIds: ObjectId[]): Promise<Map<string, {average: number; count: number}>> {
        if (companyIds.length === 0) return new Map();
        const rows: {_id: ObjectId; average: number; count: number}[] = await this.aggregate([
            {$match: {company: {$in: companyIds}, isPublished: true, deletedAt: null}},
            {$lookup: {
                from: RentalReservation.collection.name,
                let: {reservation: "$reservation"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$reservation"]}, deletedAt: null}},
                    {$project: {category: 1}},
                ],
                as: "booked",
            }},
            {$unwind: "$booked"},
            {$group: {_id: "$booked.category", average: {$avg: "$rating"}, count: {$sum: 1}}},
        ]);
        return new Map(rows.map((row) => [String(row._id), {average: row.average, count: row.count}]));
    }

    /** One car class's published reviews (D178): the average, how many, and the latest `limit`, newest first. */
    async publishedForCategory(companyId: ObjectId, categoryId: ObjectId, limit: number): Promise<{
        average: number;
        count: number;
        reviews: {rating: number; comment?: string; authorName?: string; createdAt: Date}[];
    }> {
        const [row]: {stats: {average: number; count: number}[]; latest: {rating: number; comment?: string; authorName?: string; createdAt: Date}[]}[] = await this.aggregate([
            {$match: {company: companyId, isPublished: true, deletedAt: null}},
            {$lookup: {
                from: RentalReservation.collection.name,
                let: {reservation: "$reservation"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$reservation"]}, category: categoryId, deletedAt: null}},
                    {$project: {_id: 1}},
                ],
                as: "booked",
            }},
            {$match: {"booked.0": {$exists: true}}},
            {$sort: {createdAt: -1}},
            {$facet: {
                stats: [{$group: {_id: null, average: {$avg: "$rating"}, count: {$sum: 1}}}],
                latest: [{$limit: limit}, {$project: {_id: 0, rating: 1, comment: 1, authorName: 1, createdAt: 1}}],
            }},
        ]);
        const stats = row?.stats[0];
        return {average: stats ? Math.round(stats.average * 10) / 10 : 0, count: stats?.count ?? 0, reviews: row?.latest ?? []};
    }
}

export const rentalReviewService = new RentalReviewService();
