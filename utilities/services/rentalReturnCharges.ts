import {roundMoney} from "@coreModule/utilities/helpers/money";
import {RENTAL_FUEL_LEVELS, type RentalPriceLineCode} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalPricingLabel} from "./rentalPricingLabels";

const MINUTE = 60 * 1000;

export type ReturnCharge = {code: RentalPriceLineCode; label: string; amount: number};

type ChargeSettings = Pick<ICarRentalConfig, "fuelPricePerQuarter" | "refuelServiceFee" | "lateFeePerHour" | "lateGraceMinutes" | "cleaningFee" | "smokingFee">;

/**
 * What the return costs on top of the booking, worked out from the readings:
 * - km beyond the included km per day, for limited-mileage bookings;
 * - each quarter tank below the pickup level, plus the refuelling service fee;
 * - every started hour late beyond the grace period, at most one day rate per started day.
 * `presets` are the fees staff add by hand (cleaning, smoking). Staff can drop or change any of them.
 */
export function suggestReturnCharges(
    reservation: IRentalReservation,
    reading: {odometerKm: number; fuelLevel: (typeof RENTAL_FUEL_LEVELS)[number]; returnedAt: Date},
    settings: ChargeSettings,
    dailyRate: number | undefined,
    languageCode: string,
): {suggested: ReturnCharge[]; presets: ReturnCharge[]} {
    const suggested: ReturnCharge[] = [];
    const {snapshot, handover, pricing} = reservation;

    if (handover && snapshot.mileagePolicy === "limited" && snapshot.includedKmPerDay && snapshot.extraKmPrice) {
        const over = reading.odometerKm - handover.odometerKm - snapshot.includedKmPerDay * pricing.rentalDays;
        if (over > 0) {
            suggested.push({code: "extra_km", label: rentalPricingLabel(languageCode, "extraKm", {km: String(over)}), amount: roundMoney(over * snapshot.extraKmPrice)});
        }
    }

    const quarters = handover ? RENTAL_FUEL_LEVELS.indexOf(handover.fuelLevel) - RENTAL_FUEL_LEVELS.indexOf(reading.fuelLevel) : 0;
    if (quarters > 0 && settings.fuelPricePerQuarter) {
        suggested.push({code: "fuel", label: rentalPricingLabel(languageCode, "fuel", {quarters: String(quarters)}), amount: roundMoney(quarters * settings.fuelPricePerQuarter)});
        if (settings.refuelServiceFee) {
            suggested.push({code: "refuel_service", label: rentalPricingLabel(languageCode, "refuelService"), amount: settings.refuelServiceFee});
        }
    }

    const lateMinutes = (reading.returnedAt.getTime() - reservation.returnAt.getTime()) / MINUTE - settings.lateGraceMinutes;
    if (lateMinutes > 0 && settings.lateFeePerHour) {
        const hours = Math.ceil(lateMinutes / 60);
        const cap = dailyRate ? Math.ceil(hours / 24) * dailyRate : Infinity;
        suggested.push({code: "late_return", label: rentalPricingLabel(languageCode, "lateReturn", {hours: String(hours)}), amount: roundMoney(Math.min(hours * settings.lateFeePerHour, cap))});
    }

    const presets: ReturnCharge[] = [];
    if (settings.cleaningFee) presets.push({code: "cleaning", label: rentalPricingLabel(languageCode, "cleaning"), amount: settings.cleaningFee});
    if (settings.smokingFee) presets.push({code: "smoking", label: rentalPricingLabel(languageCode, "smoking"), amount: settings.smokingFee});
    return {suggested, presets};
}
