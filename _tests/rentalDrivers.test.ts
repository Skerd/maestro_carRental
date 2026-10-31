import {describe, expect, it} from "vitest";
import {yearsBetween} from "@carRentalModule/utilities/services/rentalDrivers";

describe("yearsBetween", () => {
    it("counts a year only once its anniversary is reached", () => {
        expect(yearsBetween("2000-06-10", "2021-06-09")).toBe(20);
        expect(yearsBetween("2000-06-10", "2021-06-10")).toBe(21);
        expect(yearsBetween("2000-12-31", "2021-01-01")).toBe(20);
    });

    it("treats a 29 February birthday as reached on 1 March in other years", () => {
        expect(yearsBetween("2004-02-29", "2025-02-28")).toBe(20);
        expect(yearsBetween("2004-02-29", "2025-03-01")).toBe(21);
    });
});
