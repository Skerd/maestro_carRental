import type {Decimal128} from "mongodb";
import {DEFAULT_DECIMAL_PLACES, minorToNumber, multiplyMinor, percentOfMinor, sumMinor, toMinor, type MoneyInput} from "armonia/src/modules/core/helpers/money";
import {decimal128FromMinor} from "@coreModule/utilities/helpers/money";
import {invoiceTotals} from "@financeModule/database/schemas/invoice/invoice.service";
import type {IRentalPriceLine, IRentalPricing} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import type {
    RentalPriceLineCode,
    RentalPriceLineKind,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
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

export type QuoteExtra = {
    name: string;
    pricing: RentalExtraPricing;
    price: number;
    quantity: number;
};

export type QuoteSettings = {
    vatRate: number;
    pricesIncludeVat: boolean;
    lateGraceMinutes: number;
    /** The currency's `decimalPlaces`, where every amount is rounded once (default 2, TD-B30). */
    decimalPlaces?: number;
};

export type QuoteLine = {
    label: string;
    kind: RentalPriceLineKind;
    code?: RentalPriceLineCode;
    quantity: number;
    unitPrice: number;
    total: number;
};

/** A fee on top of the rental: once, or for every rental day. */
export type QuoteFee = {
    label: string;
    code: RentalPriceLineCode;
    amount: number;
    perDay: boolean;
};

/** A reduction of the rental days only, never of extras or fees. `code` defaults to the promo line. */
export type QuoteDiscount = {
    label: string;
    type: "percent" | "fixed";
    value: number;
    code?: RentalPriceLineCode;
};

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
export function rentalDaysBetween(
    pickupAt: Date,
    returnAt: Date,
    lateGraceMinutes: number,
): number {
    const minutes = (returnAt.getTime() - pickupAt.getTime()) / MINUTE;
    return Math.max(1, Math.ceil((minutes - lateGraceMinutes) / (24 * 60)));
}

/** The daily rate for the rental day that starts at `dayStart`, in the pickup location's timezone. */
function dailyRateFor(
    category: QuoteCategory,
    dayStart: Date,
    timeZone: string,
): number {
    const localDate = localDateOf(dayStart, timeZone);
    const season = category.rateSeasons.find(
        (s) => s.startDate <= localDate && localDate <= s.endDate,
    );
    if (season) return season.dailyRate;
    const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
    if (
        category.weekendDailyRate !== undefined &&
        (weekday === 0 || weekday === 6)
    )
        return category.weekendDailyRate;
    return category.dailyRate;
}

/** `amount × quantity` at the currency's `decimals`, rounded once (D35). */
function lineTotal(amount: MoneyInput, quantity: number, decimals: number): number {
    return minorToNumber(multiplyMinor(toMinor(amount, decimals), quantity), decimals);
}

/** Groups consecutive-or-not day rates into one line per distinct rate, in first-seen order. */
function rateLines(label: string, rates: number[], decimals: number): QuoteLine[] {
    const counts = new Map<number, number>();
    for (const rate of rates) counts.set(rate, (counts.get(rate) ?? 0) + 1);
    return [...counts].map(([unitPrice, quantity]) => ({
        label,
        kind: "rental",
        quantity,
        unitPrice,
        total: lineTotal(unitPrice, quantity, decimals),
    }));
}

/**
 * The price of a rental, line by line. Pure: the same inputs always give the same
 * quote, so the booking re-computes it on the server and compares it with what the
 * customer was shown.
 *
 * Day rates come from a matching season, else the weekend rate on Sat/Sun, else the
 * daily rate. A discount reduces the rental days only; fees come after it. When the category has a weekly rate and the rental is a week or more,
 * whole weeks are charged at the weekly rate if that is cheaper.
 */
export function computeRentalQuote(input: {
    category: QuoteCategory;
    extras: QuoteExtra[];
    pickupAt: Date;
    returnAt: Date;
    timeZone: string;
    settings: QuoteSettings;
    fees?: QuoteFee[];
    discount?: QuoteDiscount;
    /** Replaces the category deposit, e.g. when a protection package lowers it. */
    depositAmount?: number;
}): RentalQuoteResult {
    const {category, extras, pickupAt, returnAt, timeZone, settings} = input;
    const decimals = settings.decimalPlaces ?? DEFAULT_DECIMAL_PLACES;
    const rentalDays = rentalDaysBetween(
        pickupAt,
        returnAt,
        settings.lateGraceMinutes,
    );

    const dayRates = Array.from({length: rentalDays}, (_, day) =>
        dailyRateFor(
            category,
            new Date(pickupAt.getTime() + day * DAY),
            timeZone,
        ),
    );
    let lines = rateLines(category.name, dayRates, decimals);

    if (category.weeklyRate !== undefined && rentalDays >= 7) {
        const weeks = Math.floor(rentalDays / 7);
        const remainder = dayRates.slice(weeks * 7);
        const weekly = multiplyMinor(toMinor(category.weeklyRate, decimals), weeks);
        const weeklyTotal = weekly + sumMinor(remainder.map((rate) => toMinor(rate, decimals)));
        const dailyTotal = sumMinor(dayRates.map((rate) => toMinor(rate, decimals)));
        if (weeklyTotal < dailyTotal) {
            lines = [
                {
                    label: category.name,
                    kind: "rental",
                    quantity: weeks,
                    unitPrice: category.weeklyRate,
                    total: minorToNumber(weekly, decimals),
                },
                ...rateLines(category.name, remainder, decimals),
            ];
        }
    }

    for (const extra of extras) {
        const quantity =
            extra.pricing === "per_day"
                ? extra.quantity * rentalDays
                : extra.quantity;
        lines.push({
            label: extra.name,
            kind: "extra",
            quantity,
            unitPrice: extra.price,
            total: lineTotal(extra.price, quantity, decimals),
        });
    }
    const discount = input.discount
        ? discountLine(input.discount, lines, decimals)
        : null;
    if (discount) lines.push(discount);
    lines.push(...feeLines(input.fees ?? [], rentalDays, decimals));

    return {
        rentalDays,
        lines,
        ...totalsFor(lines, settings.vatRate, settings.pricesIncludeVat, decimals),
        vatRate: settings.vatRate,
        pricesIncludeVat: settings.pricesIncludeVat,
        depositAmount: input.depositAmount ?? category.depositAmount ?? 0,
    };
}

/** Fee lines for a rental of `rentalDays`; fees of zero are left out. */
export function feeLines(fees: QuoteFee[], rentalDays: number, decimals: number = DEFAULT_DECIMAL_PLACES): QuoteLine[] {
    return fees
        .filter((fee) => fee.amount > 0)
        .map((fee) => {
            const quantity = fee.perDay ? rentalDays : 1;
            return {
                label: fee.label,
                kind: "fee",
                code: fee.code,
                quantity,
                unitPrice: fee.amount,
                total: lineTotal(fee.amount, quantity, decimals),
            };
        });
}

/** The negative line for a discount on the rental-day lines, never more than they still cost. */
function discountLine(
    discount: QuoteDiscount,
    lines: QuoteLine[],
    decimals: number,
): QuoteLine | null {
    const rental = sumMinor(lines.filter((line) => line.kind === "rental").map((line) => toMinor(line.total, decimals)));
    const already = sumMinor(lines.filter((line) => line.kind === "discount").map((line) => toMinor(Math.abs(line.total), decimals)));
    const base = rental > already ? rental - already : 0n;
    const wanted = discount.type === "percent" ? percentOfMinor(base, discount.value) : toMinor(discount.value, decimals);
    const amount = minorToNumber(wanted < base ? wanted : base, decimals);
    if (amount <= 0) return null;
    return {
        label: discount.label,
        kind: "discount",
        code: discount.code ?? "promo",
        quantity: 1,
        unitPrice: -amount,
        total: -amount,
    };
}

/** Adds one discount line and recomputes the totals. A discount that changes nothing is left out. */
export function applyDiscount(
    result: RentalQuoteResult,
    discount: QuoteDiscount,
    decimals: number = DEFAULT_DECIMAL_PLACES,
): RentalQuoteResult {
    const line = discountLine(discount, result.lines, decimals);
    if (!line) return result;
    const lines = [...result.lines, line];
    return {
        ...result,
        lines,
        ...totalsFor(lines, result.vatRate, result.pricesIncludeVat, decimals),
    };
}

/**
 * Subtotal, VAT and total of a set of lines. Line prices include VAT when
 * `pricesIncludeVat`, otherwise VAT is added on top. Used for the quote and
 * again whenever a charge is added to a booking later.
 */
export function totalsFor(
    lines: {total: MoneyInput}[],
    vatRate: number,
    pricesIncludeVat: boolean,
    decimals: number = DEFAULT_DECIMAL_PLACES,
): {subtotal: number; vatAmount: number; grandTotal: number} {
    // The invoice's rule (D35), so a booking's total and its invoice can never differ.
    const {subtotal, vatAmount, total} = invoiceTotals(lines, vatRate, pricesIncludeVat, decimals);
    return {subtotal, vatAmount, grandTotal: total};
}

/** An amount as the reservation stores it: Decimal128 at the currency's `decimals` (GLB-08). */
function stored(amount: MoneyInput, decimals: number): Decimal128 {
    return decimal128FromMinor(toMinor(amount, decimals), decimals);
}

/** A price line as the reservation stores it. */
export function storedPriceLine(line: QuoteLine, decimals: number): IRentalPriceLine {
    return {...line, unitPrice: stored(line.unitPrice, decimals), total: stored(line.total, decimals)};
}

/** A booking's totals from its stored lines, as the reservation stores them. */
export function storedTotalsFor(
    lines: {total: MoneyInput}[],
    vatRate: number,
    pricesIncludeVat: boolean,
    decimals: number,
): Pick<IRentalPricing, "subtotal" | "vatAmount" | "grandTotal"> {
    const totals = totalsFor(lines, vatRate, pricesIncludeVat, decimals);
    return {
        subtotal: stored(totals.subtotal, decimals),
        vatAmount: stored(totals.vatAmount, decimals),
        grandTotal: stored(totals.grandTotal, decimals),
    };
}

/** A quote as the reservation's `pricing`, in `currency`. */
export function storedPricing(quote: RentalQuoteResult, currency: IRentalPricing["currency"], decimals: number): IRentalPricing {
    return {
        rentalDays: quote.rentalDays,
        currency,
        lines: quote.lines.map((line) => storedPriceLine(line, decimals)),
        subtotal: stored(quote.subtotal, decimals),
        vatRate: quote.vatRate,
        vatAmount: stored(quote.vatAmount, decimals),
        pricesIncludeVat: quote.pricesIncludeVat,
        grandTotal: stored(quote.grandTotal, decimals),
        depositAmount: stored(quote.depositAmount, decimals),
    };
}
