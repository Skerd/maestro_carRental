import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";

/* D178: the portal's car cards average a class's published reviews, which belong to its reservations. A review is
 * published once written; one the platform hid after a report counts nowhere (D191). */

const company = new ObjectId();
const other = new ObjectId();
const compact = new ObjectId();
const suv = new ObjectId();
let order = 0;

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(async () => {
    await Promise.all([RentalReservation, RentalReview].map((model) => model.collection.deleteMany({})));
});

async function reviewed(category: ObjectId, rating: number, options: {hiddenByPlatform?: boolean; owner?: ObjectId; deletedReservation?: boolean} = {}) {
    const owner = options.owner ?? company;
    const reservation = await RentalReservation.collection.insertOne({company: owner, category, idempotencyKey: new ObjectId().toString(), number: new ObjectId().toString(), deletedAt: options.deletedReservation ? new Date() : null});
    await RentalReview.collection.insertOne({company: owner, reservation: reservation.insertedId, rating, hiddenByPlatform: options.hiddenByPlatform ?? false, createdAt: new Date(Date.now() + order++), deletedAt: null});
}

describe("publishedRatingsByCategory", {timeout: 60000}, () => {
    it("averages each class's published reviews of the given companies", async () => {
        await reviewed(compact, 5);
        await reviewed(compact, 4);
        await reviewed(suv, 3);
        await reviewed(suv, 1, {hiddenByPlatform: true});
        await reviewed(suv, 1, {deletedReservation: true});
        await reviewed(compact, 1, {owner: other});

        const ratings = await asCrossTenant("test reads several companies", () => rentalReviewService.publishedRatingsByCategory([company]));
        expect(ratings.get(compact.toString())).toEqual({average: 4.5, count: 2});
        expect(ratings.get(suv.toString())).toEqual({average: 3, count: 1});
    });

    it("answers nothing for no companies", async () => {
        expect((await rentalReviewService.publishedRatingsByCategory([])).size).toBe(0);
    });
    it("lists one class's published reviews, newest first, with their average", async () => {
        await reviewed(compact, 5);
        await reviewed(compact, 3);
        await reviewed(compact, 1, {hiddenByPlatform: true});
        await reviewed(suv, 4);

        const found = await asCrossTenant("test reads the company", () => rentalReviewService.publishedForCategory(company, compact, 1));
        expect([found.average, found.count, found.reviews.length]).toEqual([4, 2, 1]);
        expect(found.reviews[0].rating).toBe(3);
    });

    it("counts a review stored before D191, without the field, as shown", async () => {
        const reservation = await RentalReservation.collection.insertOne({company, category: compact, idempotencyKey: new ObjectId().toString(), number: new ObjectId().toString(), deletedAt: null});
        await RentalReview.collection.insertOne({company, reservation: reservation.insertedId, rating: 2, createdAt: new Date(), deletedAt: null});

        const ratings = await asCrossTenant("test reads the company", () => rentalReviewService.publishedRatingsByCategory([company]));
        expect(ratings.get(compact.toString())).toEqual({average: 2, count: 1});
    });
});
