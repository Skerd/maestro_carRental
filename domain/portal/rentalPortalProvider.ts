import * as path from "path";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import type {ObjectId} from "mongodb";
import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalBrowseParams, PortalNewSinceContext} from "@coreModule/domain/portal/portalProvider.types";
import {catalogItems, catalogRating, configCurrencies, filterValue, idClause, itemPagePath, newSinceClause, priceRange, samePriceCurrencyCompanies, slugOrIdClause} from "@coreModule/domain/portal/portalCatalog";
import {effectiveVehicleRates, vehicleListingTitle} from "armonia/src/modules/carRental/helpers/vehicleRates";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {freeExactCars} from "@carRentalModule/utilities/services/rentalStorefrontCars";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";
import {addressCitiesByCompany, portalListedCompanyIds, type PortalScope} from "@coreModule/utilities/marketing/portalCompanies";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {publicMediaUrl} from "@coreModule/utilities/media/publicMediaUrl";
import {rentalPortalTripSchema} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.form.validators";
import type {RentalPortalTripType} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.forms";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {type IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {busyUntil, freeVehiclesInCategory} from "@carRentalModule/utilities/services/rentalAvailability";
import {quoteTrip} from "@carRentalModule/workflows/rentalReservationService";
import {currencyOf} from "@carRentalModule/api/carRental/public/rentalStorefront";

import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";

const PORTAL_LOCALES = path.join(__dirname, "..", "..", "utilities", "emails", "static", "locales");

/** What sets one class apart in the catalog, in the visitor's language: "5 seats · Automatic". */
function classSubtitle(category: {seats: number; transmission: "manual" | "automatic"}, languageCode: string): string {
    const words = loadEmailStrings(["rentalPortal"], languageCode, PORTAL_LOCALES);
    return [applyPlaceholders(words.seats, {count: String(category.seats)}), words[category.transmission]].join(" · ");
}
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {notHiddenByPlatform} from "@coreModule/database/plugins/platformHiddenPlugin";
/** Rental companies taking public bookings (and on the apex, opted in to the portal). */
export function rentalPortalCompanyIds(scope: PortalScope) {
    return portalListedCompanyIds("carRental", {
        configModel: CarRentalConfig,
        configFilter: {publicBookingEnabled: true},
        listedOn: {listedOnPortal: true},
    }, scope);
}

/** Companies searched for a trip at once: each runs a full availability search. */
const TRIP_COMPANIES_MAX = 20;

const CATEGORY_SORTS = {newest: {createdAt: -1}, priceAsc: {dailyRate: 1}, priceDesc: {dailyRate: -1}} as const;

/** Public categories of these companies matching the query and the car filters (`f.transmission`, `f.fuel`, `f.seats`). */
function categoryClause({companyIds, query, filters}: PortalBrowseParams): Record<string, unknown> {
    // A class the platform hid after a report is gone from every portal list and page (D191).
    const clause: Record<string, unknown> = {company: {$in: companyIds}, isPublic: true, ...notHiddenByPlatform(), deletedAt: null};
    if (query) clause.name = {$regex: escapeRegex(query), $options: "i"};
    const transmission = filterValue(filters, "transmission");
    if (transmission) clause.transmission = transmission;
    const fuel = filterValue(filters, "fuel");
    if (fuel) clause.fuelType = fuel;
    const seats = Number(filterValue(filters, "seats"));
    if (seats > 0) clause.seats = {$gte: seats};
    return clause;
}

/**
 * Without dates: the public car classes at their daily rate; each opens the company's rental site. `narrowing` keeps only
 * the classes a "new since" ask is about.
 */
async function browseCategories(params: PortalBrowseParams, narrowing: Record<string, unknown> = {}) {
    const currencies = await configCurrencies(CarRentalConfig, params.companyIds);
    // Daily rates are compared only between companies charging in one currency. A group that only heads its cars
    // rented on their own is not a class to book (D198): its cars are the "vehicle" kind.
    const clause: Record<string, unknown> = {...categoryClause({...params, companyIds: samePriceCurrencyCompanies(params.companyIds, currencies, params)}), soldAsClass: {$ne: false}, ...narrowing};
    const price = priceRange(params.priceMin, params.priceMax);
    if (price) clause.dailyRate = price;
    const [categories, total] = await Promise.all([
        vehicleCategoryService.findPortalCards(clause, CATEGORY_SORTS[params.sort ?? "newest"], params.skip, params.limit),
        vehicleCategoryService.count(clause),
    ]);
    const ratings = await rentalReviewService.publishedRatingsByCategory(params.companyIds);
    const items = await catalogItems(categories, (category) => {
        const currency = currencies.get(category.company.toString());
        const rating = ratings.get(category._id.toString());
        return {
            kind: "vehicleCategory",
            id: category._id.toString(),
            title: category.name,
            subtitle: classSubtitle(category, params.languageCode),
            image: publicMediaUrl(category.images?.[0]),
            ...(currency ? {price: {amount: category.dailyRate, currency, per: "day" as const}} : {}),
            ...catalogRating(rating?.average, rating?.count),
            section: "carRental",
            // The class's web address, like the rental site's own links (the id still opens it).
            path: `/categories/${category.slug || category._id.toString()}`,
        };
    });
    return {items, total};
}

type AvailableCar = {company: ObjectId; category: IVehicleCategory; total: number; currency: string; city?: string; tripQuery: string};

/**
 * The company's cars free for the trip, at the first of its pickup locations in `city`
 * where the trip works (opening hours, lead time, length), each priced for the whole trip.
 */
async function availableInCompany(companyId: ObjectId, trip: RentalPortalTripType, params: PortalBrowseParams): Promise<AvailableCar[]> {
    const config = await carRentalConfigService.findOne({company: companyId, deletedAt: null}, {});
    if (!config) return [];
    // A company that has not set its currency cannot price a trip; it is left out rather than failing the whole search.
    const currency = await currencyOf(config, params.languageCode).catch(() => null);
    if (!currency) return [];
    const where = params.city?.toLowerCase();
    const locations = (await rentalLocationService.findPortalLocations(companyId))
        .filter((location) => !where || (location.address?.city?.name ?? "").toLowerCase().includes(where));
    for (const location of locations) {
        const id = location._id.toString();
        let resolved;
        try {
            resolved = await resolveRentalTrip({...trip, pickupLocation: id, returnLocation: id}, config, {companyId, languageCode: params.languageCode, online: true});
        } catch {
            continue;
        }
        const categories = await vehicleCategoryService.find({...categoryClause(params), soldAsClass: {$ne: false}, company: companyId}, {}, undefined, undefined, {sortOrder: 1, name: 1});
        const end = busyUntil(resolved.returnAt, config.turnaroundBufferMinutes);
        const now = new Date();
        const tripQuery = new URLSearchParams({pickupLocation: id, returnLocation: id, ...trip}).toString();
        const cars = await Promise.all(categories.map(async (category): Promise<AvailableCar | null> => {
            const free = await freeVehiclesInCategory({companyId, categoryId: category._id, start: resolved.pickupAt, end, now});
            if (free.length === 0) return null;
            const total = quoteTrip(config, category, [], resolved, {languageCode: params.languageCode}).grandTotal;
            return {company: companyId, category, total, currency: currency.abbreviation, city: location.address?.city?.name, tripQuery};
        }));
        const available = cars.filter((car): car is AvailableCar => car !== null);
        if (available.length > 0) return available;
    }
    return [];
}

/** With dates: the cars free for the trip across companies, priced for it; each opens its booking page. */
async function browseAvailable(params: PortalBrowseParams, trip: RentalPortalTripType) {
    const {priceMin, priceMax, sort} = params;
    const cars = (await Promise.all(params.companyIds.slice(0, TRIP_COMPANIES_MAX).map((companyId) => availableInCompany(companyId, trip, params)))).flat();
    // Trip prices are compared only between companies charging in one currency.
    const comparable = new Set(samePriceCurrencyCompanies(
        cars.map((car) => car.company),
        new Map(cars.map((car) => [car.company.toString(), car.currency])),
        params,
    ).map(String));
    const found = cars
        .filter((car) => comparable.has(car.company.toString()))
        .filter((car) => (priceMin == null || car.total >= priceMin) && (priceMax == null || car.total <= priceMax));
    if (sort === "priceAsc") found.sort((a, b) => a.total - b.total);
    if (sort === "priceDesc") found.sort((a, b) => b.total - a.total);
    const ratings = await rentalReviewService.publishedRatingsByCategory(params.companyIds);
    const items = await catalogItems(found.slice(params.skip, params.skip + params.limit), (car) => ({
        kind: "vehicleCategory",
        id: car.category._id.toString(),
        title: car.category.name,
        subtitle: classSubtitle(car.category, params.languageCode),
        image: publicMediaUrl(car.category.images?.[0]),
        price: {amount: car.total, currency: car.currency},
        city: car.city,
        ...catalogRating(ratings.get(car.category._id.toString())?.average, ratings.get(car.category._id.toString())?.count),
        section: "carRental",
        path: `/categories/${car.category.slug || car.category._id}?${car.tripQuery}`,
    }));
    return {items, total: found.length};
}

/** At most this many cars rented on their own are read per browse: their price depends on their group, so they are sorted in memory. */
const CARS_MAX = 2000;

/** A car rented on its own as its card names it: year and colour, then its group's seats and gearbox. */
function carSubtitle(car: IVehicle, group: IVehicleCategory, languageCode: string): string {
    const specs = {seats: car.seats ?? group.seats, transmission: car.transmission ?? group.transmission};
    return [car.year ? String(car.year) : "", car.color ?? "", classSubtitle(specs, languageCode)].filter(Boolean).join(" · ");
}

/** The photo a car's card shows: its listing photo, else its group's (never its own photos, which show the plate). */
function carImage(car: IVehicle, group: IVehicleCategory) {
    return publicMediaUrl(car.listingImages?.[0] ?? group.images?.[0]);
}

/**
 * The cars rented on their own (D198) in the public groups matching the car filters, with the query on the car's
 * name, make and model. `narrowing` applies to the cars (a "new since" ask, an item page).
 */
async function listedCars(params: PortalBrowseParams, companyIds: ObjectId[], narrowing: Record<string, unknown>) {
    const groups = await vehicleCategoryService.find(categoryClause({...params, query: undefined, companyIds}), {}, undefined, undefined, {sortOrder: 1, name: 1});
    const groupById = new Map(groups.map((group) => [String(group._id), group]));
    const clause: Record<string, unknown> = {
        company: {$in: companyIds},
        listedAlone: true,
        status: "active",
        deletedAt: null,
        ...notHiddenByPlatform(),
        category: {$in: groups.map((group) => group._id)},
        ...narrowing,
    };
    if (params.query) {
        const pattern = {$regex: escapeRegex(params.query), $options: "i"};
        clause.$or = [{listingTitle: pattern}, {make: pattern}, {model: pattern}];
    }
    const cars = await vehicleService.find(clause, {}, undefined, undefined, {createdAt: -1}, CARS_MAX);
    return cars.flatMap((car) => {
        const group = groupById.get(String(nestedEntityToRef(car.category)));
        return group ? [{car, group, company: nestedEntityToRef(car.company)!, dailyRate: effectiveVehicleRates(group, car).dailyRate}] : [];
    });
}

/** Without dates: the cars rented on their own at their day price; each opens its page on the company's rental site. */
async function browseCars(params: PortalBrowseParams, narrowing: Record<string, unknown> = {}) {
    const currencies = await configCurrencies(CarRentalConfig, params.companyIds);
    const rows = (await listedCars(params, samePriceCurrencyCompanies(params.companyIds, currencies, params), narrowing))
        .filter((row) => (params.priceMin == null || row.dailyRate >= params.priceMin) && (params.priceMax == null || row.dailyRate <= params.priceMax));
    if (params.sort === "priceAsc") rows.sort((a, b) => a.dailyRate - b.dailyRate);
    if (params.sort === "priceDesc") rows.sort((a, b) => b.dailyRate - a.dailyRate);
    const items = await catalogItems(rows.slice(params.skip, params.skip + params.limit), ({car, group, company, dailyRate}) => {
        const currency = currencies.get(company.toString());
        return {
            kind: "vehicle",
            id: car._id.toString(),
            title: vehicleListingTitle(car),
            subtitle: carSubtitle(car, group, params.languageCode),
            image: carImage(car, group),
            ...(currency ? {price: {amount: dailyRate, currency, per: "day" as const}} : {}),
            section: "carRental",
            path: `/cars/${car._id.toString()}`,
        };
    });
    return {items, total: rows.length};
}

/** With dates: the cars rented on their own free for the trip, at a pickup location in `city`, priced for it. */
async function browseAvailableCars(params: PortalBrowseParams, trip: RentalPortalTripType) {
    const found: {car: IVehicle; group: IVehicleCategory; company: ObjectId; total: number; currency: string; city?: string; tripQuery: string}[] = [];
    for (const companyId of params.companyIds.slice(0, TRIP_COMPANIES_MAX)) {
        const config = await carRentalConfigService.findOne({company: companyId, deletedAt: null}, {});
        const currency = config ? await currencyOf(config, params.languageCode).catch(() => null) : null;
        if (!config || !currency) continue;
        const rows = await listedCars(params, [companyId], {});
        if (!rows.length) continue;
        const where = params.city?.toLowerCase();
        const locations = (await rentalLocationService.findPortalLocations(companyId))
            .filter((location) => !where || (location.address?.city?.name ?? "").toLowerCase().includes(where));
        const placed = new Set<string>();
        for (const location of locations) {
            const id = location._id.toString();
            let resolved;
            try {
                resolved = await resolveRentalTrip({...trip, pickupLocation: id, returnLocation: id}, config, {companyId, languageCode: params.languageCode, online: true});
            } catch {
                continue;
            }
            const free = await freeExactCars({
                companyId,
                config,
                cars: rows.map((row) => row.car).filter((car) => !placed.has(String(car._id))),
                categories: new Map(rows.map((row) => [String(row.group._id), row.group])),
                trip: resolved,
                end: busyUntil(resolved.returnAt, config.turnaroundBufferMinutes),
                now: new Date(),
                languageCode: params.languageCode,
            });
            const tripQuery = new URLSearchParams({pickupLocation: id, returnLocation: id, ...trip}).toString();
            for (const {car, category, carTransfer} of free) {
                placed.add(String(car._id));
                const total = quoteTrip(config, category, [], resolved, {languageCode: params.languageCode, exactVehicle: car, carTransfer}).grandTotal;
                found.push({car, group: category, company: companyId, total, currency: currency.abbreviation, city: location.address?.city?.name, tripQuery});
            }
        }
    }
    // Trip prices are compared only between companies charging in one currency.
    const comparable = new Set(samePriceCurrencyCompanies(
        found.map((row) => row.company),
        new Map(found.map((row) => [row.company.toString(), row.currency])),
        params,
    ).map(String));
    const rows = found
        .filter((row) => comparable.has(row.company.toString()))
        .filter((row) => (params.priceMin == null || row.total >= params.priceMin) && (params.priceMax == null || row.total <= params.priceMax));
    if (params.sort === "priceAsc") rows.sort((a, b) => a.total - b.total);
    if (params.sort === "priceDesc") rows.sort((a, b) => b.total - a.total);
    const items = await catalogItems(rows.slice(params.skip, params.skip + params.limit), (row) => ({
        kind: "vehicle",
        id: row.car._id.toString(),
        title: vehicleListingTitle(row.car),
        subtitle: carSubtitle(row.car, row.group, params.languageCode),
        image: carImage(row.car, row.group),
        price: {amount: row.total, currency: row.currency},
        city: row.city,
        section: "carRental",
        path: `/cars/${row.car._id.toString()}?${row.tripQuery}`,
    }));
    return {items, total: rows.length};
}

/** The trip of the car filters (`f.pickupDate` …), when all of it is there and valid. */
function tripOf(params: PortalBrowseParams): RentalPortalTripType | null {
    const parsed = rentalPortalTripSchema(params.languageCode).safeParse({
        pickupDate: filterValue(params.filters, "pickupDate"),
        pickupTime: filterValue(params.filters, "pickupTime"),
        returnDate: filterValue(params.filters, "returnDate"),
        returnTime: filterValue(params.filters, "returnTime"),
    });
    // The schema is built from RentalPortalTripDef, the same def RentalPortalTripType is inferred from;
    // buildCreateZodSchema only types its result as ZodObject<any>.
    return parsed.success ? (parsed.data as RentalPortalTripType) : null;
}

/** The car rental section of the portal: companies by their locations' cities, their car classes, free cars for a trip. */
export function registerRentalPortalProvider(): void {
    registerPortalProvider({
        key: "carRental",
        order: 20,
        sitePath: "car-rental",
        // As the portal names it: the section (sinfonia `portalSectionName`) and its kinds' tabs (`portalKindName`).
        names: {
            "en-US": {title: "Car rental", description: "Compare rental companies and book a car for your dates.", kinds: {vehicleCategory: "Cars", vehicle: "Exact cars"}},
            "sq-AL": {title: "Qiraja e makinave", description: "Krahasoni kompanitë e qirasë dhe rezervoni një makinë për datat tuaja.", kinds: {vehicleCategory: "Makina", vehicle: "Makina të caktuara"}},
            "it-IT": {title: "Noleggio auto", description: "Confronta i noleggiatori e prenota un'auto per le tue date.", kinds: {vehicleCategory: "Auto", vehicle: "Auto precise"}},
            "fr-FR": {title: "Location de voitures", description: "Comparez les loueurs et réservez une voiture pour vos dates.", kinds: {vehicleCategory: "Voitures", vehicle: "Voitures précises"}},
            "de-CH": {title: "Autovermietung", description: "Vergleichen Sie Vermieter und buchen Sie ein Auto für Ihre Daten.", kinds: {vehicleCategory: "Autos", vehicle: "Bestimmte Autos"}},
        },
        // Car classes ("or similar") and the cars rented on their own (D198).
        kinds: ["vehicleCategory", "vehicle"],
        companyIds: rentalPortalCompanyIds,
        citiesByCompany: (companyIds) => addressCitiesByCompany(RentalLocation, companyIds, {isActive: true}),
        browse(params) {
            const trip = tripOf(params);
            if (params.kind === "vehicle") return trip ? browseAvailableCars(params, trip) : browseCars(params);
            return trip ? browseAvailable(params, trip) : browseCategories(params);
        },
        // Classes or cars added after the date (D178), whatever the trip: a saved trip's dates pass, its car filters stay.
        newSince: (context: PortalNewSinceContext) => context.kind === "vehicle"
            ? browseCars({...context, sort: "newest", skip: 0}, newSinceClause(context))
            : browseCategories({...context, sort: "newest", skip: 0}, newSinceClause(context)),
        // A car class's page (D181): `/categories/{slug or id}`, with or without a trip's dates.
        itemAt: async ({scope, companyId, path, languageCode}) => {
            const [page, ref] = itemPagePath(path).segments;
            // A car rented on its own (D198): `/cars/{id}`.
            if (page === "cars") {
                const clause = idClause(ref);
                if (!clause) return undefined;
                const {items} = await browseCars({kind: "vehicle", scope, companyIds: [companyId], filters: {}, skip: 0, limit: 1, languageCode}, clause);
                return items[0] ? {item: items[0], schemaType: "Product"} : undefined;
            }
            if (page !== "categories" || !ref) return undefined;
            const {items} = await browseCategories({kind: "vehicleCategory", scope, companyIds: [companyId], filters: {}, skip: 0, limit: 1, languageCode}, slugOrIdClause(ref));
            return items[0] ? {item: items[0], schemaType: "Product"} : undefined;
        },
    });
}
