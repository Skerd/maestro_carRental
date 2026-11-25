import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

import {ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
// No Redis in tests; the public routes' limiter fails closed without it.
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const {originCompany} = vi.hoisted(() => ({originCompany: {current: null as {_id: {toString(): string}; name?: string} | null}}));
vi.mock("@coreModule/utilities/marketing/resolveCompanyByOrigin", async () => {
    // Records the tenant like the real resolver (D16).
    const {setRequestTenant} = await import("@coreModule/utilities/endpoints/tenantScope");
    return {
        resolveCompanyByOrigin: async () => {
            if (originCompany.current) setRequestTenant(originCompany.current._id.toString());
            return originCompany.current;
        },
    };
});

import {allPermissionTags, appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {generateRecordAccessToken} from "@coreModule/utilities/security/recordAccessToken";
import {RENTAL_RESERVATION_LINK_PURPOSE} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import * as rentalReviewRoute from "@carRentalModule/api/carRental/private/rentalReview";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";

/* A review is the customer's own words, written from their booking's manage link: staff publish or hide it, but never
 * write one or change what it says, so the portal's stars stay the customers'. */

const companyId = new ObjectId();
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const app = appFor([rentalReviewRoute, storefrontRoute].map((route) => ({...route, module: "carRental"})));

let staff: TestCaller;

/** A returned car's booking, and the manage link the customer got by email. */
async function completedBooking(): Promise<{id: ObjectId; token: string}> {
    const {insertedId} = await RentalReservation.collection.insertOne({
        company: companyId, status: "completed", manageTokenVersion: 0, number: `R-${new ObjectId().toString()}`,
        idempotencyKey: new ObjectId().toString(), contact: {firstName: "Ada", lastName: "Lovelace", email: "ada@example.com"}, deletedAt: null,
    });
    const token = generateRecordAccessToken({purpose: RENTAL_RESERVATION_LINK_PURPOSE, companyId, recordId: insertedId, version: 0});
    return {id: insertedId, token};
}

const customerReview = (token: string, body: Record<string, unknown>) =>
    request(app).post("/api/carRental/rentalStorefront/manage/review").set(callerHeader(staff)).send({token, ...body});

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all([RentalReservation.init(), RentalReview.init()]);
    // Every grant the model offers: a company admin's view of reviews.
    staff = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true, permissions: allPermissionTags([RentalReservation, RentalReview])};
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await Promise.all([RentalReservation, RentalReview].map((model) => model.collection.deleteMany({})));
}));

describe("rental reviews come only from the customer", {timeout: 60000}, () => {
    it("offers staff no grant to create a review or write its words", () => {
        const tags = allPermissionTags([RentalReview]);
        expect(tags.filter((tag) => /\[(create|write):(reservation|rating|comment|authorName|rentalreviews)\]/.test(tag))).toEqual([]);
        // Publishing stays theirs.
        expect(tags).toContain("rentalreviews[write:isPublished]");
    });

    it("refuses a review staff try to write, and keeps the customer's own", () => asCompany(async () => {
        const {id, token} = await completedBooking();

        const byStaff = await request(app).put("/api/carRental/rentalReview").set(callerHeader(staff))
            .send({reservation: id.toString(), rating: 5, comment: "Best rental ever", authorName: "Happy customer"});
        expect([byStaff.status, byStaff.body.error_code]).toEqual([403, "rental_review_written_by_customer_only"]);
        expect(await RentalReview.countDocuments({})).toBe(0);

        const byCustomer = await customerReview(token, {rating: 4, comment: "Clean car."});
        expect([byCustomer.status, byCustomer.body.error_code]).toEqual([200, undefined]);
        expect(await RentalReview.findOne({reservation: id})).toMatchObject({rating: 4, comment: "Clean car.", authorName: "Ada L.", isPublished: false});
    }));

    it("lets staff publish a review but not change what it says", () => asCompany(async () => {
        const {id, token} = await completedBooking();
        const other = await completedBooking();
        await customerReview(token, {rating: 2, comment: "The car was late."});
        const review = (await RentalReview.findOne({reservation: id}))!;

        const edited = await request(app).patch("/api/carRental/rentalReview").set(callerHeader(staff))
            .send({_id: review._id.toString(), reservation: other.id.toString(), rating: 5, comment: "Perfect.", authorName: "Someone else"});
        expect(edited.body.error_code).toBeUndefined();
        expect(await RentalReview.findById(review._id)).toMatchObject({reservation: id, rating: 2, comment: "The car was late.", authorName: "Ada L."});

        const published = await request(app).post("/api/carRental/rentalReview/publish").set(callerHeader(staff)).send({_id: review._id.toString()});
        expect([published.status, published.body.error_code]).toEqual([200, undefined]);
        expect((await RentalReview.findById(review._id))!.isPublished).toBe(true);
    }));
});
