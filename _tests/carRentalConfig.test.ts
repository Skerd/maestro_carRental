import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

import {ObjectId} from "mongodb";
import Currency from "@coreModule/database/schemas/currency/currency";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";

const withCurrency = new ObjectId();
const withoutCurrency = new ObjectId();
const acrossCompanies = <T>(fn: () => PromiseLike<T>): Promise<T> => asCrossTenant("test fixtures span companies", fn);

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all([CarRentalConfig, VehicleCategory].map((model) => model.init()));
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => acrossCompanies(async () => {
    await Promise.all([CarRentalConfig, Currency, VehicleCategory].map((model) => model.collection.deleteMany({})));
}));

describe("the rental settings' currency (P9.1)", () => {
    it("starts with the company's own currency and never borrows another company's", () => acrossCompanies(async () => {
        const euro = await Currency.create({name: "Euro", symbol: "€", abbreviation: "EUR", decimalPlaces: 2, company: withCurrency});

        const config = await carRentalConfigService.getOrCreateForCompany(withCurrency, {languageCode: "en-US"});
        expect(String(config.currency)).toBe(euro._id.toString());

        await expect(carRentalConfigService.getOrCreateForCompany(withoutCurrency, {languageCode: "en-US"}))
            .rejects.toMatchObject({error_code: "rental_currency_not_configured"});
    }));
});

describe("a car class's web address (P9.4)", () => {
    const compact = (company: ObjectId, slug?: string) => VehicleCategory.create({
        company, name: "Compact SUV", ...(slug ? {slug} : {}), seats: 5, transmission: "manual", fuelType: "petrol", dailyRate: 50, mileagePolicy: "unlimited",
    });

    it("is made from the name when left empty, unique within the company only", () => acrossCompanies(async () => {
        expect((await compact(withCurrency)).slug).toBe("compact-suv");
        expect((await compact(withCurrency)).slug).toBe("compact-suv-2");
        expect((await compact(withoutCurrency)).slug).toBe("compact-suv");
        expect((await compact(withCurrency, "city-suv")).slug).toBe("city-suv");
    }));
});
