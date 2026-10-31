import {describe, expect, it} from "vitest";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {suggestReturnCharges} from "@carRentalModule/utilities/services/rentalReturnCharges";

const returnAt = new Date("2027-06-11T08:00:00Z");
const reservation = (overrides: {mileagePolicy?: string; fuelLevel?: string} = {}) => ({
    returnAt,
    pricing: {rentalDays: 2},
    snapshot: {mileagePolicy: overrides.mileagePolicy ?? "limited", includedKmPerDay: 200, extraKmPrice: 0.3},
    handover: {odometerKm: 10000, fuelLevel: overrides.fuelLevel ?? "full"},
}) as unknown as IRentalReservation;
const settings = {fuelPricePerQuarter: 20, refuelServiceFee: 15, lateFeePerHour: 10, lateGraceMinutes: 59, cleaningFee: 50, smokingFee: 150};

describe("suggestReturnCharges", () => {
    it("charges km beyond the daily allowance, missing fuel and the refuel service", () => {
        const {suggested} = suggestReturnCharges(reservation(), {odometerKm: 10500, fuelLevel: "half", returnedAt: returnAt}, settings, 50, "en-US");
        expect(suggested).toEqual([
            {code: "extra_km", label: "Extra km (100 km)", amount: 30},
            {code: "fuel", label: "Fuel (2/4 tank missing)", amount: 40},
            {code: "refuel_service", label: "Refuelling service", amount: 15},
        ]);
    });

    it("charges nothing for unlimited mileage, a full tank and a return inside the grace period", () => {
        const onTime = new Date(returnAt.getTime() + 59 * 60000);
        const {suggested, presets} = suggestReturnCharges(reservation({mileagePolicy: "unlimited"}), {odometerKm: 15000, fuelLevel: "full", returnedAt: onTime}, settings, 50, "en-US");
        expect(suggested).toEqual([]);
        expect(presets.map((preset) => preset.code)).toEqual(["cleaning", "smoking"]);
    });

    it("charges each started late hour after the grace period, at most one day rate per started day", () => {
        const twoHoursLate = new Date(returnAt.getTime() + 121 * 60000);
        expect(suggestReturnCharges(reservation(), {odometerKm: 10000, fuelLevel: "full", returnedAt: twoHoursLate}, settings, 50, "en-US").suggested)
            .toEqual([{code: "late_return", label: "Late return (2 h)", amount: 20}]);
        const tenHoursLate = new Date(returnAt.getTime() + (59 + 600) * 60000);
        expect(suggestReturnCharges(reservation(), {odometerKm: 10000, fuelLevel: "full", returnedAt: tenHoursLate}, settings, 50, "en-US").suggested[0].amount).toBe(50);
    });

    it("never charges for more fuel than at pickup", () => {
        const {suggested} = suggestReturnCharges(reservation({fuelLevel: "half"}), {odometerKm: 10000, fuelLevel: "full", returnedAt: returnAt}, settings, 50, "en-US");
        expect(suggested).toEqual([]);
    });
});
