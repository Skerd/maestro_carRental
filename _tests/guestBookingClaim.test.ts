import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";

// Only car rental claims here; core finds its `onAccountVerified` through the real bootstrap loader.
vi.mock("@coreModule/utilities/modules/enabledModules", async (importOriginal) => ({
    ...await importOriginal<typeof import("@coreModule/utilities/modules/enabledModules")>(),
    getEnabledModuleNames: () => ["core", "carRental"],
}));

import {getLogger} from "@coreModule/loggers/serverLog";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {claimGuestRecords} from "@coreModule/database/schemas/user/user.helper";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

/* P23.9: a guest's rental bookings become theirs once they hold an account with the booking's email, verified. */

const logger = getLogger("rental_guest_claim_test");
const rentals = {tirana: new ObjectId(), durres: new ObjectId()};
const account = new ObjectId();
const someoneElse = new ObjectId();
const EMAIL = "ada.guest@example.com";
const ids = {tirana: new ObjectId(), durres: new ObjectId(), otherEmail: new ObjectId(), taken: new ObjectId(), deleted: new ObjectId()};
const raw = <T>(fn: () => Promise<T>) => asCrossTenant("test reads raw collections", fn);

/** As the public booking flow stores a guest's booking: the contact's email lower-cased, no account. */
const booking = (_id: ObjectId, company: ObjectId, email: string, extra: Record<string, unknown> = {}) => ({
    _id, company, number: `RR-${_id.toString().slice(-6)}`, status: "confirmed", source: "online",
    contact: {firstName: "Ada", lastName: "Guest", email, phone: "+355 69 000 0000"},
    idempotencyKey: _id.toString(), deletedAt: null, ...extra,
});

/** The account as core hands it over; the address as typed at sign-up, in any case. */
const verifiedAccount = {_id: account, username: "Ada.Guest@Example.com", isEmailVerified: true};
const claim = (user: typeof verifiedAccount) =>
    runInTransaction(logger, (session) => claimGuestRecords(user, {session, logger, languageCode: "en-US"}));
const customers = async () => Object.fromEntries(
    (await raw(() => RentalReservation.collection.find({}).toArray())).map((row) => [String(row._id), row.customer ? String(row.customer) : null]),
);

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(async () => {
    await raw(async () => {
        await RentalReservation.collection.deleteMany({});
        await RentalReservation.collection.insertMany([
            booking(ids.tirana, rentals.tirana, EMAIL),
            booking(ids.durres, rentals.durres, EMAIL, {customer: null}),
            booking(ids.otherEmail, rentals.tirana, "ada.guest@example.org"),
            booking(ids.taken, rentals.durres, EMAIL, {customer: someoneElse}),
            booking(ids.deleted, rentals.tirana, EMAIL, {deletedAt: new Date()}),
        ]);
    });
});

describe("claiming guest rental bookings (P23.9)", {timeout: 30000}, () => {
    it("gives the account its guest bookings at every rental company, and nothing else", async () => {
        await claim(verifiedAccount);

        expect(await customers()).toEqual({
            [String(ids.tirana)]: String(account),
            [String(ids.durres)]: String(account),
            [String(ids.otherEmail)]: null,
            [String(ids.taken)]: String(someoneElse),
            [String(ids.deleted)]: null,
        });
    });

    it("claims nothing for an account whose email is not verified", async () => {
        const before = await customers();

        await claim({...verifiedAccount, isEmailVerified: false});

        expect(await customers()).toEqual(before);
    });

    it("changes nothing when it runs again", async () => {
        await claim(verifiedAccount);
        const once = await raw(() => RentalReservation.collection.find({}).sort({_id: 1}).toArray());

        await claim(verifiedAccount);

        expect(await raw(() => RentalReservation.collection.find({}).sort({_id: 1}).toArray())).toEqual(once);
    });

    it("still lets no edit move a claimed booking to another account", async () => {
        await claim(verifiedAccount);

        await raw(() => RentalReservation.updateOne({_id: ids.tirana}, {$set: {customer: someoneElse}}).exec());

        expect((await customers())[String(ids.tirana)]).toBe(String(account));
    });
});
