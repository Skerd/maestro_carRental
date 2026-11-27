import {multiplyMoney} from "armonia/src/modules/core/helpers/money";
import type {VehicleColor} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

/**
 * Static tables of the car-rental demo company: locations, categories, models,
 * extras, insurers, workshops and customers. The fleet itself (80 cars) is built
 * from `DEMO_MODELS` by `demoVehicles()`, deterministically.
 */

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const hours = (startTime: string, endTime: string) =>
    EVERY_DAY.map((dayOfWeek) => ({dayOfWeek, startTime, endTime}));

export const DEMO_TIMEZONE = "Europe/Tirane";

/** The first two keep their original names: they are the natural keys of earlier seeds. */
export const DEMO_LOCATIONS = [
    {
        name: "Tirana City Center",
        cityName: "Tirana",
        phone: "+355 69 000 1001",
        email: "city@rental.demo",
        address: {
            street: "Rruga e Durrësit 12",
            postalCode: "1001",
            latitude: 41.3289,
            longitude: 19.8136,
        },
        openingHours: hours("08:00", "20:00"),
    },
    {
        name: "Tirana Airport (TIA)",
        cityName: "Tirana",
        phone: "+355 69 000 1002",
        email: "airport@rental.demo",
        address: {
            street: "Rinas",
            postalCode: "1504",
            latitude: 41.4147,
            longitude: 19.7206,
        },
        // No rows: open around the clock.
        openingHours: [],
    },
    {
        name: "Durrës Port",
        cityName: "Durrës",
        phone: "+355 69 000 1003",
        email: "durres@rental.demo",
        address: {
            street: "Rruga Tregtare, Porti i Durrësit",
            postalCode: "2001",
            latitude: 41.3133,
            longitude: 19.4453,
        },
        openingHours: hours("08:00", "20:00"),
    },
    {
        name: "Sarandë Promenade",
        cityName: "Sarandë",
        phone: "+355 69 000 1004",
        email: "sarande@rental.demo",
        address: {
            street: "Rruga Jonianët 15",
            postalCode: "9701",
            latitude: 39.873,
            longitude: 20.005,
        },
        openingHours: hours("08:00", "21:00"),
    },
    {
        name: "Vlorë Lungomare",
        cityName: "Vlorë",
        phone: "+355 69 000 1005",
        email: "vlore@rental.demo",
        address: {
            street: "Rruga Ismail Qemali, Lungomare",
            postalCode: "9401",
            latitude: 40.452,
            longitude: 19.485,
        },
        openingHours: hours("08:00", "20:00"),
    },
    {
        name: "Shkodër Center",
        cityName: "Shkodër",
        phone: "+355 69 000 1006",
        email: "shkoder@rental.demo",
        address: {
            street: "Bulevardi Skënderbeu 22",
            postalCode: "4001",
            latitude: 42.0683,
            longitude: 19.5126,
        },
        openingHours: hours("08:00", "19:00"),
    },
];

/**
 * `economy`, `compact-suv` and `electric` are the slugs of earlier seeds and stay.
 * `summerDailyRate` becomes a 15 June – 15 September season for this year and next.
 */
export const DEMO_CATEGORIES = [
    {
        name: "Mini",
        slug: "mini",
        seats: 4,
        doors: 3,
        luggage: 1,
        transmission: "manual",
        fuelType: "petrol",
        features: ["Kondicioner", "Bluetooth"],
        dailyRate: 22,
        weekendDailyRate: 26,
        weeklyRate: 135,
        summerDailyRate: 32,
        depositAmount: 250,
        mileagePolicy: "unlimited",
        minDriverAge: 21,
        sortOrder: 1,
        description: "Parkohet lehtë në rrugët e ngushta të Tiranës dhe harxhon pak karburant.",
    },
    {
        name: "Economy",
        slug: "economy",
        seats: 5,
        doors: 5,
        luggage: 2,
        transmission: "manual",
        fuelType: "petrol",
        features: ["Kondicioner", "Bluetooth"],
        dailyRate: 29,
        weekendDailyRate: 35,
        weeklyRate: 175,
        summerDailyRate: 42,
        depositAmount: 300,
        mileagePolicy: "unlimited",
        minDriverAge: 21,
        sortOrder: 2,
        description: "E vogël dhe ekonomike, ideale për qytetin.",
    },
    {
        name: "Compact",
        slug: "compact",
        seats: 5,
        doors: 5,
        luggage: 3,
        transmission: "manual",
        fuelType: "diesel",
        features: ["Kondicioner", "Apple CarPlay", "Kontroll i shpejtësisë"],
        dailyRate: 36,
        weekendDailyRate: 42,
        weeklyRate: 220,
        summerDailyRate: 52,
        depositAmount: 400,
        mileagePolicy: "unlimited",
        minDriverAge: 21,
        sortOrder: 3,
        description:
            "Hatchback më i gjerë për rrugën bregdetare dhe ditë të gjata udhëtimi.",
    },
    {
        name: "Sedan",
        slug: "sedan",
        seats: 5,
        doors: 4,
        luggage: 4,
        transmission: "automatic",
        fuelType: "diesel",
        features: [
            "Kondicioner",
            "Apple CarPlay",
            "Kontroll i shpejtësisë",
            "Sensorë parkimi",
        ],
        dailyRate: 45,
        weeklyRate: 280,
        summerDailyRate: 62,
        depositAmount: 500,
        mileagePolicy: "unlimited",
        minDriverAge: 23,
        sortOrder: 4,
        description:
            "E rehatshme në autostradë, me bagazh të madh për valixhet.",
    },
    {
        name: "Estate",
        slug: "estate",
        seats: 5,
        doors: 5,
        luggage: 5,
        transmission: "automatic",
        fuelType: "diesel",
        features: [
            "Kondicioner",
            "Shina mbi çati",
            "Kontroll i shpejtësisë",
            "Sensorë parkimi",
        ],
        dailyRate: 52,
        weeklyRate: 320,
        summerDailyRate: 70,
        depositAmount: 500,
        mileagePolicy: "unlimited",
        minDriverAge: 23,
        sortOrder: 5,
        description: "Vend për bagazhet e gjithë familjes, biçikletat mbi çati.",
    },
    {
        name: "Compact SUV",
        slug: "compact-suv",
        seats: 5,
        doors: 5,
        luggage: 3,
        transmission: "automatic",
        fuelType: "hybrid",
        features: ["Kondicioner", "Apple CarPlay", "Kamerë e pasme"],
        dailyRate: 49,
        weekendDailyRate: 55,
        weeklyRate: 300,
        summerDailyRate: 68,
        depositAmount: 500,
        mileagePolicy: "limited",
        includedKmPerDay: 250,
        extraKmPrice: 0.25,
        minDriverAge: 23,
        sortOrder: 6,
        description: "Vend për familjen dhe për rrugët malore.",
    },
    {
        name: "SUV 4x4",
        slug: "suv-4x4",
        seats: 5,
        doors: 5,
        luggage: 4,
        transmission: "automatic",
        fuelType: "diesel",
        features: [
            "Tërheqje 4x4",
            "Ndihmë në zbritje",
            "Kondicioner",
            "Navigim",
        ],
        dailyRate: 85,
        weeklyRate: 530,
        summerDailyRate: 105,
        depositAmount: 900,
        mileagePolicy: "limited",
        includedKmPerDay: 300,
        extraKmPrice: 0.35,
        minDriverAge: 25,
        sortOrder: 7,
        description: "Për Thethin, Valbonën dhe rrugët me zhavorr mes tyre.",
    },
    {
        name: "Premium",
        slug: "premium",
        seats: 5,
        doors: 4,
        luggage: 4,
        transmission: "automatic",
        fuelType: "diesel",
        features: [
            "Ndenjëse lëkure",
            "Kontroll adaptiv i shpejtësisë",
            "Navigim",
            "Ndenjëse me ngrohje",
        ],
        dailyRate: 110,
        weeklyRate: 690,
        summerDailyRate: 140,
        depositAmount: 1500,
        mileagePolicy: "limited",
        includedKmPerDay: 300,
        extraKmPrice: 0.45,
        minDriverAge: 27,
        sortOrder: 8,
        description: "Udhëtime pune dhe dasma, me stil.",
    },
    {
        name: "Electric",
        slug: "electric",
        seats: 5,
        doors: 5,
        luggage: 2,
        transmission: "automatic",
        fuelType: "electric",
        features: ["Karikim i shpejtë", "Pompë nxehtësie", "Navigim"],
        dailyRate: 59,
        weeklyRate: 360,
        summerDailyRate: 75,
        depositAmount: 600,
        mileagePolicy: "unlimited",
        minDriverAge: 25,
        sortOrder: 9,
        description: "E qetë, e shpejtë dhe me karikim falas në pikat tona.",
    },
    {
        name: "Minivan",
        slug: "minivan",
        seats: 8,
        doors: 5,
        luggage: 6,
        transmission: "automatic",
        fuelType: "diesel",
        features: [
            "Dyer rrëshqitëse",
            "Klimë me tri zona",
            "Kamerë e pasme",
            "Kontroll i shpejtësisë",
        ],
        dailyRate: 95,
        weeklyRate: 590,
        summerDailyRate: 125,
        depositAmount: 900,
        mileagePolicy: "unlimited",
        minDriverAge: 25,
        sortOrder: 10,
        description: "Tetë vende për familje dhe grupe që shkojnë në jug.",
    },
    {
        // Rented car by car only (D198): each one has its own page and price.
        name: "Special cars",
        slug: "special",
        seats: 4,
        doors: 2,
        luggage: 2,
        transmission: "automatic",
        fuelType: "petrol",
        features: [
            "Ndenjëse lëkure",
            "Navigim",
            "Kamerë e pasme",
            "Sistem audio premium",
        ],
        dailyRate: 150,
        weeklyRate: 950,
        summerDailyRate: 190,
        depositAmount: 2500,
        mileagePolicy: "limited",
        includedKmPerDay: 250,
        extraKmPrice: 0.6,
        minDriverAge: 27,
        sortOrder: 11,
        description:
            "Makina të veçanta për dasma, ditëlindje dhe udhëtime që mbahen mend. Rezervoni pikërisht makinën që zgjidhni.",
    },
] as const;

export type DemoCategorySlug = (typeof DEMO_CATEGORIES)[number]["slug"];

/**
 * How each category is sold (D198): these only head their cars rented on their own; Compact SUV and Electric are
 * sold as a class and some of their cars also on their own; the rest only as a class.
 */
export const CAR_BY_CAR_CATEGORIES: readonly DemoCategorySlug[] = ["premium", "suv-4x4", "minivan", "special"];
const ALSO_EXACT_MODELS = ["Toyota C-HR", "Hyundai Tucson", "Tesla Model 3"];

/** Models per category with how many cars of each; a category's counts add up to its share of the 80 cars. */
export const DEMO_MODELS: {
    category: DemoCategorySlug;
    make: string;
    model: string;
    count: number;
}[] = [
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
    {
        category: "estate",
        make: "Toyota",
        model: "Corolla Touring Sports",
        count: 2,
    },
    {category: "compact-suv", make: "Toyota", model: "C-HR", count: 3},
    {category: "compact-suv", make: "Kia", model: "Niro", count: 3},
    {category: "compact-suv", make: "Hyundai", model: "Tucson", count: 3},
    {category: "compact-suv", make: "Dacia", model: "Duster", count: 3},
    {category: "suv-4x4", make: "Toyota", model: "Land Cruiser", count: 2},
    {category: "suv-4x4", make: "Suzuki", model: "Jimny", count: 2},
    {
        category: "suv-4x4",
        make: "Volkswagen",
        model: "Tiguan 4Motion",
        count: 2,
    },
    {category: "premium", make: "BMW", model: "5 Series", count: 2},
    {category: "premium", make: "Mercedes-Benz", model: "E-Class", count: 2},
    {category: "premium", make: "Audi", model: "A6", count: 2},
    {category: "electric", make: "Tesla", model: "Model 3", count: 2},
    {category: "electric", make: "Volkswagen", model: "ID.3", count: 2},
    {category: "electric", make: "Cupra", model: "Born", count: 2},
    {category: "minivan", make: "Kia", model: "Carnival", count: 2},
    {category: "minivan", make: "Hyundai", model: "Staria", count: 2},
    {category: "minivan", make: "Volkswagen", model: "Multivan", count: 2},
    // Added after the first 80 cars, so the earlier cars and their bookings keep their keys.
    {category: "special", make: "Mercedes-Benz", model: "G-Class", count: 1},
    {category: "special", make: "Porsche", model: "911 Cabriolet", count: 1},
    {category: "special", make: "Land Rover", model: "Defender 110", count: 1},
    {category: "special", make: "Ford", model: "Mustang Convertible", count: 1},
    {category: "special", make: "Mercedes-Benz", model: "S-Class", count: 1},
];

/** The special cars' own pages: name, words, colour and prices (D198). */
type CarSpecs = {seats?: number; doors?: number; luggage?: number; fuelType?: "petrol" | "diesel"};

const SPECIAL_LISTINGS: Record<string, {title: string; description: string; color: VehicleColor; dailyRate: number; weekendDailyRate?: number; depositAmount: number; specs: CarSpecs}> = {
    "Mercedes-Benz G-Class": {
        title: "Mercedes-Benz G 63 AMG – E zezë",
        description: "Ikona e rrugëve shqiptare: për Thethin, për dasmën ose thjesht për bulevardin e Tiranës.",
        color: "black",
        dailyRate: 240,
        weekendDailyRate: 280,
        depositAmount: 4000,
        specs: {seats: 5, doors: 5, luggage: 3},
    },
    "Porsche 911 Cabriolet": {
        title: "Porsche 911 Carrera Cabriolet",
        description: "Kapotë e hapur përgjatë Rivierës, nga Vlora në Himarë. Për shoferë me përvojë.",
        color: "grey",
        dailyRate: 290,
        weekendDailyRate: 330,
        depositAmount: 5000,
        specs: {luggage: 1},
    },
    "Land Rover Defender 110": {
        title: "Land Rover Defender 110",
        description: "Komod në autostradë dhe i fortë në rrugët malore drejt Valbonës dhe Thethit.",
        color: "green",
        dailyRate: 190,
        depositAmount: 3000,
        specs: {seats: 5, doors: 5, luggage: 4, fuelType: "diesel"},
    },
    "Ford Mustang Convertible": {
        title: "Ford Mustang GT Convertible",
        description: "V8 dhe kapotë e hapur: dita perfekte në bregdet.",
        color: "blue",
        dailyRate: 150,
        weekendDailyRate: 175,
        depositAmount: 2000,
        specs: {},
    },
    "Mercedes-Benz S-Class": {
        title: "Mercedes-Benz S-Class – Makina e dasmës",
        description: "E zbukuruar me lule sipas kërkesës, me shofer opsional. E preferuara e dasmave në Tiranë dhe Durrës.",
        color: "white",
        dailyRate: 180,
        weekendDailyRate: 220,
        depositAmount: 2500,
        specs: {seats: 5, doors: 4, luggage: 3, fuelType: "diesel"},
    },
};

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
    economy: "AA1",
    "compact-suv": "AB2",
    electric: "AC3",
    mini: "AD4",
    special: "AN5",
    compact: "AE5",
    sedan: "AF6",
    estate: "AG7",
    "suv-4x4": "AH8",
    premium: "AK9",
    minivan: "AL0",
};

/** Colour codes (D199): the panel and the site show them in the reader's language. */
const COLORS: VehicleColor[] = ["white", "silver", "black", "grey", "blue", "red", "green", "beige"];

export type DemoVehicle = {
    index: number;
    plate: string;
    category: DemoCategorySlug;
    make: string;
    model: string;
    /** "Make Model": photo kits and seed media are shared per model. */
    modelKey: string;
    year: number;
    color: VehicleColor;
    home: number;
    /** Odometer the day the demo window starts (90 days ago). */
    baseKm: number;
    status: "active" | "maintenance" | "retired";
};

/** Five of the 80 cars are off the road: three in the workshop, two retired. */
const OFF_ROAD: Record<number, "maintenance" | "retired"> = {
    11: "retired",
    33: "maintenance",
    52: "maintenance",
    67: "retired",
};

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
                color: SPECIAL_LISTINGS[modelKey]?.color ?? COLORS[(index * 3) % COLORS.length],
                // Half the fleet at the two Tirana branches, the rest along the coast and in the north.
                home: [0, 1, 1, 0, 2, 3, 4, 1, 5, 0][index % 10],
                baseKm:
                    (currentYear - year) * 14_000 +
                    ((index * 7_919) % 9_000) +
                    1_500,
                status:
                    legacy[n] === "AC302DM"
                        ? "maintenance"
                        : (OFF_ROAD[index] ?? "active"),
            });
        }
    }
    return vehicles;
}

/**
 * Whether a car is rented on its own and at what (D198). A special car has its own page and prices. In a category
 * sold car by car, and for a few models sold both ways, every car is listed: the newest year costs 15% more than its
 * category, the year after 5% more, older cars 10% less, and the middle year keeps the category's price.
 */
export function demoListing(
    vehicle: DemoVehicle,
    category: {dailyRate: number},
    currentYear: number,
): {listedAlone: boolean; listingTitle?: string; listingDescription?: string; dailyRate?: number; weekendDailyRate?: number; depositAmount?: number} & CarSpecs {
    const special = SPECIAL_LISTINGS[vehicle.modelKey];
    if (special) {
        return {
            listedAlone: true,
            listingTitle: special.title,
            listingDescription: special.description,
            dailyRate: special.dailyRate,
            ...(special.weekendDailyRate !== undefined ? {weekendDailyRate: special.weekendDailyRate} : {}),
            depositAmount: special.depositAmount,
            // Where it differs from its category's (TD-B291).
            ...special.specs,
        };
    }
    const listed = CAR_BY_CAR_CATEGORIES.includes(vehicle.category) || ALSO_EXACT_MODELS.includes(vehicle.modelKey);
    if (!listed) return {listedAlone: false};
    const age = currentYear - 1 - vehicle.year;
    const factor = age === 0 ? 1.15 : age === 1 ? 1.05 : age === 2 ? 1 : 0.9;
    // Whole euros, as a rental desk prices them.
    return factor === 1 ? {listedAlone: true} : {listedAlone: true, dailyRate: multiplyMoney(category.dailyRate, factor, 0)};
}

export const DEMO_EXTRAS = [
    {
        name: "Karrige për fëmijë",
        kind: "extra",
        pricing: "per_day",
        price: 5,
        maxQuantity: 2,
        sortOrder: 1,
    },
    {
        name: "Shofer shtesë",
        kind: "extra",
        pricing: "per_rental",
        price: 20,
        maxQuantity: 2,
        sortOrder: 2,
    },
    {
        name: "Navigim GPS",
        kind: "extra",
        pricing: "per_day",
        price: 4,
        maxQuantity: 1,
        sortOrder: 3,
    },
    {
        name: "Sigurim i plotë",
        kind: "extra",
        pricing: "per_day",
        price: 12,
        maxQuantity: 1,
        sortOrder: 4,
    },
    {
        name: "Kartë për kalim kufiri (Mal i Zi, Kosovë, Maqedoni e Veriut)",
        kind: "extra",
        pricing: "per_rental",
        price: 40,
        maxQuantity: 1,
        sortOrder: 5,
    },
    {
        name: "Kuti bagazhi mbi çati",
        kind: "extra",
        pricing: "per_day",
        price: 8,
        maxQuantity: 1,
        sortOrder: 6,
    },
    {
        name: "Zinxhirë bore",
        kind: "extra",
        pricing: "per_rental",
        price: 15,
        maxQuantity: 1,
        sortOrder: 7,
    },
    {
        name: "Mbrojtje bazë",
        kind: "protection",
        pricing: "per_day",
        price: 8,
        maxQuantity: 1,
        sortOrder: 8,
        excessAmount: 800,
        depositAmount: 200,
    },
    {
        name: "Pa franshizë",
        kind: "protection",
        pricing: "per_day",
        price: 18,
        maxQuantity: 1,
        sortOrder: 9,
        excessAmount: 0,
        depositAmount: 100,
    },
] as const;

export type DemoExtraName = (typeof DEMO_EXTRAS)[number]["name"];

/** Fictional insurers and workshops. */
export const DEMO_INSURERS = [
    "Adriatik Sigurime",
    "Shqiponja Insurance",
    "Dajti Assurance",
    "Ilira Sig",
];
export const DEMO_WORKSHOPS = [
    "Servis Rinas",
    "Auto Kombinati",
    "Garazh Durrësi",
    "Goma Express Shkodër",
    "Elektro Auto Vlorë",
];

const FIRST_NAMES = [
    "Arta",
    "Luca",
    "Mira",
    "Besnik",
    "Elira",
    "Jonas",
    "Klea",
    "Marco",
    "Sara",
    "Dritan",
    "Anna",
    "Ermal",
    "Sophie",
    "Gent",
    "Lena",
    "Arben",
    "Chloé",
    "Ilir",
    "Nora",
    "Tomás",
];
const LAST_NAMES = [
    "Hoxha",
    "Bianchi",
    "Kola",
    "Shehu",
    "Müller",
    "Leka",
    "Dupont",
    "Rossi",
    "Krasniqi",
    "Weber",
    "Dervishi",
    "Novak",
    "Gashi",
    "Martin",
    "Berisha",
    "Schmid",
    "Basha",
    "Costa",
    "Meta",
    "Ferrari",
];
const PHONE_PREFIX = [
    "+355 69",
    "+39 333",
    "+355 68",
    "+49 151",
    "+33 6",
    "+41 79",
];

/** Forty customers, built from the name lists above. */
export const DEMO_CONTACTS = Array.from({length: 40}, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    return {
        firstName,
        lastName,
        email:
            `${firstName}.${lastName}${i}`
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "") + "@rental.demo",
        phone: `${PHONE_PREFIX[i % PHONE_PREFIX.length]} ${String(100 + i * 37).padStart(3, "0")} ${String(1000 + i * 113).slice(-4)}`,
    };
});

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The booking's contact as its main driver, with made-up licence papers valid well past the trip. */
export function demoDriver(contactIndex: number, pickupDate: string) {
    const contact = DEMO_CONTACTS[contactIndex];
    const year = Number(pickupDate.slice(0, 4));
    const monthDay = `${pad2(1 + (contactIndex % 12))}-${pad2(1 + (contactIndex % 28))}`;
    return {
        role: "primary" as const,
        firstName: contact.firstName,
        lastName: contact.lastName,
        birthDate: `${year - 30 - (contactIndex % 25)}-${monthDay}`,
        licenseNumber: `AL${String(4839201 + contactIndex * 7919).padStart(9, "0")}`,
        licenseCountry: "Albania",
        licenseIssuedAt: `${year - 6 - (contactIndex % 8)}-${monthDay}`,
        licenseExpiresAt: `${year + 2 + (contactIndex % 6)}-${monthDay}`,
    };
}
