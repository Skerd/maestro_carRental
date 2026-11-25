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
import {getLogger} from "@coreModule/loggers/serverLog";
import {asCrossTenant, withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {generateRecordAccessToken} from "@coreModule/utilities/security/recordAccessToken";
import type {ReportableDefinition} from "@coreModule/domain/reports/reportables";
import {RENTAL_RESERVATION_LINK_PURPOSE} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import * as rentalReviewRoute from "@carRentalModule/api/carRental/private/rentalReview";
import * as storefrontRoute from "@carRentalModule/api/carRental/public/rentalStorefront";
import {publicCategories} from "@carRentalModule/api/carRental/public/rentalStorefront";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";
import {loadBookableCategory} from "@carRentalModule/workflows/rentalReservationService";
import {carRentalReportables} from "@carRentalModule/domain/reports/carRentalReportables";
import {setReportableHidden} from "@coreModule/domain/reports/reportDesk";

/* A review is the customer's own words, written from their booking's manage link and shown at once (D191): staff never
 * write, change or delete one, so the portal's stars stay the customers'. Only the platform hides one, after a report. */

const companyId = new ObjectId();
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(companyId, fn);
const app = appFor([rentalReviewRoute, storefrontRoute].map((route) => ({...route, module: "carRental"})));
const logger = getLogger("rental_reviews_test");
const platformAdmin = new ObjectId();

let staff: TestCaller;

function reportable(kind: string): ReportableDefinition {
    const found = carRentalReportables.find((definition) => definition.kind === kind);
    if (!found) throw new Error(`No reportable ${kind}`);
    return found;
}

/** What the platform's report desk does (D191): reads the record across companies, then core hides it in its company. */
async function platformHides(kind: string, recordId: ObjectId) {
    const snapshot = await asCrossTenant("the report desk reads a reported record", () =>
        reportable(kind).snapshot({recordId, logger, languageCode: "en-US"}));
    await setReportableHidden({...reportable(kind), module: "carRental"}, companyId, {recordId, logger, languageCode: "en-US", hidden: true, decidedBy: platformAdmin});
    return snapshot;
}

/** A returned car's booking of a class, and the manage link the customer got by email. */
async function completedBooking(category: ObjectId, customer?: ObjectId): Promise<{id: ObjectId; token: string}> {
    const {insertedId} = await RentalReservation.collection.insertOne({
        company: companyId, category, status: "completed", manageTokenVersion: 0, number: `R-${new ObjectId().toString()}`,
        idempotencyKey: new ObjectId().toString(), contact: {firstName: "Ada", lastName: "Lovelace", email: "ada@example.com"},
        ...(customer ? {customer} : {}), deletedAt: null,
    });
    const token = generateRecordAccessToken({purpose: RENTAL_RESERVATION_LINK_PURPOSE, companyId, recordId: insertedId, version: 0});
    return {id: insertedId, token};
}

const customerReview = (token: string, body: Record<string, unknown>) =>
    request(app).post("/api/carRental/rentalStorefront/manage/review").set(callerHeader(staff)).send({token, ...body});

/** The class's reviews as the rental site shows them. */
const siteReviews = (category: ObjectId) =>
    request(app).post("/api/carRental/rentalStorefront/reviews").set(callerHeader(staff)).send({category: category.toString()});

const compactClass = () => VehicleCategory.create({
    company: companyId, name: "Compact", slug: "compact", seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 50, mileagePolicy: "unlimited",
});

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all([RentalReservation.init(), RentalReview.init(), VehicleCategory.init()]);
    // Every grant the model offers: a company admin's view of reviews.
    staff = {userId: new ObjectId().toString(), companyId: companyId.toString(), isAdmin: true, permissions: allPermissionTags([RentalReservation, RentalReview])};
    originCompany.current = {_id: companyId, name: "Rent Co"};
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(async () => {
    await Promise.all([RentalReservation, RentalReview, VehicleCategory, CarRentalConfig].map((model) => model.collection.deleteMany({})));
    await CarRentalConfig.collection.insertOne({company: companyId, publicBookingEnabled: true, deletedAt: null});
}));

describe("rental reviews come only from the customer", {timeout: 60000}, () => {
    it("offers staff no grant to write, publish, hide or delete a review", () => {
        const tags = allPermissionTags([RentalReview]);
        expect(tags.filter((tag) => /\[(create|write):(reservation|rating|comment|authorName|hiddenByPlatform|rentalreviews)\]/.test(tag))).toEqual([]);
        expect(tags.filter((tag) => /\[(delete|restore)\b|publish/.test(tag))).toEqual([]);
    });

    it("refuses a review staff try to write, and shows the customer's own at once", () => asCompany(async () => {
        const category = await compactClass();
        const {id, token} = await completedBooking(category._id);

        const byStaff = await request(app).put("/api/carRental/rentalReview").set(callerHeader(staff))
            .send({reservation: id.toString(), rating: 5, comment: "Best rental ever", authorName: "Happy customer"});
        expect([byStaff.status, byStaff.body.error_code]).toEqual([403, "rental_review_written_by_customer_only"]);
        expect(await RentalReview.countDocuments({})).toBe(0);

        const byCustomer = await customerReview(token, {rating: 4, comment: "Clean car."});
        expect([byCustomer.status, byCustomer.body.error_code]).toEqual([200, undefined]);
        const review = await RentalReview.findOne({reservation: id});
        expect(review).toMatchObject({rating: 4, comment: "Clean car.", authorName: "Ada L.", hiddenByPlatform: false});

        const shown = await siteReviews(category._id);
        expect([shown.status, shown.body.data?.count]).toEqual([200, 1]);
        expect(shown.body.data.reviews).toEqual([expect.objectContaining({_id: review!._id.toString(), rating: 4, comment: "Clean car."})]);
    }));

    it("lets staff neither change, publish nor delete a review", () => asCompany(async () => {
        const category = await compactClass();
        const {id, token} = await completedBooking(category._id);
        const other = await completedBooking(category._id);
        await customerReview(token, {rating: 2, comment: "The car was late."});
        const review = (await RentalReview.findOne({reservation: id}))!;

        const edited = await request(app).patch("/api/carRental/rentalReview").set(callerHeader(staff))
            .send({_id: review._id.toString(), reservation: other.id.toString(), rating: 5, comment: "Perfect.", authorName: "Someone else", hiddenByPlatform: true});
        // Nothing of a review is staff's to write, so the edit is refused as a whole.
        expect([edited.status, edited.body.error_code]).toEqual([403, "user_permissions_not_sufficient"]);
        expect(await RentalReview.findById(review._id)).toMatchObject({reservation: id, rating: 2, comment: "The car was late.", authorName: "Ada L.", hiddenByPlatform: false});

        const deleted = await request(app).delete("/api/carRental/rentalReview").set(callerHeader(staff)).send({_id: review._id.toString()});
        expect([deleted.status, deleted.body.error_code]).toEqual([403, "user_permissions_not_sufficient"]);
        expect((await RentalReview.findById(review._id))!.deletedAt).toBeFalsy();

        const published = await request(app).post("/api/carRental/rentalReview/unpublish").set(callerHeader(staff)).send({_id: review._id.toString()});
        expect(published.status).toBe(404);
    }));
});

describe("the platform hides reported car rental content (D191)", {timeout: 60000}, () => {
    it("takes a hidden review off the rental site and out of every rating", () => asCompany(async () => {
        const category = await compactClass();
        const account = new ObjectId();
        const kept = await completedBooking(category._id);
        const reported = await completedBooking(category._id, account);
        await customerReview(kept.token, {rating: 5, comment: "Great."});
        await customerReview(reported.token, {rating: 1, comment: "Spam spam spam."});
        const review = (await RentalReview.findOne({reservation: reported.id}))!;

        const snapshot = await platformHides("carRental.review", review._id);
        expect(snapshot).toMatchObject({title: "★ Spam spam spam.", companyId, authorAccountId: account, hidden: false});

        const shown = await siteReviews(category._id);
        expect([shown.body.data.count, shown.body.data.average]).toEqual([1, 5]);
        expect(shown.body.data.reviews.map((row: {comment: string}) => row.comment)).toEqual(["Great."]);
        const ratings = await asCrossTenant("test reads the portal's ratings", () => rentalReviewService.publishedRatingsByCategory([companyId]));
        expect(ratings.get(category._id.toString())).toEqual({average: 5, count: 1});

        const after = await asCrossTenant("the report desk reads it again", () =>
            reportable("carRental.review").snapshot({recordId: review._id, logger, languageCode: "en-US"}));
        expect(after?.hidden).toBe(true);
    }));

    it("takes a hidden car class off the rental site and out of online booking", () => asCompany(async () => {
        const category = await compactClass();
        expect((await publicCategories(companyId)).map((row) => row.name)).toEqual(["Compact"]);

        const snapshot = await platformHides("carRental.carClass", category._id);
        expect(snapshot).toMatchObject({title: "Compact", companyId, hidden: false});

        expect(await publicCategories(companyId)).toEqual([]);
        await expect(loadBookableCategory(companyId, category._id.toString(), {languageCode: "en-US", online: true}))
            .rejects.toMatchObject({error_code: "vehicle_category_not_found"});
        // Staff still book it at the counter, and still see it in the panel.
        expect((await loadBookableCategory(companyId, category._id.toString(), {languageCode: "en-US", online: false})).hiddenByPlatform).toBe(true);
    }));

    it("answers nothing for a record that is gone", async () => {
        expect(await asCrossTenant("the report desk reads a reported record", () =>
            reportable("carRental.carClass").snapshot({recordId: new ObjectId(), logger, languageCode: "en-US"}))).toBeNull();
    });
});
