import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import type {IRentalDriver, IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import type {RentalPriceLineCode} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import {feeLines, totalsFor, type QuoteFee} from "./rentalQuote";
import {paymentStatusFor} from "./rentalPayments";
import {rentalPricingLabel} from "./rentalPricingLabels";

type DriverFeeSettings = Pick<ICarRentalConfig, "youngDriverUnderAge" | "youngDriverDailyFee" | "additionalDriverDailyFee">;
const DRIVER_FEE_CODES: RentalPriceLineCode[] = ["young_driver", "additional_driver"];

/** Whole years from one local date (`YYYY-MM-DD`) to another: an age on a given day. */
export function yearsBetween(from: string, to: string): number {
    const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
    const [toYear, toMonth, toDay] = to.split("-").map(Number);
    const beforeAnniversary = toMonth < fromMonth || (toMonth === fromMonth && toDay < fromDay);
    return toYear - fromYear - (beforeAnniversary ? 1 : 0);
}

const fullName = (driver: Pick<IRentalDriver, "firstName" | "lastName">) => `${driver.firstName} ${driver.lastName}`;

/**
 * Checks a driver list as it is saved: exactly one primary driver, and everyone
 * old enough on the pickup day. Licence details may still be missing.
 */
export function assertDriverList(
    drivers: Pick<IRentalDriver, "role" | "firstName" | "lastName" | "birthDate">[],
    rules: {pickupDate: string; minDriverAge?: number},
    languageCode: string,
): void {
    if (drivers.filter((driver) => driver.role === "primary").length !== 1) {
        throw apiValidationException("rental_driver_primary_required", "", null, languageCode);
    }
    for (const driver of drivers) {
        if (driver.birthDate > rules.pickupDate) {
            throw apiValidationException("rental_driver_birth_date_invalid", "", null, languageCode, [fullName(driver)]);
        }
        if (rules.minDriverAge && yearsBetween(driver.birthDate, rules.pickupDate) < rules.minDriverAge) {
            throw apiValidationException("rental_driver_too_young", "", null, languageCode, [fullName(driver), String(rules.minDriverAge)]);
        }
    }
}

/**
 * What must hold before the car leaves: the list rules, plus a licence number for
 * every driver and a licence that is still valid on the return day.
 */
export function assertDriversReadyForHandover(reservation: IRentalReservation, minDriverAge: number | undefined, languageCode: string): void {
    const {timezone} = reservation.snapshot;
    assertDriverList(reservation.drivers ?? [], {pickupDate: localDateOf(reservation.pickupAt, timezone), minDriverAge}, languageCode);
    const returnDate = localDateOf(reservation.returnAt, timezone);
    for (const driver of reservation.drivers) {
        if (!driver.licenseNumber) {
            throw apiValidationException("rental_driver_license_missing", "", null, languageCode, [fullName(driver)]);
        }
        if (driver.licenseExpiresAt && driver.licenseExpiresAt < returnDate) {
            throw apiValidationException("rental_driver_license_expired", "", null, languageCode, [fullName(driver)]);
        }
    }
}

/** Per-day fees for drivers under the young-driver age and for each additional driver. */
export function driverFees(
    drivers: Pick<IRentalDriver, "role" | "firstName" | "lastName" | "birthDate">[],
    settings: DriverFeeSettings,
    pickupDate: string,
    languageCode: string,
): QuoteFee[] {
    const fees: QuoteFee[] = [];
    for (const driver of drivers) {
        const name = fullName(driver);
        if (settings.youngDriverUnderAge && settings.youngDriverDailyFee && yearsBetween(driver.birthDate, pickupDate) < settings.youngDriverUnderAge) {
            fees.push({label: rentalPricingLabel(languageCode, "youngDriver", {name}), code: "young_driver", amount: settings.youngDriverDailyFee, perDay: true});
        }
        if (driver.role === "additional" && settings.additionalDriverDailyFee) {
            fees.push({label: rentalPricingLabel(languageCode, "additionalDriver", {name}), code: "additional_driver", amount: settings.additionalDriverDailyFee, perDay: true});
        }
    }
    return fees;
}

/** Re-prices the driver fees after the drivers or the rental days changed. */
export function applyDriverFees(reservation: IRentalReservation, settings: DriverFeeSettings, languageCode: string): void {
    const pickupDate = localDateOf(reservation.pickupAt, reservation.snapshot.timezone);
    const fees = feeLines(driverFees(reservation.drivers, settings, pickupDate, languageCode), reservation.pricing.rentalDays);
    reservation.pricing.lines = [...reservation.pricing.lines.filter((line) => !line.code || !DRIVER_FEE_CODES.includes(line.code)), ...fees];
    Object.assign(reservation.pricing, totalsFor(reservation.pricing.lines, reservation.pricing.vatRate, reservation.pricing.pricesIncludeVat));
    reservation.paymentStatus = paymentStatusFor(reservation, false);
}
