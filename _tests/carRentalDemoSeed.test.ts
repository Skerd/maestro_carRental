import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {MongoMemoryReplSet} from "mongodb-memory-server";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";

vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({sendRentalCustomerMail: vi.fn(async () => undefined)}));

import Currency from "@coreModule/database/schemas/currency/currency";
import Media from "@coreModule/database/schemas/media/media";
import type {ICompany} from "@coreModule/database/schemas/company/company";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import PaymentTransaction from "@financeModule/database/schemas/paymentTransaction/paymentTransaction";
import {seedCarRentalDemoData} from "@carRentalModule/database/demo/carRentalCompanyDemo";

let replSet: MongoMemoryReplSet;
const company = {_id: new ObjectId(), name: "Demo Rent", createdBy: new ObjectId()} as unknown as ICompany;
const MODELS = [Currency, Media, CarRentalConfig, RentalLocation, VehicleCategory, Vehicle, RentalExtra, VehicleBlock, RentalReservation,
    VehicleInsurance, VehicleDocument, VehicleMaintenance, VehicleDamage, PaymentTransaction];
const counts = async () => Object.fromEntries(await Promise.all(MODELS.map(async (model) => [model.modelName, await model.collection.countDocuments()])));

beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({replSet: {count: 1, storageEngine: "wiredTiger"}});
    await mongoose.connect(replSet.getUri());
    await Promise.all(MODELS.map((model) => model.init()));
    // Offline: photos become placeholders and the clips are skipped.
    vi.stubGlobal("fetch", vi.fn(async () => {
        throw new Error("offline");
    }));
    await Currency.create({name: "Euro", symbol: "€", abbreviation: "EUR", decimalPlaces: 2, company: company._id});
}, 120000);

afterAll(async () => {
    vi.unstubAllGlobals();
    await mongoose.disconnect();
    await replSet.stop();
});

describe("car rental demo seed", () => {
    it("seeds a full fleet with bookings in every status and each car's paperwork", async () => {
        await seedCarRentalDemoData(undefined, company);

        expect(await Vehicle.countDocuments({company: company._id})).toBe(80);
        expect(await RentalLocation.countDocuments({})).toBe(6);
        expect(await VehicleCategory.countDocuments({})).toBe(10);
        const reservations = await RentalReservation.find({}).select("status vehicle pickupAt blockedUntil");
        expect(reservations.length).toBeGreaterThanOrEqual(140);
        expect(new Set(reservations.map((reservation) => reservation.status))).toEqual(
            new Set(["completed", "in_progress", "cancelled", "no_show", "expired", "held", "confirmed"]),
        );
        expect(await Vehicle.countDocuments({status: "maintenance"})).toBe(3);
        expect(await Vehicle.countDocuments({status: "retired"})).toBe(2);
        expect(await VehicleBlock.countDocuments({})).toBe(3);

        expect(await VehicleInsurance.countDocuments({})).toBeGreaterThan(80);
        expect(await VehicleDocument.countDocuments({type: "registration"})).toBe(80);
        expect(await VehicleDamage.countDocuments({reservation: {$exists: true}})).toBe(
            await RentalReservation.countDocuments({"returnInfo.damageNoted": true}),
        );
        expect(await Vehicle.countDocuments({nextServiceDueAt: {$exists: true}})).toBe(80);
        expect(await PaymentTransaction.countDocuments({sourceType: "rentalReservation"})).toBeGreaterThan(50);

        // Every car carries its photos (placeholders when offline).
        const car = await Vehicle.findOne({plate: "AA101DM"});
        expect(car!.images.length).toBe(3);
        expect(car!.odometerKm).toBeGreaterThan(0);
    }, 300000);

    it("changes nothing when it runs again", async () => {
        const before = await counts();
        await seedCarRentalDemoData(undefined, company);
        expect(await counts()).toEqual(before);
    }, 300000);
});
