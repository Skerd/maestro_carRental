import {describe, expect, it} from "vitest";
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {DEMO_LOCATIONS, demoVehicles} from "@carRentalModule/database/demo/carRental.demo.data";
import {planDemoBookings, planVehicleHistory} from "@carRentalModule/database/demo/carRental.demo.plan";

const today = "2026-10-20";
const vehicles = demoVehicles(2026);
const bookings = planDemoBookings(vehicles, today);

describe("demo fleet plan", () => {
    it("builds 80 cars with unique plates, keeping the earlier seed's plates", () => {
        expect(vehicles).toHaveLength(80);
        expect(new Set(vehicles.map((vehicle) => vehicle.plate)).size).toBe(80);
        for (const plate of ["AA101DM", "AA102DM", "AB201DM", "AB202DM", "AC301DM", "AC302DM"]) {
            expect(vehicles.some((vehicle) => vehicle.plate === plate)).toBe(true);
        }
        expect(vehicles.filter((vehicle) => vehicle.status !== "active")).toHaveLength(5);
    });

    it("plans about 150 bookings, every status, all within 90 days back and 60 ahead", () => {
        expect(bookings.length).toBeGreaterThanOrEqual(140);
        expect(bookings.length).toBeLessThanOrEqual(180);
        expect(new Set(bookings.map((booking) => booking.outcome))).toEqual(
            new Set(["completed", "in_progress", "cancelled", "no_show", "expired", "held", "confirmed"]),
        );
        for (const booking of bookings) {
            expect(booking.pickupDate >= addLocalDays(today, -90)).toBe(true);
            expect(booking.returnDate <= addLocalDays(today, 60)).toBe(true);
            expect(booking.returnDate > booking.pickupDate).toBe(true);
            expect(booking.pickupLocation).toBeLessThan(DEMO_LOCATIONS.length);
        }
        expect(new Set(bookings.map((booking) => booking.key)).size).toBe(bookings.length);
    });

    it("never overlaps two bookings of one car, with at least a day between them", () => {
        for (const vehicle of vehicles) {
            const own = bookings.filter((booking) => booking.vehicleIndex === vehicle.index);
            for (let n = 1; n < own.length; n++) {
                expect(own[n].pickupDate > own[n - 1].returnDate).toBe(true);
            }
        }
    });

    it("gives cars off the road past bookings only, and odometers that only go up", () => {
        for (const vehicle of vehicles.filter((entry) => entry.status !== "active")) {
            expect(bookings.filter((booking) => booking.vehicleIndex === vehicle.index && booking.returnDate > today)).toEqual([]);
        }
        for (const vehicle of vehicles) {
            const readings = bookings
                .filter((booking) => booking.vehicleIndex === vehicle.index)
                .flatMap((booking) => [booking.handoverKm, booking.returnKm])
                .filter((km): km is number => km !== undefined);
            expect(readings).toEqual([...readings].sort((a, b) => a - b));
        }
    });

    it("makes a few policies and documents expire soon, and a few cars due for service", () => {
        const histories = vehicles.map((vehicle) => planVehicleHistory(vehicle, today, vehicle.baseKm + 3_000));
        const soon = addLocalDays(today, 30);
        const expiringPolicies = histories.flatMap((h) => h.policies).filter((p) => p.status === "active" && p.expiresAt > today && p.expiresAt <= soon);
        expect(expiringPolicies.length).toBeGreaterThanOrEqual(3);
        const expiringDocuments = histories.flatMap((h) => h.documents).filter((d) => d.status === "active" && d.expiresAt && d.expiresAt > today && d.expiresAt <= soon);
        expect(expiringDocuments.length).toBeGreaterThanOrEqual(3);
        const dueByDate = histories.filter((h) => h.services.at(-1)?.nextDueAt && h.services.filter((s) => s.status === "completed").at(-1)!.nextDueAt! <= addLocalDays(today, 14));
        expect(dueByDate.length).toBeGreaterThanOrEqual(2);
        expect(histories.filter((h) => h.block)).toHaveLength(3);
    });

    it("returns the same plan for the same day", () => {
        expect(planDemoBookings(demoVehicles(2026), today)).toEqual(bookings);
    });
});
