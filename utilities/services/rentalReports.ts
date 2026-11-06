import type {ObjectId} from "mongodb";
import {
    localDayInterval,
    type TimeInterval,
} from "@coreModule/utilities/time/timeWindows";
import {addMoney, roundToCurrency} from "armonia/src/modules/core/helpers/money";
import type {
    RentalReportGroup,
    RentalReportVehicle,
    RentalReportsResponse,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReports/rentalReports";

import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {vehicleBlockService} from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock.service";
import {vehicleMaintenanceService} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance.service";
import {vehicleDamageService} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage.service";
import {vehicleInsuranceService} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.service";
import {vehicleFineService} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine.service";
import {rentalSearchStatService} from "@carRentalModule/database/schemas/rentalSearchStat/rentalSearchStat.service";
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const RENTED = ["confirmed", "in_progress", "completed"] as const;

/** Hours shared by a half-open window and one interval. */
export function overlapHours(
    window: TimeInterval,
    start: Date,
    end: Date,
): number {
    const from = start > window.start ? start : window.start;
    const to = end < window.end ? end : window.end;
    return to > from ? (to.getTime() - from.getTime()) / HOUR : 0;
}

/** Hours, days and ratios are not money: plain rounding for display. */
function roundTo(value: number, places: number): number {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

function rate(part: number, whole: number): number {
    return whole > 0 ? roundTo(part / whole, 4) : 0;
}

function groupOf(
    rows: {name: string; rented: number; available: number; revenue: number}[],
): RentalReportGroup[] {
    const byName = new Map<
        string,
        {rented: number; available: number; revenue: number}
    >();
    for (const row of rows) {
        const current = byName.get(row.name) ?? {
            rented: 0,
            available: 0,
            revenue: 0,
        };
        current.rented += row.rented;
        current.available += row.available;
        current.revenue = addMoney(current.revenue, row.revenue);
        byName.set(row.name, current);
    }
    return [...byName.entries()].map(([name, row]) => ({
        name,
        utilisation: rate(row.rented, row.available),
        revenue: row.revenue,
    }));
}

/**
 * Fleet utilisation, revenue and cost for a local-date window. Rented hours are
 * confirmed, on-the-road and completed bookings. Available hours are the window
 * minus blocks, for cars that are not retired.
 */
export async function buildRentalReport(
    companyId: ObjectId,
    input: {from: string; to: string; locationId?: string; timezone: string},
): Promise<RentalReportsResponse["data"]> {
    const {from, to, timezone} = input;
    const window = {
        start: localDayInterval(from, timezone).start,
        end: localDayInterval(to, timezone).end,
    };
    const locationId = input.locationId;

    const [
        vehicles,
        categories,
        locations,
        reservations,
        blocks,
        maintenance,
        damages,
        insurance,
        fines,
        stats,
    ] = await Promise.all([
        vehicleService.find({
            company: companyId,
            status: {$ne: "retired"},
            deletedAt: null,
        }, {}, undefined, "plate category homeLocation purchasePrice"),
        vehicleCategoryService.find({company: companyId, deletedAt: null}, {}, undefined, "name",),
        rentalLocationService.find({company: companyId, deletedAt: null}, {}, undefined, "name",),
        rentalReservationService.find({
            company: companyId,
            deletedAt: null,
            pickupAt: {$lt: window.end},
            returnAt: {$gt: window.start},
        }, {}, undefined, "vehicle category pickupLocation status pickupAt returnAt createdAt pricing.grandTotal",),
        vehicleBlockService.find({
            company: companyId,
            deletedAt: null,
            startAt: {$lt: window.end},
            endAt: {$gt: window.start},
        }, {}, undefined, "vehicle startAt endAt"),
        vehicleMaintenanceService.find({
            company: companyId,
            deletedAt: null,
            status: "completed",
            serviceDate: {$gte: window.start, $lt: window.end},
        }, {}, undefined, "vehicle type cost"),
        vehicleDamageService.find({
            company: companyId,
            deletedAt: null,
            reportedAt: {$gte: window.start, $lt: window.end},
        }, {}, undefined, "vehicle chargedAmount insurerPaidAmount"),
        vehicleInsuranceService.find({
            company: companyId,
            deletedAt: null,
            validFrom: {$gte: window.start, $lt: window.end},
        }, {}, undefined, "vehicle premium"),
        vehicleFineService.find({
            company: companyId,
            deletedAt: null,
            status: "paid_by_company",
            paidAt: {$gte: window.start, $lt: window.end},
        }, {}, undefined, "vehicle paidAmount"),
        rentalSearchStatService.find({
            company: companyId,
            day: {$gte: from, $lte: to},
            ...(locationId ? {location: locationId} : {}),
        }, {}, undefined, "searches unavailable"),
    ]);

    const categoryName = new Map(
        categories.map((category) => [String(category._id), category.name]),
    );
    const locationName = new Map(
        locations.map((location) => [String(location._id), location.name]),
    );
    const fleet = locationId
        ? vehicles.filter(
              (vehicle) => String(vehicle.homeLocation) === locationId,
          )
        : vehicles;
    const fleetIds = new Set(fleet.map((vehicle) => String(vehicle._id)));

    const blockHours = new Map<string, number>();
    for (const block of blocks) {
        const id = String(block.vehicle);
        blockHours.set(
            id,
            (blockHours.get(id) ?? 0) +
                overlapHours(window, block.startAt, block.endAt),
        );
    }
    const windowHours = (window.end.getTime() - window.start.getTime()) / HOUR;

    const cost = (rows: {vehicle: unknown; amount?: number}[]) => {
        const totals = new Map<string, number>();
        for (const row of rows) {
            const id = String(row.vehicle);
            totals.set(
                id,
                addMoney(totals.get(id) ?? 0, row.amount ?? 0),
            );
        }
        return totals;
    };
    const maintenanceCost = cost(
        maintenance
            .filter((row) => row.type !== "repair")
            .map((row) => ({vehicle: row.vehicle, amount: row.cost})),
    );
    const repairCost = cost(
        maintenance
            .filter((row) => row.type === "repair")
            .map((row) => ({vehicle: row.vehicle, amount: row.cost})),
    );
    const finesCost = cost(
        fines.map((row) => ({vehicle: row.vehicle, amount: row.paidAmount})),
    );
    const recovered = cost(
        damages.map((row) => ({
            vehicle: row.vehicle,
            amount: (row.chargedAmount ?? 0) + (row.insurerPaidAmount ?? 0),
        })),
    );
    const insurancePremium = cost(
        insurance.map((row) => ({vehicle: row.vehicle, amount: row.premium})),
    );

    const rentedHours = new Map<string, number>();
    const revenue = new Map<string, number>();
    let leadTotal = 0;
    let leadCount = 0;
    let cancelled = 0;
    let noShow = 0;
    let decided = 0;
    let revenueTotal = 0;
    let rentedDays = 0;

    for (const reservation of reservations) {
        const vehicleId = String(reservation.vehicle);
        if (!fleetIds.has(vehicleId)) continue;
        const pickupInWindow =
            reservation.pickupAt >= window.start &&
            reservation.pickupAt < window.end;
        if (
            pickupInWindow &&
            reservation.status !== "held" &&
            reservation.status !== "expired"
        ) {
            decided += 1;
            if (reservation.status === "cancelled") cancelled += 1;
            if (reservation.status === "no_show") noShow += 1;
            leadTotal +=
                (reservation.pickupAt.getTime() -
                    reservation.createdAt.getTime()) /
                DAY;
            leadCount += 1;
        }
        if (!RENTED.includes(reservation.status as (typeof RENTED)[number]))
            continue;
        rentedHours.set(
            vehicleId,
            (rentedHours.get(vehicleId) ?? 0) +
                overlapHours(
                    window,
                    reservation.pickupAt,
                    reservation.returnAt,
                ),
        );
        if (pickupInWindow) {
            const amount = reservation.pricing.grandTotal;
            revenue.set(
                vehicleId,
                addMoney(revenue.get(vehicleId) ?? 0, amount),
            );
            revenueTotal = addMoney(revenueTotal, amount);
            rentedDays += Math.max(
                1,
                (reservation.returnAt.getTime() -
                    reservation.pickupAt.getTime()) /
                    DAY,
            );
        }
    }

    const byVehicle: RentalReportVehicle[] = fleet.map((vehicle) => {
        const id = String(vehicle._id);
        const available = Math.max(0, windowHours - (blockHours.get(id) ?? 0));
        const rented = rentedHours.get(id) ?? 0;
        const earned = revenue.get(id) ?? 0;
        const purchasePrice = vehicle.purchasePrice ?? 0;
        return {
            vehicleId: id,
            plate: vehicle.plate,
            categoryName: categoryName.get(String(vehicle.category)) ?? "",
            branchName: locationName.get(String(vehicle.homeLocation)) ?? "",
            rentedHours: roundTo(rented, 2),
            availableHours: roundTo(available, 2),
            utilisation: rate(rented, available),
            revenue: earned,
            maintenanceCost: maintenanceCost.get(id) ?? 0,
            repairCost: repairCost.get(id) ?? 0,
            insurancePremium: insurancePremium.get(id) ?? 0,
            finesCost: finesCost.get(id) ?? 0,
            recovered: recovered.get(id) ?? 0,
            purchasePrice,
            ...(purchasePrice > 0
                ? {payback: rate(earned, purchasePrice)}
                : {}),
        };
    });

    const availableHours = byVehicle.reduce(
        (sum, row) => sum + row.availableHours,
        0,
    );
    const rentedTotal = byVehicle.reduce(
        (sum, row) => sum + row.rentedHours,
        0,
    );
    const availableCarDays = availableHours / 24;

    return {
        from,
        to,
        timezone,
        summary: {
            utilisation: rate(rentedTotal, availableHours),
            revenue: revenueTotal,
            averageDailyRate:
                rentedDays > 0 ? roundToCurrency(revenueTotal / rentedDays) : 0,
            revenuePerAvailableCarDay:
                availableCarDays > 0
                    ? roundToCurrency(revenueTotal / availableCarDays)
                    : 0,
            leadTimeDays: leadCount > 0 ? roundTo(leadTotal / leadCount, 2) : 0,
            cancellationRate: rate(cancelled, decided),
            noShowRate: rate(noShow, decided),
            searches: stats.reduce((sum, row) => sum + row.searches, 0),
            unavailableSearches: stats.reduce(
                (sum, row) => sum + row.unavailable,
                0,
            ),
        },
        byVehicle,
        byCategory: groupOf(
            byVehicle.map((row) => ({
                name: row.categoryName,
                rented: row.rentedHours,
                available: row.availableHours,
                revenue: row.revenue,
            })),
        ),
        byBranch: groupOf(
            byVehicle.map((row) => ({
                name: row.branchName,
                rented: row.rentedHours,
                available: row.availableHours,
                revenue: row.revenue,
            })),
        ),
    };
}
