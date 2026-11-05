import {describe, expect, it} from "vitest";
import {
    applyDiscount,
    computeRentalQuote,
    rentalDaysBetween,
    type QuoteCategory,
    type RentalQuoteResult,
} from "@carRentalModule/utilities/services/rentalQuote";
import {overlapHours} from "@carRentalModule/utilities/services/rentalReports";
import {isLocationOpenAt} from "@carRentalModule/utilities/services/rentalTrip";

const at = (iso: string) => new Date(iso);
const category: QuoteCategory = {
    name: "Compact",
    dailyRate: 50,
    rateSeasons: [],
    depositAmount: 300,
};
const settings = {vatRate: 0, pricesIncludeVat: true, lateGraceMinutes: 59};

describe("rentalDaysBetween", () => {
    it("counts started 24-hour blocks after the grace period", () => {
        expect(
            rentalDaysBetween(
                at("2026-06-01T10:00:00Z"),
                at("2026-06-02T10:00:00Z"),
                59,
            ),
        ).toBe(1);
        expect(
            rentalDaysBetween(
                at("2026-06-01T10:00:00Z"),
                at("2026-06-02T10:59:00Z"),
                59,
            ),
        ).toBe(1);
        expect(
            rentalDaysBetween(
                at("2026-06-01T10:00:00Z"),
                at("2026-06-02T11:00:00Z"),
                59,
            ),
        ).toBe(2);
        expect(
            rentalDaysBetween(
                at("2026-06-01T10:00:00Z"),
                at("2026-06-01T12:00:00Z"),
                0,
            ),
        ).toBe(1);
    });

    it("counts real elapsed time across a DST change (no phantom day)", () => {
        // Zurich springs forward on 29 Mar 2026: 10:00 local Sat → 10:00 local Sun is 23 real hours
        expect(
            rentalDaysBetween(
                at("2026-03-28T09:00:00Z"),
                at("2026-03-29T08:00:00Z"),
                0,
            ),
        ).toBe(1);
    });
});

describe("computeRentalQuote", () => {
    const base = {category, extras: [], timeZone: "Europe/Zurich", settings};

    it("charges the daily rate per day and keeps the deposit separate", () => {
        const quote = computeRentalQuote({
            ...base,
            pickupAt: at("2026-06-03T08:00:00Z"),
            returnAt: at("2026-06-06T08:00:00Z"),
        });
        expect(quote.rentalDays).toBe(3);
        expect(quote.lines).toEqual([
            {
                label: "Compact",
                kind: "rental",
                quantity: 3,
                unitPrice: 50,
                total: 150,
            },
        ]);
        expect(quote.grandTotal).toBe(150);
        expect(quote.depositAmount).toBe(300);
    });

    it("uses the weekend rate on local Saturdays and Sundays, and a season over both", () => {
        const weekend = {
            ...category,
            weekendDailyRate: 70,
            rateSeasons: [
                {startDate: "2026-06-08", endDate: "2026-06-08", dailyRate: 90},
            ],
        };
        // Fri 5 Jun → Tue 9 Jun: Fri 50, Sat 70, Sun 70, Mon (season) 90
        const quote = computeRentalQuote({
            ...base,
            category: weekend,
            pickupAt: at("2026-06-05T08:00:00Z"),
            returnAt: at("2026-06-09T08:00:00Z"),
        });
        expect(
            quote.lines.map((line) => [line.unitPrice, line.quantity]),
        ).toEqual([
            [50, 1],
            [70, 2],
            [90, 1],
        ]);
        expect(quote.grandTotal).toBe(280);
    });

    it("applies the weekly rate only when it is cheaper", () => {
        const weekly = {...category, weeklyRate: 300};
        const quote = computeRentalQuote({
            ...base,
            category: weekly,
            pickupAt: at("2026-06-01T08:00:00Z"),
            returnAt: at("2026-06-10T08:00:00Z"),
        });
        expect(quote.rentalDays).toBe(9);
        expect(quote.grandTotal).toBe(300 + 2 * 50);
        const expensive = computeRentalQuote({
            ...base,
            category: {...category, weeklyRate: 500},
            pickupAt: at("2026-06-01T08:00:00Z"),
            returnAt: at("2026-06-08T08:00:00Z"),
        });
        expect(expensive.grandTotal).toBe(350);
    });

    it("prices extras per day or per rental", () => {
        const quote = computeRentalQuote({
            ...base,
            extras: [
                {name: "Child seat", pricing: "per_day", price: 8, quantity: 2},
                {
                    name: "Extra driver",
                    pricing: "per_rental",
                    price: 25,
                    quantity: 1,
                },
            ],
            pickupAt: at("2026-06-03T08:00:00Z"),
            returnAt: at("2026-06-05T08:00:00Z"),
        });
        expect(quote.lines.slice(1)).toEqual([
            {
                label: "Child seat",
                kind: "extra",
                quantity: 4,
                unitPrice: 8,
                total: 32,
            },
            {
                label: "Extra driver",
                kind: "extra",
                quantity: 1,
                unitPrice: 25,
                total: 25,
            },
        ]);
        expect(quote.grandTotal).toBe(157);
    });

    it("extracts VAT from inclusive prices and adds it to exclusive ones", () => {
        const window = {
            pickupAt: at("2026-06-03T08:00:00Z"),
            returnAt: at("2026-06-05T08:00:00Z"),
        };
        const inclusive = computeRentalQuote({
            ...base,
            ...window,
            settings: {...settings, vatRate: 8.1},
        });
        expect(inclusive.grandTotal).toBe(100);
        expect(inclusive.vatAmount).toBe(7.49);
        const exclusive = computeRentalQuote({
            ...base,
            ...window,
            settings: {...settings, vatRate: 8.1, pricesIncludeVat: false},
        });
        expect(exclusive.vatAmount).toBe(8.1);
        expect(exclusive.grandTotal).toBe(108.1);
    });
});

describe("isLocationOpenAt", () => {
    const location = {
        timezone: "Europe/Zurich",
        openingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
            dayOfWeek,
            startTime: "08:00",
            endTime: "18:00",
        })),
        closures: [{date: "2026-06-03"}],
    };

    it("follows local opening hours", () => {
        expect(isLocationOpenAt(location, at("2026-06-02T06:00:00Z"))).toBe(
            true,
        ); // Tue 08:00 local
        expect(isLocationOpenAt(location, at("2026-06-02T05:59:00Z"))).toBe(
            false,
        );
        expect(isLocationOpenAt(location, at("2026-06-06T10:00:00Z"))).toBe(
            false,
        ); // Saturday
    });

    it("is closed all day on a closure date", () => {
        expect(isLocationOpenAt(location, at("2026-06-03T10:00:00Z"))).toBe(
            false,
        );
    });

    it("is open around the clock without opening hours", () => {
        expect(
            isLocationOpenAt(
                {timezone: "UTC", openingHours: [], closures: []},
                at("2026-06-06T03:00:00Z"),
            ),
        ).toBe(true);
    });
});

describe("fees and discounts", () => {
    const base = {
        category,
        extras: [],
        timeZone: "Europe/Zurich",
        settings,
        pickupAt: at("2026-06-03T08:00:00Z"),
        returnAt: at("2026-06-06T08:00:00Z"),
    };

    it("adds per-day and one-off fees after the rental days", () => {
        const quote = computeRentalQuote({
            ...base,
            fees: [
                {
                    label: "Young driver",
                    code: "young_driver",
                    amount: 10,
                    perDay: true,
                },
                {label: "One-way", code: "one_way", amount: 60, perDay: false},
                {
                    label: "Nothing",
                    code: "additional_driver",
                    amount: 0,
                    perDay: true,
                },
            ],
        });
        expect(quote.lines.slice(1)).toEqual([
            {
                label: "Young driver",
                kind: "fee",
                code: "young_driver",
                quantity: 3,
                unitPrice: 10,
                total: 30,
            },
            {
                label: "One-way",
                kind: "fee",
                code: "one_way",
                quantity: 1,
                unitPrice: 60,
                total: 60,
            },
        ]);
        expect(quote.grandTotal).toBe(240);
    });

    it("discounts the rental days only, never below zero", () => {
        const extras = [
            {name: "GPS", pricing: "per_day" as const, price: 5, quantity: 1},
        ];
        const percent = computeRentalQuote({
            ...base,
            extras,
            discount: {label: "Promo", type: "percent", value: 20},
        });
        expect(percent.lines).toContainEqual({
            label: "Promo",
            kind: "discount",
            code: "promo",
            quantity: 1,
            unitPrice: -30,
            total: -30,
        });
        expect(percent.grandTotal).toBe(135);
        const fixed = computeRentalQuote({
            ...base,
            discount: {label: "Promo", type: "fixed", value: 500},
        });
        expect(fixed.grandTotal).toBe(0);
    });

    it("lets a protection package replace the category deposit", () => {
        expect(
            computeRentalQuote({...base, depositAmount: 50}).depositAmount,
        ).toBe(50);
        expect(computeRentalQuote(base).depositAmount).toBe(300);
    });

    it("caps an account discount at the rental lines left after the promo", () => {
        const priced = computeRentalQuote({
            ...base,
            discount: {label: "Promo", type: "percent", value: 20},
        });
        const quoted: RentalQuoteResult = applyDiscount(priced, {
            label: "Account",
            type: "percent",
            value: 50,
            code: "account",
        });
        expect(
            quoted.lines.find((line) => line.code === "account")?.total,
        ).toBe(-60);
        expect(quoted.grandTotal).toBe(60);
    });
});

describe("overlapHours", () => {
    it("counts only the hours inside the window", () => {
        const window = {
            start: at("2026-06-01T00:00:00Z"),
            end: at("2026-06-02T00:00:00Z"),
        };
        expect(
            overlapHours(
                window,
                at("2026-06-01T18:00:00Z"),
                at("2026-06-03T06:00:00Z"),
            ),
        ).toBe(6);
        expect(
            overlapHours(
                window,
                at("2026-05-31T00:00:00Z"),
                at("2026-06-01T00:00:00Z"),
            ),
        ).toBe(0);
    });
});

describe("quote money (D35)", () => {
    it("adds VAT exactly once, where float math was a cent short", () => {
        const quote = computeRentalQuote({
            category: {...category, dailyRate: 35},
            extras: [],
            pickupAt: at("2026-06-01T10:00:00Z"),
            returnAt: at("2026-06-04T10:00:00Z"),
            timeZone: "Europe/Zurich",
            settings: {vatRate: 7.7, pricesIncludeVat: false, lateGraceMinutes: 59},
        });
        // 105.00 + 7.7 % = 105.00 + 8.085
        expect(quote).toMatchObject({rentalDays: 3, subtotal: 105, vatAmount: 8.09, grandTotal: 113.09});
    });

    it("sums extras without float drift", () => {
        const quote = computeRentalQuote({
            category: {...category, dailyRate: 0.1},
            extras: [{name: "Seat", price: 0.2, pricing: "per_rental", quantity: 1}],
            pickupAt: at("2026-06-01T10:00:00Z"),
            returnAt: at("2026-06-02T10:00:00Z"),
            timeZone: "Europe/Zurich",
            settings,
        });
        expect(quote.grandTotal).toBe(0.3);
    });
});
