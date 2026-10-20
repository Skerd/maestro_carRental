import {describe, expect, it} from "vitest";
import {computeRentalQuote, rentalDaysBetween, type QuoteCategory} from "@carRentalModule/utilities/services/rentalQuote";
import {isLocationOpenAt} from "@carRentalModule/utilities/services/rentalTrip";

const at = (iso: string) => new Date(iso);
const category: QuoteCategory = {name: "Compact", dailyRate: 50, rateSeasons: [], depositAmount: 300};
const settings = {vatRate: 0, pricesIncludeVat: true, lateGraceMinutes: 59};

describe("rentalDaysBetween", () => {
    it("counts started 24-hour blocks after the grace period", () => {
        expect(rentalDaysBetween(at("2026-06-01T10:00:00Z"), at("2026-06-02T10:00:00Z"), 59)).toBe(1);
        expect(rentalDaysBetween(at("2026-06-01T10:00:00Z"), at("2026-06-02T10:59:00Z"), 59)).toBe(1);
        expect(rentalDaysBetween(at("2026-06-01T10:00:00Z"), at("2026-06-02T11:00:00Z"), 59)).toBe(2);
        expect(rentalDaysBetween(at("2026-06-01T10:00:00Z"), at("2026-06-01T12:00:00Z"), 0)).toBe(1);
    });

    it("counts real elapsed time across a DST change (no phantom day)", () => {
        // Zurich springs forward on 29 Mar 2026: 10:00 local Sat → 10:00 local Sun is 23 real hours
        expect(rentalDaysBetween(at("2026-03-28T09:00:00Z"), at("2026-03-29T08:00:00Z"), 0)).toBe(1);
    });
});

describe("computeRentalQuote", () => {
    const base = {category, extras: [], timeZone: "Europe/Zurich", settings};

    it("charges the daily rate per day and keeps the deposit separate", () => {
        const quote = computeRentalQuote({...base, pickupAt: at("2026-06-03T08:00:00Z"), returnAt: at("2026-06-06T08:00:00Z")});
        expect(quote.rentalDays).toBe(3);
        expect(quote.lines).toEqual([{label: "Compact", kind: "rental", quantity: 3, unitPrice: 50, total: 150}]);
        expect(quote.grandTotal).toBe(150);
        expect(quote.depositAmount).toBe(300);
    });

    it("uses the weekend rate on local Saturdays and Sundays, and a season over both", () => {
        const weekend = {...category, weekendDailyRate: 70, rateSeasons: [{startDate: "2026-06-08", endDate: "2026-06-08", dailyRate: 90}]};
        // Fri 5 Jun → Tue 9 Jun: Fri 50, Sat 70, Sun 70, Mon (season) 90
        const quote = computeRentalQuote({...base, category: weekend, pickupAt: at("2026-06-05T08:00:00Z"), returnAt: at("2026-06-09T08:00:00Z")});
        expect(quote.lines.map((line) => [line.unitPrice, line.quantity])).toEqual([[50, 1], [70, 2], [90, 1]]);
        expect(quote.grandTotal).toBe(280);
    });

    it("applies the weekly rate only when it is cheaper", () => {
        const weekly = {...category, weeklyRate: 300};
        const quote = computeRentalQuote({...base, category: weekly, pickupAt: at("2026-06-01T08:00:00Z"), returnAt: at("2026-06-10T08:00:00Z")});
        expect(quote.rentalDays).toBe(9);
        expect(quote.grandTotal).toBe(300 + 2 * 50);
        const expensive = computeRentalQuote({...base, category: {...category, weeklyRate: 500}, pickupAt: at("2026-06-01T08:00:00Z"), returnAt: at("2026-06-08T08:00:00Z")});
        expect(expensive.grandTotal).toBe(350);
    });

    it("prices extras per day or per rental", () => {
        const quote = computeRentalQuote({
            ...base,
            extras: [
                {name: "Child seat", pricing: "per_day", price: 8, quantity: 2},
                {name: "Extra driver", pricing: "per_rental", price: 25, quantity: 1},
            ],
            pickupAt: at("2026-06-03T08:00:00Z"),
            returnAt: at("2026-06-05T08:00:00Z"),
        });
        expect(quote.lines.slice(1)).toEqual([
            {label: "Child seat", kind: "extra", quantity: 4, unitPrice: 8, total: 32},
            {label: "Extra driver", kind: "extra", quantity: 1, unitPrice: 25, total: 25},
        ]);
        expect(quote.grandTotal).toBe(157);
    });

    it("extracts VAT from inclusive prices and adds it to exclusive ones", () => {
        const window = {pickupAt: at("2026-06-03T08:00:00Z"), returnAt: at("2026-06-05T08:00:00Z")};
        const inclusive = computeRentalQuote({...base, ...window, settings: {...settings, vatRate: 8.1}});
        expect(inclusive.grandTotal).toBe(100);
        expect(inclusive.vatAmount).toBe(7.49);
        const exclusive = computeRentalQuote({...base, ...window, settings: {...settings, vatRate: 8.1, pricesIncludeVat: false}});
        expect(exclusive.vatAmount).toBe(8.1);
        expect(exclusive.grandTotal).toBe(108.1);
    });
});

describe("isLocationOpenAt", () => {
    const location = {
        timezone: "Europe/Zurich",
        openingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({dayOfWeek, startTime: "08:00", endTime: "18:00"})),
        closures: [{date: "2026-06-03"}],
    };

    it("follows local opening hours", () => {
        expect(isLocationOpenAt(location, at("2026-06-02T06:00:00Z"))).toBe(true); // Tue 08:00 local
        expect(isLocationOpenAt(location, at("2026-06-02T05:59:00Z"))).toBe(false);
        expect(isLocationOpenAt(location, at("2026-06-06T10:00:00Z"))).toBe(false); // Saturday
    });

    it("is closed all day on a closure date", () => {
        expect(isLocationOpenAt(location, at("2026-06-03T10:00:00Z"))).toBe(false);
    });

    it("is open around the clock without opening hours", () => {
        expect(isLocationOpenAt({timezone: "UTC", openingHours: [], closures: []}, at("2026-06-06T03:00:00Z"))).toBe(true);
    });
});
