import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import request from "supertest";

vi.mock("@coreModule/utilities/middlewares/authMW", async () =>
    (await import("@coreModule/_tests/httpHarness")).authMWStub);
vi.mock("@coreModule/utilities/middlewares/rateLimiter", () => ({
    rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const {deletedFiles} = vi.hoisted(() => ({deletedFiles: [] as string[]}));
vi.mock("@coreModule/utilities/gridfs/gridfsStorage", () => ({
    getGridFSStorage: () => ({deleteFile: async (id: string) => void deletedFiles.push(id)}),
}));

import {appFor, callerHeader, type TestCaller} from "@coreModule/_tests/httpHarness";
import * as privacyRoute from "@coreModule/api/company/private/privacy";
import {loadPersonErasers} from "@coreModule/utilities/erasure/personErasure";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import Media from "@coreModule/database/schemas/media/media";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import RentalDenyEntry from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";

const company = new ObjectId();
const EMAIL = "ada@example.com";
const app = appFor([{...privacyRoute, module: "core"}]);
const admin: TestCaller = {userId: new ObjectId().toString(), companyId: company.toString(), isAdmin: true, modules: ["core", "carRental"]};
const ids = {reservation: new ObjectId(), review: new ObjectId(), fine: new ObjectId(), scan: new ObjectId(), signature: new ObjectId(), deny: new ObjectId()};
const files = {scan: new ObjectId(), signature: new ObjectId()};
const raw = <T>(fn: () => Promise<T>) => asCrossTenant("test reads raw collections", fn);

beforeAll(async () => {
    await connectTestDatabase();
    // Every module's eraser (and so its models) first, then every index: a collection or index created while the
    // erasure's transaction is open aborts it.
    await loadPersonErasers();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    await raw(async () => {
        await Media.collection.insertMany([
            {_id: ids.scan, company, fileId: files.scan, type: "image", deletedAt: null},
            {_id: ids.signature, company, fileId: files.signature, type: "image", deletedAt: null},
        ]);
        await RentalReservation.collection.insertOne({
            _id: ids.reservation, company, number: "RR-1", deletedAt: null, notes: "late flight",
            contact: {firstName: "Ada", lastName: "Lovelace", email: EMAIL, phone: "+41 1"},
            drivers: [{role: "primary", firstName: "Ada", lastName: "Lovelace", birthDate: "1990-12-10", licenseNumber: "CH-123456", documents: [ids.scan]}],
            agreement: {signedAt: new Date(), signerName: "Ada Lovelace", signature: ids.signature},
            deposit: {method: "card", status: "held", amount: 500, stripeCustomerId: "cus_1", paymentMethodId: "pm_1"},
            pricing: {grandTotal: 300}, amountPaid: 300,
        });
        await RentalReview.collection.insertOne({_id: ids.review, company, reservation: ids.reservation, authorName: "Ada L.", rating: 5, deletedAt: null});
        await VehicleFine.collection.insertOne({_id: ids.fine, company, reservation: ids.reservation, driverName: "Ada Lovelace", amount: 80, deletedAt: null});
        await RentalDenyEntry.collection.insertOne({_id: ids.deny, company, email: EMAIL, reason: "Unpaid damage", isActive: true, deletedAt: null});
    });
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

describe("person erasure in car rental (D57)", {timeout: 60000}, () => {
    it("anonymises the reservation, deletes licences, scans and signature, and stops the saved card", async () => {
        const erased = await request(app).post("/api/privacy/erasePerson").set(callerHeader(admin)).send({email: EMAIL, preview: false});
        expect(erased.body.error_code ?? "ok").toBe("ok");
        expect(erased.body.counts).toEqual(expect.arrayContaining([
            {collection: "rentalreservations", anonymised: 1, deleted: 0},
            {collection: "media", anonymised: 0, deleted: 2},
        ]));

        const reservation = (await raw(() => RentalReservation.collection.findOne({_id: ids.reservation})))!;
        expect(reservation.contact).toEqual({firstName: "Erased", lastName: "person", email: "erased@erased.invalid", phone: "-"});
        expect(reservation.drivers).toBeUndefined();
        expect(reservation.notes).toBeUndefined();
        expect(reservation.agreement).toMatchObject({signerName: "Erased person"});
        expect(reservation.agreement.signature).toBeUndefined();
        expect(reservation.deposit).toEqual({method: "card", status: "held", amount: 500});
        expect(reservation).toMatchObject({number: "RR-1", amountPaid: 300, pricing: {grandTotal: 300}});

        expect((await raw(() => RentalReview.collection.findOne({_id: ids.review})))).toMatchObject({authorName: "Erased person", rating: 5});
        expect((await raw(() => VehicleFine.collection.findOne({_id: ids.fine})))!.driverName).toBeUndefined();
        expect(await raw(() => Media.collection.countDocuments({}))).toBe(0);
        expect(deletedFiles.sort()).toEqual([files.scan.toString(), files.signature.toString()].sort());
        // The deny list protects the company and stays.
        expect(await raw(() => RentalDenyEntry.collection.findOne({_id: ids.deny}))).toMatchObject({email: EMAIL});
    });
});
