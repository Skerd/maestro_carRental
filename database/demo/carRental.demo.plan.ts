/**
 * The demo fleet's bookings and paperwork, worked out from each car's index with
 * integer arithmetic only, so the same `today` always gives the same plan.
 *
 * Bookings of one car never overlap: past ones sit in two windows (90–37 and 30–6
 * days ago), the current or next one starts two days ago or later, and a second
 * future one starts after it. Every booking lasts whole days at one time of day, so
 * it always meets the 24-hour minimum and the branch opening hours.
 */

import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {DEMO_CATEGORIES, DEMO_INSURERS, DEMO_WORKSHOPS, type DemoExtraName, type DemoVehicle} from "./carRental.demo.data";

export type DemoOutcome = "completed" | "in_progress" | "cancelled" | "no_show" | "expired" | "held" | "confirmed";
type FuelLevel = "full" | "three_quarters" | "half";

export type DemoBooking = {
    key: string;
    vehicleIndex: number;
    plate: string;
    pickupDate: string;
    returnDate: string;
    time: string;
    pickupLocation: number;
    returnLocation: number;
    outcome: DemoOutcome;
    /** When the customer booked, in days before pickup. */
    bookedDaysBefore: number;
    extras: DemoExtraName[];
    contact: number;
    handoverKm?: number;
    returnKm?: number;
    returnFuel?: FuelLevel;
    extraCharges: {label: string; amount: number}[];
    damage?: {area: (typeof DAMAGE_AREAS)[number]; severity: (typeof SEVERITIES)[number]; estimatedCost: number};
    /** Share of the final total paid at the counter. */
    paidShare: 0 | 0.5 | 1;
};

const TIMES = ["09:00", "10:00", "14:00", "17:30"];
const DAMAGE_AREAS = ["front", "rear", "left", "right", "windshield", "wheels", "interior", "roof"] as const;
const SEVERITIES = ["minor", "moderate", "major"] as const;

type Slot = {slot: number; start: number; days: number};

/** A car's booking windows, as day offsets from today. Cars off the road only get past ones. */
function slotsOf(vehicle: DemoVehicle): Slot[] {
    const i = vehicle.index;
    const slots: Slot[] = [];
    if (i % 3 !== 2) slots.push({slot: 0, start: -88 + ((i * 7) % 45), days: 2 + (i % 6)});
    if (i % 2 === 0) slots.push({slot: 1, start: -30 + ((i * 11) % 19), days: 1 + (i % 6)});
    if (vehicle.status !== "active") return slots;
    // Every ninth car is on the road right now.
    const current = i % 9 === 0 ? {slot: 2, start: -2, days: 5} : {slot: 2, start: 2 + ((i * 13) % 38), days: 2 + ((i * 5) % 8)};
    if (i % 4 !== 3) slots.push(current);
    if (i % 3 === 0 && i % 9 !== 0) {
        const start = current.start + current.days + 2 + (i % 4);
        const days = 2 + (i % 5);
        if (start + days <= 60) slots.push({slot: 3, start, days});
    }
    return slots;
}

function outcomeOf(slot: Slot, k: number): DemoOutcome {
    if (slot.start < 0 && slot.start + slot.days > 0) return "in_progress";
    if (slot.start + slot.days <= 0) {
        if (k % 10 === 3) return "cancelled";
        if (k % 17 === 5) return "no_show";
        if (k % 19 === 7) return "expired";
        return "completed";
    }
    if (k % 23 === 4) return "held";
    if (k % 13 === 6) return "cancelled";
    return "confirmed";
}

function extrasOf(k: number): DemoExtraName[] {
    const extras: DemoExtraName[] = [];
    if (k % 5 === 0) extras.push("Child seat");
    if (k % 4 === 1) extras.push("Additional driver");
    if (k % 6 === 2) extras.push("Full insurance");
    if (k % 7 === 4) extras.push("GPS navigation");
    if (k % 11 === 3) extras.push("Cross-border card (Montenegro, Kosovo, North Macedonia)");
    return extras;
}

/** Every booking of the fleet, each car's in date order, with odometer readings that only go up. */
export function planDemoBookings(vehicles: DemoVehicle[], today: string): DemoBooking[] {
    const bookings: DemoBooking[] = [];
    for (const vehicle of vehicles) {
        let km = vehicle.baseKm;
        for (const slot of slotsOf(vehicle)) {
            const k = vehicle.index * 4 + slot.slot;
            const outcome = outcomeOf(slot, k);
            const oneWay = k % 6 === 5;
            const booking: DemoBooking = {
                key: `demo-fleet-${vehicle.plate}-${slot.slot}`,
                vehicleIndex: vehicle.index,
                plate: vehicle.plate,
                pickupDate: addLocalDays(today, slot.start),
                returnDate: addLocalDays(today, slot.start + slot.days),
                time: TIMES[k % TIMES.length],
                pickupLocation: vehicle.home,
                returnLocation: oneWay ? (vehicle.home + 1) % 6 : vehicle.home,
                outcome,
                bookedDaysBefore: 2 + ((k * 5) % 25),
                extras: extrasOf(k),
                contact: k % 40,
                extraCharges: [],
                paidShare: 0,
            };
            if (outcome === "in_progress") {
                booking.handoverKm = km;
                booking.paidShare = 1;
            }
            if (outcome === "completed") {
                booking.handoverKm = km;
                km += slot.days * 110 + (k % 5) * 40;
                booking.returnKm = km;
                booking.returnFuel = (["full", "three_quarters", "half"] as const)[k % 3];
                if (booking.returnFuel === "three_quarters") booking.extraCharges.push({label: "Refuelling", amount: 25});
                if (booking.returnFuel === "half") booking.extraCharges.push({label: "Refuelling", amount: 45});
                if (k % 12 === 1) {
                    const damage = {area: DAMAGE_AREAS[k % DAMAGE_AREAS.length], severity: SEVERITIES[k % SEVERITIES.length], estimatedCost: 80 + ((k * 37) % 400)};
                    booking.damage = damage;
                    // The customer pays up to the deductible; the rest is the insurer's.
                    booking.extraCharges.push({label: `Damage (${damage.area})`, amount: Math.min(damage.estimatedCost, 300)});
                }
                booking.paidShare = k % 7 === 3 ? 0.5 : 1;
            }
            bookings.push(booking);
        }
    }
    return bookings;
}

export type DemoPolicy = {
    insurer: string;
    policyNumber: string;
    coverage: "third_party" | "partial_casco" | "full_casco";
    validFrom: string;
    expiresAt: string;
    premium: number;
    deductible?: number;
    /** Lapsed policies stay `active` on purpose: the fleet reminder job marks them expired. */
    status: "active" | "expired";
};

export type DemoDocument = {
    type: "registration" | "technical_inspection" | "road_tax" | "green_card";
    documentNumber: string;
    issuer: string;
    issuedAt: string;
    expiresAt?: string;
    status: "active" | "expired";
};

export type DemoService = {
    type: "scheduled_service" | "oil_change" | "tires" | "brakes" | "battery" | "repair";
    status: "completed" | "scheduled";
    serviceDate: string;
    odometerKm?: number;
    provider: string;
    cost?: number;
    description: string;
    nextDueAt?: string;
    nextDueKm?: number;
};

export type DemoHistory = {
    acquiredAt: string;
    purchasePrice: number;
    policies: DemoPolicy[];
    documents: DemoDocument[];
    services: DemoService[];
    /** Damage found at the weekly check, not during a booking. */
    inspectionDamage?: {area: "windshield" | "wheels"; severity: "minor" | "moderate"; status: "open" | "in_repair"; reportedAt: string; description: string; estimatedCost: number};
    /** A workshop visit that takes the car out of rental (cars in maintenance). */
    block?: {startDate: string; endDate: string; note: string};
};

const SERVICE_COSTS: Record<DemoService["type"], number> = {scheduled_service: 220, oil_change: 75, tires: 380, brakes: 190, battery: 140, repair: 0};
const OLDER_SERVICES: DemoService["type"][] = ["oil_change", "tires", "brakes", "battery"];
const SERVICE_NOTES: Record<DemoService["type"], string> = {
    scheduled_service: "Yearly service: oil and filters, brake fluid, full check.",
    oil_change: "Engine oil and oil filter changed.",
    tires: "Four new tyres, wheels balanced and aligned.",
    brakes: "Front pads and discs replaced.",
    battery: "12 V battery replaced.",
    repair: "Repair.",
};

/**
 * A car's insurance policies, documents and service log. `finalKm` is its odometer
 * after the planned bookings, so a car can be made due for service by km.
 */
export function planVehicleHistory(vehicle: DemoVehicle, today: string, finalKm: number): DemoHistory {
    const i = vehicle.index;
    const year = Number(today.slice(0, 4));
    const category = DEMO_CATEGORIES.find((entry) => entry.slug === vehicle.category)!;
    const acquiredOffset = -(year - vehicle.year) * 365 - (i % 120) - 30;
    const insurer = DEMO_INSURERS[i % DEMO_INSURERS.length];
    const policyNumber = (n: number) => `${insurer.slice(0, 3).toUpperCase()}-${String(100_000 + i * 97 + n)}`;

    // Current policy: most run for months yet; a few expire within weeks; two have lapsed.
    const lapsed = i === 7 || i === 40;
    const expiresIn = lapsed ? -2 : i % 16 === 3 ? 3 + (i % 23) : 55 + ((i * 17) % 300);
    const validFromOffset = expiresIn - 365;
    const fullCover = ["premium", "suv-4x4", "minivan"].includes(vehicle.category);
    const coverage: DemoPolicy["coverage"] = fullCover ? "full_casco" : i % 3 === 0 ? "partial_casco" : "third_party";
    const premium = Math.round(category.dailyRate * (coverage === "third_party" ? 4 : 11) + ((i * 13) % 60));
    const deductible = coverage === "third_party" ? undefined : coverage === "partial_casco" ? 500 : 300;
    const policies: DemoPolicy[] = [
        {
            insurer, policyNumber: policyNumber(1), coverage,
            validFrom: addLocalDays(today, validFromOffset), expiresAt: addLocalDays(today, expiresIn),
            premium, deductible, status: "active",
        },
    ];
    if (acquiredOffset < validFromOffset - 365) {
        policies.push({
            insurer, policyNumber: policyNumber(0), coverage,
            validFrom: addLocalDays(today, validFromOffset - 365), expiresAt: addLocalDays(today, validFromOffset - 1),
            premium: Math.round(premium * 0.95), deductible, status: "expired",
        });
    }
    if (vehicle.category === "premium") {
        // Liability cover on top of the casco, from another insurer.
        policies.push({
            insurer: DEMO_INSURERS[(i + 1) % DEMO_INSURERS.length], policyNumber: policyNumber(2), coverage: "third_party",
            validFrom: addLocalDays(today, validFromOffset), expiresAt: addLocalDays(today, expiresIn),
            premium: Math.round(category.dailyRate * 4), status: "active",
        });
    }

    const inspectionExpires = i % 14 === 6 ? 5 + (i % 15) : 30 + ((i * 29) % 300);
    const documents: DemoDocument[] = [
        {type: "registration", documentNumber: `AL-RG-${100_000 + i * 713}`, issuer: "DPSHTRR", issuedAt: addLocalDays(today, acquiredOffset), status: "active"},
        {
            type: "technical_inspection", documentNumber: `KT-${200_000 + i * 389}`, issuer: "Qendra e Kontrollit Teknik",
            issuedAt: addLocalDays(today, inspectionExpires - 365), expiresAt: addLocalDays(today, inspectionExpires), status: "active",
        },
        {type: "road_tax", documentNumber: `TQ-${year}-${3_000 + i}`, issuer: "Bashkia", issuedAt: `${year}-01-05`, expiresAt: `${year}-12-31`, status: "active"},
    ];
    if (i % 3 === 0) {
        documents.push({
            type: "technical_inspection", documentNumber: `KT-${200_000 + i * 389 - 1}`, issuer: "Qendra e Kontrollit Teknik",
            issuedAt: addLocalDays(today, inspectionExpires - 730), expiresAt: addLocalDays(today, inspectionExpires - 366), status: "expired",
        });
    }
    if (i % 4 === 0) {
        const issued = -((i * 11) % 200);
        documents.push({type: "green_card", documentNumber: `GC-${400_000 + i * 53}`, issuer: insurer, issuedAt: addLocalDays(today, issued), expiresAt: addLocalDays(today, issued + 365), status: "active"});
    }

    // Service log: the latest completed service sets the next one. A few cars are due by date or by km.
    const dueByDate = i % 26 === 0;
    const dueByKm = i % 22 === 5;
    const lastOffset = dueByDate ? -360 + (i % 10) : -95 - ((i * 29) % 200);
    const lastKm = dueByKm ? finalKm - 14_500 : Math.max(500, vehicle.baseKm - ((i * 131) % 3_000) - 200);
    const services: DemoService[] = [];
    const count = 1 + (i % 3);
    for (let n = count - 1; n >= 1; n--) {
        const type = OLDER_SERVICES[(i + n) % OLDER_SERVICES.length];
        services.push({
            type, status: "completed", serviceDate: addLocalDays(today, lastOffset - 300 * n),
            odometerKm: Math.max(300, lastKm - 11_000 * n), provider: DEMO_WORKSHOPS[(i + n) % DEMO_WORKSHOPS.length],
            cost: SERVICE_COSTS[type] + ((i * 7) % 40), description: SERVICE_NOTES[type],
        });
    }
    services.push({
        type: "scheduled_service", status: "completed", serviceDate: addLocalDays(today, lastOffset), odometerKm: lastKm,
        provider: DEMO_WORKSHOPS[i % DEMO_WORKSHOPS.length], cost: SERVICE_COSTS.scheduled_service + ((i * 11) % 90),
        description: SERVICE_NOTES.scheduled_service, nextDueAt: addLocalDays(today, lastOffset + 365), nextDueKm: lastKm + 15_000,
    });

    const history: DemoHistory = {
        acquiredAt: addLocalDays(today, acquiredOffset),
        purchasePrice: Math.round(category.dailyRate * 480 + ((i * 251) % 2_500)),
        policies,
        documents,
        services,
    };
    if (vehicle.status === "maintenance") {
        services.push({
            type: "repair", status: "scheduled", serviceDate: addLocalDays(today, 3), provider: DEMO_WORKSHOPS[(i + 2) % DEMO_WORKSHOPS.length],
            description: "Gearbox noise when shifting into third: diagnosis and repair.",
        });
        history.block = {startDate: addLocalDays(today, 0), endDate: addLocalDays(today, 4), note: "Demo: in the workshop"};
    }
    if (i === 5) {
        history.inspectionDamage = {area: "windshield", severity: "minor", status: "open", reportedAt: addLocalDays(today, -3), description: "Stone chip on the windshield found at the weekly check.", estimatedCost: 90};
    }
    if (i === 40) {
        history.inspectionDamage = {area: "wheels", severity: "moderate", status: "in_repair", reportedAt: addLocalDays(today, -6), description: "Front left rim bent and tyre sidewall cut.", estimatedCost: 260};
    }
    return history;
}
