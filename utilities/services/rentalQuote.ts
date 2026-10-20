import {roundMoney} from "@coreModule/utilities/helpers/money";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import type {RentalPriceLineKind} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {RentalExtraPricing} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.schema-def";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export type QuoteCategory = {
    name: string;
    dailyRate: number;
    weekendDailyRate?: number;
    weeklyRate?: number;
    rateSeasons: {startDate: string; endDate: string; dailyRate: number}[];
    depositAmount?: number;
};

export type QuoteExtra = {name: string; pricing: RentalExtraPricing; price: number; quantity: number};

export type QuoteSettings = {
    vatRate: number;
    pricesIncludeVat: boolean;
    lateGraceMinutes: number;
};

export type QuoteLine = {label: string; kind: RentalPriceLineKind; quantity: number; unitPrice: number; total: number};

export type RentalQuoteResult = {
    rentalDays: number;
    lines: QuoteLine[];
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    pricesIncludeVat: boolean;
    grandTotal: number;
    depositAmount: number;
};

/**
 * Billable days: elapsed time in 24-hour blocks, rounded up after a grace period,
 * at least one. Counting elapsed time (not calendar days) means a DST change never
 * adds or removes a day.
 */
export function rentalDaysBetween(pickupAt: Date, returnAt: Date, lateGraceMinutes: number): number {
    const minutes = (returnAt.getTime() - pickupAt.getTime()) / MINUTE;
    return Math.max(1, Math.ceil((minutes - lateGraceMinutes) / (24 * 60)));
}

/** The daily rate for the rental day that starts at `dayStart`, in the pickup location's timezone. */
function dailyRateFor(category: QuoteCategory, dayStart: Date, timeZone: string): number {
    const localDate = localDateOf(dayStart, timeZone);
    const season = category.rateSeasons.find((s) => s.startDate <= localDate && localDate <= s.endDate);
    if (season) return season.dailyRate;
    const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
    if (category.weekendDailyRate !== undefined && (weekday === 0 || weekday === 6)) return category.weekendDailyRate;
    return category.dailyRate;
}

/** Groups consecutive-or-not day rates into one line per distinct rate, in first-seen order. */
function rateLines(label: string, rates: number[]): QuoteLine[] {
    const counts = new Map<number, number>();
    for (const rate of rates) counts.set(rate, (counts.get(rate) ?? 0) + 1);
    return [...counts].map(([unitPrice, quantity]) => ({label, kind: "rental", quantity, unitPrice, total: roundMoney(unitPrice * quantity)}));
}

/**
 * The price of a rental, line by line. Pure: the same inputs always give the same
 * quote, so the booking re-computes it on the server and compares it with what the
 * customer was shown.
 *
 * Day rates come from a matching season, else the weekend rate on Sat/Sun, else the
 * daily rate. When the category has a weekly rate and the rental is a week or more,
 * whole weeks are charged at the weekly rate if that is cheaper.
 */
export function computeRentalQuote(input: {
    category: QuoteCategory;
    extras: QuoteExtra[];
    pickupAt: Date;
    returnAt: Date;
    timeZone: string;
    settings: QuoteSettings;
}): RentalQuoteResult {
    const {category, extras, pickupAt, returnAt, timeZone, settings} = input;
    const rentalDays = rentalDaysBetween(pickupAt, returnAt, settings.lateGraceMinutes);

    const dayRates = Array.from({length: rentalDays}, (_, day) => dailyRateFor(category, new Date(pickupAt.getTime() + day * DAY), timeZone));
    let lines = rateLines(category.name, dayRates);

    if (category.weeklyRate !== undefined && rentalDays >= 7) {
        const weeks = Math.floor(rentalDays / 7);
        const remainder = dayRates.slice(weeks * 7);
        const weeklyTotal = roundMoney(weeks * category.weeklyRate + remainder.reduce((sum, rate) => sum + rate, 0));
        const dailyTotal = roundMoney(dayRates.reduce((sum, rate) => sum + rate, 0));
        if (weeklyTotal < dailyTotal) {
            lines = [
                {label: category.name, kind: "rental", quantity: weeks, unitPrice: category.weeklyRate, total: roundMoney(weeks * category.weeklyRate)},
                ...rateLines(category.name, remainder),
            ];
        }
    }

    for (const extra of extras) {
        const quantity = extra.pricing === "per_day" ? extra.quantity * rentalDays : extra.quantity;
        lines.push({label: extra.name, kind: "extra", quantity, unitPrice: extra.price, total: roundMoney(extra.price * quantity)});
    }

    return {
        rentalDays,
        lines,
        ...totalsFor(lines, settings.vatRate, settings.pricesIncludeVat),
        vatRate: settings.vatRate,
        pricesIncludeVat: settings.pricesIncludeVat,
        depositAmount: category.depositAmount ?? 0,
    };
}

/**
 * Subtotal, VAT and total of a set of lines. Line prices include VAT when
 * `pricesIncludeVat`, otherwise VAT is added on top. Used for the quote and
 * again whenever a charge is added to a booking later.
 */
export function totalsFor(lines: {total: number}[], vatRate: number, pricesIncludeVat: boolean): {subtotal: number; vatAmount: number; grandTotal: number} {
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
    const rate = vatRate / 100;
    const vatAmount = pricesIncludeVat ? roundMoney(subtotal - subtotal / (1 + rate)) : roundMoney(subtotal * rate);
    const grandTotal = pricesIncludeVat ? subtotal : roundMoney(subtotal + vatAmount);
    return {subtotal, vatAmount, grandTotal};
}
