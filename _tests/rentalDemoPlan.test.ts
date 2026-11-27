import {describe, expect, it} from "vitest";
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {CAR_BY_CAR_CATEGORIES, DEMO_LOCATIONS, demoListing, demoVehicles} from "@carRentalModule/database/demo/carRental.demo.data";
import {planDemoBookings, planVehicleHistory} from "@carRentalModule/database/demo/carRental.demo.plan";

const today = "2026-10-20";
const year = 2026;
const vehicles = demoVehicles(year);
const bookings = planDemoBookings(vehicles, today);

describe("demo fleet plan", () => {
    it("builds 85 cars with unique plates, keeping the earlier seed's plates", () => {
        // 80 cars, then the five special cars rented on their own (D198), added last so earlier keys stay.
        expect(vehicles).toHaveLength(85);
        expect(new Set(vehicles.map((vehicle) => vehicle.plate)).size).toBe(85);
        expect(vehicles.slice(80).map((vehicle) => vehicle.category)).toEqual(["special", "special", "special", "special", "special"]);
        for (const plate of ["AA101DM", "AA102DM", "AB201DM", "AB202DM", "AC301DM", "AC302DM"]) {
            expect(vehicles.some((vehicle) => vehicle.plate === plate)).toBe(true);
        }
        expect(vehicles.filter((vehicle) => vehicle.status !== "active")).toHaveLength(5);
    });

    it("plans about 180 bookings, every status, all within 90 days back and 60 ahead", () => {
        expect(bookings.length).toBeGreaterThanOrEqual(150);
        expect(bookings.length).toBeLessThanOrEqual(200);
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

    it("hands a car over only with papers valid from the pickup through the return, whatever the seed day", () => {
        // The seed's handover runs assertVehiclePapersValid: one policy covering the pickup to the return, and the newest
        // paper of each road document type still valid at the return. The seed stores paper days at local noon.
        const roadTypes = new Set(["registration", "technical_inspection", "emissions_test", "road_tax"]);
        const noon = (date: string) => `${date}T12:00`;
        for (let offset = 0; offset < 120; offset += 1) {
            const day = addLocalDays("2026-09-01", offset);
            const fleet = demoVehicles(Number(day.slice(0, 4)));
            const histories = new Map(fleet.map((vehicle) => [vehicle.index, planVehicleHistory(vehicle, day, vehicle.baseKm)]));
            const refused = planDemoBookings(fleet, day)
                .filter((booking) => booking.outcome === "completed" || booking.outcome === "in_progress")
                .filter((booking) => {
                    const history = histories.get(booking.vehicleIndex)!;
                    const from = `${booking.pickupDate}T${booking.time}`;
                    const until = `${booking.returnDate}T${booking.time}`;
                    const insured = history.policies.some((policy) => noon(policy.validFrom) <= from && noon(policy.expiresAt) >= until);
                    const newest = new Map<string, {issuedAt: string; expiresAt?: string}>();
                    for (const document of history.documents.filter((entry) => roadTypes.has(entry.type))) {
                        const current = newest.get(document.type);
                        if (!current || document.issuedAt > current.issuedAt) newest.set(document.type, document);
                    }
                    const lapsed = [...newest.values()].some((document) => document.expiresAt !== undefined && noon(document.expiresAt) < until);
                    return !insured || lapsed;
                })
                .map((booking) => `${day} ${booking.key}`);
            expect(refused).toEqual([]);
        }
    });

    it("returns the same plan for the same day", () => {
        expect(planDemoBookings(demoVehicles(2026), today)).toEqual(bookings);
    });

    it("rents the special, premium, 4x4 and minivan cars on their own, priced by model year (D198)", () => {
        const special = vehicles.find((vehicle) => vehicle.modelKey === "Mercedes-Benz G-Class")!;
        expect(demoListing(special, {dailyRate: 150}, year)).toMatchObject({listedAlone: true, dailyRate: 240, depositAmount: 4000});
        const premium = vehicles.filter((vehicle) => vehicle.category === "premium");
        expect(premium.every((vehicle) => demoListing(vehicle, {dailyRate: 110}, year).listedAlone)).toBe(true);
        const newest = premium.find((vehicle) => vehicle.year === year - 1)!;
        expect(demoListing(newest, {dailyRate: 110}, year).dailyRate).toBe(127);
        const economy = vehicles.find((vehicle) => vehicle.category === "economy")!;
        expect(demoListing(economy, {dailyRate: 29}, year)).toEqual({listedAlone: false});
        expect(CAR_BY_CAR_CATEGORIES).toEqual(["premium", "suv-4x4", "minivan", "special"]);
    });
});
