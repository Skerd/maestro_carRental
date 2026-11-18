import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {ObjectId} from "mongodb";

vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({
    sendRentalCustomerMail: vi.fn(async () => undefined),
}));

import Currency from "@coreModule/database/schemas/currency/currency";
import Media from "@coreModule/database/schemas/media/media";
import type {ICompany} from "@coreModule/database/schemas/company/company";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import RentalPromoCode from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import VehicleTransfer from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import RentalDenyEntry from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import RentalSubscription from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import PaymentTransaction from "@financeModule/database/schemas/paymentTransaction/paymentTransaction";
import {seedCarRentalDemoData} from "@carRentalModule/database/demo/carRentalCompanyDemo";
import {withTenant} from "@coreModule/utilities/endpoints/tenantScope";

/** The whole 80-car demo takes about 80 s alone; a busy machine has stretched it past 300 s (TD-T17). */
const DEMO_SEED_TIMEOUT_MS = 600_000;

const company = {
    _id: new ObjectId(),
    name: "Demo Rent",
    createdBy: new ObjectId(),
} as unknown as ICompany;
/** The seed fills this company's data, as its setup does (D16); the checks read it as the company. */
const asCompany = <T>(fn: () => PromiseLike<T>): Promise<T> => withTenant(company._id, fn);
const MODELS = [
    Currency,
    Media,
    CarRentalConfig,
    RentalLocation,
    VehicleCategory,
    Vehicle,
    RentalExtra,
    RentalPromoCode,
    VehicleBlock,
    VehicleFine,
    VehicleTransfer,
    RentalBusinessAccount,
    RentalDenyEntry,
    RentalReview,
    RentalSubscription,
    RentalReservation,
    VehicleInsurance,
    VehicleDocument,
    VehicleMaintenance,
    VehicleDamage,
    PaymentTransaction,
];
const counts = async () =>
    Object.fromEntries(
        await Promise.all(
            MODELS.map(async (model) => [
                model.modelName,
                await model.collection.countDocuments(),
            ]),
        ),
    );

beforeAll(async () => {
    await connectTestDatabase();
    await Promise.all(MODELS.map((model) => model.init()));
    // Offline: photos become placeholders and the clips are skipped.
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
            throw new Error("offline");
        }),
    );
    await asCompany(() => Currency.create({
        name: "Euro",
        symbol: "€",
        abbreviation: "EUR",
        decimalPlaces: 2,
        company: company._id,
    }));
}, 120000);

afterAll(async () => {
    vi.unstubAllGlobals();
    await disconnectTestDatabase();
});

describe("car rental demo seed", () => {
    it("seeds a full fleet with bookings in every status and each car's paperwork", () => asCompany(async () => {
        await seedCarRentalDemoData(undefined, company);

        expect(await Vehicle.countDocuments({company: company._id})).toBe(80);
        expect(await RentalLocation.countDocuments({})).toBe(6);
        expect(await VehicleCategory.countDocuments({})).toBe(10);
        const reservations = await RentalReservation.find({}).select(
            "status vehicle pickupAt blockedUntil",
        );
        expect(reservations.length).toBeGreaterThanOrEqual(140);
        expect(
            new Set(reservations.map((reservation) => reservation.status)),
        ).toEqual(
            new Set([
                "completed",
                "in_progress",
                "cancelled",
                "no_show",
                "expired",
                "held",
                "confirmed",
            ]),
        );
        expect(await Vehicle.countDocuments({status: "maintenance"})).toBe(3);
        expect(await Vehicle.countDocuments({status: "retired"})).toBe(2);
        // Three of the fleet plan's, plus the transfers on the road and done (a called-off one has none).
        expect(await VehicleBlock.countDocuments({})).toBe(7);
        expect(await RentalExtra.countDocuments({kind: "protection"})).toBe(2);
        expect(await RentalPromoCode.countDocuments({})).toBe(3);
        // One in each state (P9.7); the paid driver_identified one can still be recharged.
        expect(
            await VehicleFine.countDocuments({status: "driver_identified"}),
        ).toBe(2);
        for (const status of ["transferred", "disputed", "received", "charged", "paid_by_company", "cancelled"]) {
            expect(await VehicleFine.countDocuments({status})).toBe(1);
        }
        expect(
            await VehicleFine.countDocuments({paidAt: {$exists: true}}),
        ).toBe(2);
        // The recharged fine added its line to the booking, as the action does.
        const charged = await VehicleFine.findOne({status: "charged"});
        expect(charged!.chargedAmount).toBe(35);
        expect(
            await RentalReservation.countDocuments({_id: charged!.reservation, "pricing.lines.code": "fine"}),
        ).toBe(1);
        expect(await VehicleTransfer.countDocuments({status: "planned"})).toBe(
            2,
        );
        for (const status of ["in_transit", "done", "cancelled"]) {
            expect(await VehicleTransfer.countDocuments({status})).toBe(1);
        }
        // The counter has work today: pickups, and cars due back today or late.
        expect(await RentalReservation.countDocuments({idempotencyKey: /^demo-counter-/, status: "confirmed"})).toBe(3);
        expect(await RentalReservation.countDocuments({idempotencyKey: /^demo-counter-/, status: "in_progress"})).toBe(3);
        expect(await RentalBusinessAccount.countDocuments({})).toBe(2);
        expect(await RentalDenyEntry.countDocuments({})).toBe(2);
        expect(await RentalReview.countDocuments({})).toBe(2);
        expect(await RentalSubscription.countDocuments({})).toBe(2);
        expect(await Vehicle.countDocuments({trackerId: {$exists: true}})).toBe(
            4,
        );
        const inProgress = await RentalReservation.countDocuments({
            status: "in_progress",
        });
        expect(inProgress).toBeGreaterThan(0);
        expect(
            await RentalReservation.countDocuments({
                status: "in_progress",
                "deposit.method": "cash",
                "deposit.status": "held",
            }),
        ).toBe(inProgress);
        const config = await CarRentalConfig.findOne({});
        expect(config!.youngDriverDailyFee).toBe(8);
        expect(config!.fineAdminFee).toBe(15);
        expect(await RentalLocation.countDocuments({oneWayFee: {$gt: 0}})).toBe(
            2,
        );
        expect(
            (await VehicleCategory.findOne({slug: "mini"}))!.crossBorderAllowed,
        ).toBe(false);
        expect(
            (await VehicleCategory.findOne({slug: "suv-4x4"}))!.crossBorderFee,
        ).toBe(15);

        expect(await VehicleInsurance.countDocuments({})).toBeGreaterThan(80);
        expect(
            await VehicleDocument.countDocuments({type: "registration"}),
        ).toBe(80);
        expect(
            await VehicleDamage.countDocuments({reservation: {$exists: true}}),
        ).toBe(
            await RentalReservation.countDocuments({
                "returnInfo.damageNoted": true,
            }),
        );
        expect(
            await Vehicle.countDocuments({nextServiceDueAt: {$exists: true}}),
        ).toBe(80);
        expect(
            await PaymentTransaction.countDocuments({
                sourceType: "rentalReservation",
            }),
        ).toBeGreaterThan(50);

        // Every car carries its photos (placeholders when offline).
        const car = await Vehicle.findOne({plate: "AA101DM"});
        expect(car!.images.length).toBe(3);
        expect(car!.odometerKm).toBeGreaterThan(0);
    }), DEMO_SEED_TIMEOUT_MS);

    it("changes nothing when it runs again", () => asCompany(async () => {
        const before = await counts();
        await seedCarRentalDemoData(undefined, company);
        expect(await counts()).toEqual(before);
    }), DEMO_SEED_TIMEOUT_MS);
});
