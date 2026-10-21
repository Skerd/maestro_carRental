/**
 * Static tables of the car-rental demo company: locations, categories, models,
 * extras, insurers, workshops and customers. The fleet itself (80 cars) is built
 * from `DEMO_MODELS` by `demoVehicles()`, deterministically.
 */

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const hours = (startTime: string, endTime: string) => EVERY_DAY.map((dayOfWeek) => ({dayOfWeek, startTime, endTime}));

export const DEMO_TIMEZONE = "Europe/Tirane";

/** The first two keep their original names: they are the natural keys of earlier seeds. */
export const DEMO_LOCATIONS = [
    {
        name: "Tirana City Center",
        phone: "+355 69 000 1001",
        email: "city@rental.demo",
        address: {street: "Rruga e Durrësit 12", postalCode: "1001", latitude: 41.3289, longitude: 19.8136},
        openingHours: hours("08:00", "20:00"),
    },
    {
        name: "Tirana Airport (TIA)",
        phone: "+355 69 000 1002",
        email: "airport@rental.demo",
        address: {street: "Rinas", postalCode: "1504", latitude: 41.4147, longitude: 19.7206},
        // No rows: open around the clock.
        openingHours: [],
    },
    {
        name: "Durrës Port",
        phone: "+355 69 000 1003",
        email: "durres@rental.demo",
        address: {street: "Rruga Tregtare, Porti i Durrësit", postalCode: "2001", latitude: 41.3133, longitude: 19.4453},
        openingHours: hours("08:00", "20:00"),
    },
    {
        name: "Sarandë Promenade",
        phone: "+355 69 000 1004",
        email: "sarande@rental.demo",
        address: {street: "Rruga Jonianët 15", postalCode: "9701", latitude: 39.873, longitude: 20.005},
        openingHours: hours("08:00", "21:00"),
    },
    {
        name: "Vlorë Lungomare",
        phone: "+355 69 000 1005",
        email: "vlore@rental.demo",
        address: {street: "Rruga Ismail Qemali, Lungomare", postalCode: "9401", latitude: 40.452, longitude: 19.485},
        openingHours: hours("08:00", "20:00"),
    },
    {
        name: "Shkodër Center",
        phone: "+355 69 000 1006",
        email: "shkoder@rental.demo",
        address: {street: "Bulevardi Skënderbeu 22", postalCode: "4001", latitude: 42.0683, longitude: 19.5126},
        openingHours: hours("08:00", "19:00"),
    },
];

/**
 * `economy`, `compact-suv` and `electric` are the slugs of earlier seeds and stay.
 * `summerDailyRate` becomes a 15 June – 15 September season for this year and next.
 */
export const DEMO_CATEGORIES = [
    {
        name: "Mini", slug: "mini", seats: 4, doors: 3, luggage: 1, transmission: "manual", fuelType: "petrol",
        features: ["Air conditioning", "Bluetooth"], dailyRate: 22, weekendDailyRate: 26, weeklyRate: 135, summerDailyRate: 32,
        depositAmount: 250, mileagePolicy: "unlimited", minDriverAge: 21, sortOrder: 1,
        description: "Easy to park in Tirana's old streets and light on fuel.",
    },
    {
        name: "Economy", slug: "economy", seats: 5, doors: 5, luggage: 2, transmission: "manual", fuelType: "petrol",
        features: ["Air conditioning", "Bluetooth"], dailyRate: 29, weekendDailyRate: 35, weeklyRate: 175, summerDailyRate: 42,
        depositAmount: 300, mileagePolicy: "unlimited", minDriverAge: 21, sortOrder: 2,
        description: "Small and thrifty, ideal for the city.",
    },
    {
        name: "Compact", slug: "compact", seats: 5, doors: 5, luggage: 3, transmission: "manual", fuelType: "diesel",
        features: ["Air conditioning", "Apple CarPlay", "Cruise control"], dailyRate: 36, weekendDailyRate: 42, weeklyRate: 220, summerDailyRate: 52,
        depositAmount: 400, mileagePolicy: "unlimited", minDriverAge: 21, sortOrder: 3,
        description: "A roomier hatchback for the coast road and longer days out.",
    },
    {
        name: "Sedan", slug: "sedan", seats: 5, doors: 4, luggage: 4, transmission: "automatic", fuelType: "diesel",
        features: ["Air conditioning", "Apple CarPlay", "Cruise control", "Parking sensors"], dailyRate: 45, weeklyRate: 280, summerDailyRate: 62,
        depositAmount: 500, mileagePolicy: "unlimited", minDriverAge: 23, sortOrder: 4,
        description: "Comfortable on the highway with a big boot for suitcases.",
    },
    {
        name: "Estate", slug: "estate", seats: 5, doors: 5, luggage: 5, transmission: "automatic", fuelType: "diesel",
        features: ["Air conditioning", "Roof rails", "Cruise control", "Parking sensors"], dailyRate: 52, weeklyRate: 320, summerDailyRate: 70,
        depositAmount: 500, mileagePolicy: "unlimited", minDriverAge: 23, sortOrder: 5,
        description: "Space for the whole family's luggage, bikes on the roof.",
    },
    {
        name: "Compact SUV", slug: "compact-suv", seats: 5, doors: 5, luggage: 3, transmission: "automatic", fuelType: "hybrid",
        features: ["Air conditioning", "Apple CarPlay", "Rear camera"], dailyRate: 49, weekendDailyRate: 55, weeklyRate: 300, summerDailyRate: 68,
        depositAmount: 500, mileagePolicy: "limited", includedKmPerDay: 250, extraKmPrice: 0.25, minDriverAge: 23, sortOrder: 6,
        description: "Room for the family and the mountain roads.",
    },
    {
        name: "SUV 4x4", slug: "suv-4x4", seats: 5, doors: 5, luggage: 4, transmission: "automatic", fuelType: "diesel",
        features: ["Four-wheel drive", "Hill descent control", "Air conditioning", "Navigation"], dailyRate: 85, weeklyRate: 530, summerDailyRate: 105,
        depositAmount: 900, mileagePolicy: "limited", includedKmPerDay: 300, extraKmPrice: 0.35, minDriverAge: 25, sortOrder: 7,
        description: "For Theth, Valbona and the gravel roads in between.",
    },
    {
        name: "Premium", slug: "premium", seats: 5, doors: 4, luggage: 4, transmission: "automatic", fuelType: "diesel",
        features: ["Leather seats", "Adaptive cruise control", "Navigation", "Heated seats"], dailyRate: 110, weeklyRate: 690, summerDailyRate: 140,
        depositAmount: 1500, mileagePolicy: "limited", includedKmPerDay: 300, extraKmPrice: 0.45, minDriverAge: 27, sortOrder: 8,
        description: "Business trips and weddings, arriving in style.",
    },
    {
        name: "Electric", slug: "electric", seats: 5, doors: 5, luggage: 2, transmission: "automatic", fuelType: "electric",
        features: ["Fast charging", "Heat pump", "Navigation"], dailyRate: 59, weeklyRate: 360, summerDailyRate: 75,
        depositAmount: 600, mileagePolicy: "unlimited", minDriverAge: 25, sortOrder: 9,
        description: "Quiet, quick and free to charge at our locations.",
    },
    {
        name: "Minivan", slug: "minivan", seats: 8, doors: 5, luggage: 6, transmission: "automatic", fuelType: "diesel",
        features: ["Sliding doors", "Three-zone climate", "Rear camera", "Cruise control"], dailyRate: 95, weeklyRate: 590, summerDailyRate: 125,
        depositAmount: 900, mileagePolicy: "unlimited", minDriverAge: 25, sortOrder: 10,
        description: "Eight seats for families and groups heading south.",
    },
] as const;

export type DemoCategorySlug = (typeof DEMO_CATEGORIES)[number]["slug"];

/** Models per category with how many cars of each; a category's counts add up to its share of the 80 cars. */
export const DEMO_MODELS: {category: DemoCategorySlug; make: string; model: string; count: number}[] = [
    {category: "mini", make: "Fiat", model: "500", count: 3},
    {category: "mini", make: "Hyundai", model: "i10", count: 3},
    {category: "mini", make: "Suzuki", model: "Ignis", count: 2},
    {category: "economy", make: "Fiat", model: "Panda", count: 3},
    {category: "economy", make: "Toyota", model: "Yaris", count: 3},
    {category: "economy", make: "Volkswagen", model: "Polo", count: 3},
    {category: "economy", make: "Dacia", model: "Sandero", count: 3},
    {category: "compact", make: "Volkswagen", model: "Golf", count: 4},
    {category: "compact", make: "Hyundai", model: "i30", count: 3},
    {category: "compact", make: "Toyota", model: "Corolla", count: 3},
    {category: "sedan", make: "Skoda", model: "Octavia", count: 3},
    {category: "sedan", make: "Hyundai", model: "Elantra", count: 3},
    {category: "sedan", make: "Audi", model: "A3 Sedan", count: 2},
    {category: "estate", make: "Skoda", model: "Octavia Combi", count: 2},
    {category: "estate", make: "Volkswagen", model: "Passat Variant", count: 2},
    {category: "estate", make: "Toyota", model: "Corolla Touring Sports", count: 2},
    {category: "compact-suv", make: "Toyota", model: "C-HR", count: 3},
    {category: "compact-suv", make: "Kia", model: "Niro", count: 3},
    {category: "compact-suv", make: "Hyundai", model: "Tucson", count: 3},
    {category: "compact-suv", make: "Dacia", model: "Duster", count: 3},
    {category: "suv-4x4", make: "Toyota", model: "Land Cruiser", count: 2},
    {category: "suv-4x4", make: "Suzuki", model: "Jimny", count: 2},
    {category: "suv-4x4", make: "Volkswagen", model: "Tiguan 4Motion", count: 2},
    {category: "premium", make: "BMW", model: "5 Series", count: 2},
    {category: "premium", make: "Mercedes-Benz", model: "E-Class", count: 2},
    {category: "premium", make: "Audi", model: "A6", count: 2},
    {category: "electric", make: "Tesla", model: "Model 3", count: 2},
    {category: "electric", make: "Volkswagen", model: "ID.3", count: 2},
    {category: "electric", make: "Cupra", model: "Born", count: 2},
    {category: "minivan", make: "Kia", model: "Carnival", count: 2},
    {category: "minivan", make: "Hyundai", model: "Staria", count: 2},
    {category: "minivan", make: "Volkswagen", model: "Multivan", count: 2},
];

/** Plates of earlier seeds, kept so re-seeding an existing database finds the same cars. */
const LEGACY_PLATES: Record<string, string[]> = {
    "Fiat Panda": ["AA101DM"],
    "Toyota Yaris": ["AA102DM"],
    "Toyota C-HR": ["AB201DM"],
    "Kia Niro": ["AB202DM"],
    "Tesla Model 3": ["AC301DM"],
    "Volkswagen ID.3": ["AC302DM"],
};

/** Plate prefix and series digit per category (AA1xxDM: economy, AB2xxDM: compact SUV…). */
const PLATE_SERIES: Record<DemoCategorySlug, string> = {
    economy: "AA1", "compact-suv": "AB2", electric: "AC3", mini: "AD4", compact: "AE5",
    sedan: "AF6", estate: "AG7", "suv-4x4": "AH8", premium: "AK9", minivan: "AL0",
};

const COLORS = ["White", "Silver", "Black", "Grey", "Blue", "Red", "Dark green", "Beige"];

export type DemoVehicle = {
    index: number;
    plate: string;
    category: DemoCategorySlug;
    make: string;
    model: string;
    /** "Make Model": photo kits and seed media are shared per model. */
    modelKey: string;
    year: number;
    color: string;
    home: number;
    /** Odometer the day the demo window starts (90 days ago). */
    baseKm: number;
    status: "active" | "maintenance" | "retired";
};

/** Five of the 80 cars are off the road: three in the workshop, two retired. */
const OFF_ROAD: Record<number, "maintenance" | "retired"> = {11: "retired", 33: "maintenance", 52: "maintenance", 67: "retired"};

/** The whole fleet, in a fixed order. `index` drives every other deterministic choice. */
export function demoVehicles(currentYear: number): DemoVehicle[] {
    const vehicles: DemoVehicle[] = [];
    const nextNumber: Partial<Record<DemoCategorySlug, number>> = {};
    for (const model of DEMO_MODELS) {
        const modelKey = `${model.make} ${model.model}`;
        const legacy = LEGACY_PLATES[modelKey] ?? [];
        for (let n = 0; n < model.count; n++) {
            const index = vehicles.length;
            let plate = legacy[n];
            if (!plate) {
                // Numbers start at 10 so they never collide with the legacy x01/x02 plates.
                const number = (nextNumber[model.category] ?? 10) + 1;
                nextNumber[model.category] = number;
                plate = `${PLATE_SERIES[model.category]}${String(number).padStart(2, "0")}DM`;
            }
            const year = currentYear - 1 - (index % 5);
            vehicles.push({
                index,
                plate,
                category: model.category,
                make: model.make,
                model: model.model,
                modelKey,
                year,
                color: COLORS[(index * 3) % COLORS.length],
                // Half the fleet at the two Tirana branches, the rest along the coast and in the north.
                home: [0, 1, 1, 0, 2, 3, 4, 1, 5, 0][index % 10],
                baseKm: (currentYear - year) * 14_000 + ((index * 7_919) % 9_000) + 1_500,
                status: legacy[n] === "AC302DM" ? "maintenance" : OFF_ROAD[index] ?? "active",
            });
        }
    }
    return vehicles;
}

export const DEMO_EXTRAS = [
    {name: "Child seat", pricing: "per_day", price: 5, maxQuantity: 2, sortOrder: 1},
    {name: "Additional driver", pricing: "per_rental", price: 20, maxQuantity: 2, sortOrder: 2},
    {name: "GPS navigation", pricing: "per_day", price: 4, maxQuantity: 1, sortOrder: 3},
    {name: "Full insurance", pricing: "per_day", price: 12, maxQuantity: 1, sortOrder: 4},
    {name: "Cross-border card (Montenegro, Kosovo, North Macedonia)", pricing: "per_rental", price: 40, maxQuantity: 1, sortOrder: 5},
    {name: "Roof box", pricing: "per_day", price: 8, maxQuantity: 1, sortOrder: 6},
    {name: "Snow chains", pricing: "per_rental", price: 15, maxQuantity: 1, sortOrder: 7},
] as const;

export type DemoExtraName = (typeof DEMO_EXTRAS)[number]["name"];

/** Fictional insurers and workshops. */
export const DEMO_INSURERS = ["Adriatik Sigurime", "Shqiponja Insurance", "Dajti Assurance", "Ilira Sig"];
export const DEMO_WORKSHOPS = ["Servis Rinas", "Auto Kombinati", "Garazh Durrësi", "Goma Express Shkodër", "Elektro Auto Vlorë"];

const FIRST_NAMES = ["Arta", "Luca", "Mira", "Besnik", "Elira", "Jonas", "Klea", "Marco", "Sara", "Dritan", "Anna", "Ermal", "Sophie", "Gent", "Lena", "Arben", "Chloé", "Ilir", "Nora", "Tomás"];
const LAST_NAMES = ["Hoxha", "Bianchi", "Kola", "Shehu", "Müller", "Leka", "Dupont", "Rossi", "Krasniqi", "Weber", "Dervishi", "Novak", "Gashi", "Martin", "Berisha", "Schmid", "Basha", "Costa", "Meta", "Ferrari"];
const PHONE_PREFIX = ["+355 69", "+39 333", "+355 68", "+49 151", "+33 6", "+41 79"];

/** Forty customers, built from the name lists above. */
export const DEMO_CONTACTS = Array.from({length: 40}, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    return {
        firstName,
        lastName,
        email: `${firstName}.${lastName}${i}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@rental.demo",
        phone: `${PHONE_PREFIX[i % PHONE_PREFIX.length]} ${String(100 + i * 37).padStart(3, "0")} ${String(1000 + i * 113).slice(-4)}`,
    };
});
