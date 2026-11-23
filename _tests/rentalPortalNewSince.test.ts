import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

vi.hoisted(() => {
    process.env.ENABLED_MODULES = "core,finance,carRental";
});

import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {clearPortalProviders, getPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalNewSinceContext} from "@coreModule/domain/portal/portalProvider.types";
import {registerRentalPortalProvider} from "@carRentalModule/domain/portal/rentalPortalProvider";

/* D178, P23.7: the car rental section answers "which car classes were added after a date". */

const rental = new ObjectId();
const since = new Date("2026-11-01T00:00:00Z");
const classes = {suv: new ObjectId(), compact: new ObjectId(), old: new ObjectId(), hidden: new ObjectId()};

function newSince(fields: Partial<PortalNewSinceContext> = {}) {
    const provider = getPortalProvider("carRental");
    if (!provider?.newSince) throw new Error("the car rental section must answer newSince");
    const ask = provider.newSince;
    return withTenant(rental, () => ask({kind: "vehicleCategory", scope: {companyId: rental}, companyIds: [rental], filters: {}, since, limit: 10, languageCode: "en-US", ...fields}));
}

beforeAll(async () => {
    await connectTestDatabase();
    registerRentalPortalProvider();
}, 120000);

afterAll(async () => {
    clearPortalProviders();
    await disconnectTestDatabase();
});

beforeEach(async () => {
    const db = mongoose.connection.db!;
    for (const collection of await db.collections()) await collection.deleteMany({});
    await db.collection("companies").insertOne({_id: rental, name: "Adria Wheels", siteSlug: "adria", isActive: true, modules: ["core", "finance", "carRental"], deletedAt: null});
    const category = (_id: ObjectId, name: string, createdAt: Date, extra: Record<string, unknown> = {}) => ({
        _id, company: rental, name, slug: name.toLowerCase(), seats: 5, transmission: "automatic", dailyRate: 40, isPublic: true, deletedAt: null, createdAt, ...extra,
    });
    await db.collection("vehiclecategories").insertMany([
        category(classes.suv, "SUV", new Date("2026-11-03T00:00:00Z"), {seats: 7}),
        category(classes.compact, "Compact", new Date("2026-11-02T00:00:00Z"), {transmission: "manual"}),
        category(classes.old, "Classic", new Date("2026-10-01T00:00:00Z")),
        category(classes.hidden, "Staff only", new Date("2026-11-04T00:00:00Z"), {isPublic: false}),
    ]);
});

describe("car classes new since a date (P23.7)", () => {
    it("lists the public classes added after the date, newest first, with the saved car filters", async () => {
        const all = await newSince();
        expect(all.total).toBe(2);
        expect(all.items.map((item) => item.title)).toEqual(["SUV", "Compact"]);
        expect(all.items[0]).toEqual(expect.objectContaining({kind: "vehicleCategory", id: classes.suv.toString(), section: "carRental", path: "/categories/suv"}));

        expect((await newSince({filters: {transmission: "manual"}})).items.map((item) => item.title)).toEqual(["Compact"]);
        expect((await newSince({query: "su"})).items.map((item) => item.title)).toEqual(["SUV"]);
    });

    it("ignores a saved trip's dates: a class is new whatever the days asked for", async () => {
        const withTrip = await newSince({filters: {pickupDate: "2026-12-01", pickupTime: "10:00", returnDate: "2026-12-03", returnTime: "10:00"}});
        expect(withTrip.items.map((item) => item.title)).toEqual(["SUV", "Compact"]);
    });

    it("shows the classes a person keeps as listed now, old ones included, but not hidden ones", async () => {
        const kept = await newSince({since: new Date(0), ids: [classes.old.toString(), classes.hidden.toString()]});
        expect(kept.items.map((item) => item.title)).toEqual(["Classic"]);
    });
});

describe("a car class's page (D181)", () => {
    it("finds the class its page names, by slug or id, with or without a trip, and nothing for a hidden class or another page", async () => {
        const provider = getPortalProvider("carRental");
        if (!provider?.itemAt) throw new Error("the car rental section must answer itemAt");
        const itemAt = provider.itemAt;
        const at = (path: string) => withTenant(rental, () => itemAt({scope: {companyId: rental}, companyId: rental, path, languageCode: "en-US"}));
        expect(provider.sitePath).toBe("car-rental");
        expect(await at("/categories/suv")).toMatchObject({schemaType: "Product", item: {title: "SUV", path: "/categories/suv"}});
        expect((await at(`/categories/${classes.compact.toString()}?pickupDate=2026-12-01`))?.item.title).toBe("Compact");
        expect(await at("/categories/staff%20only")).toBeUndefined();
        expect(await at("/search")).toBeUndefined();
    });
});
