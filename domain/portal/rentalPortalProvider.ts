import * as path from "path";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import type {ObjectId} from "mongodb";
import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalBrowseParams, PortalNewSinceContext} from "@coreModule/domain/portal/portalProvider.types";
import {catalogItems, catalogRating, configCurrencies, filterValue, itemPagePath, newSinceClause, priceRange, samePriceCurrencyCompanies, slugOrIdClause} from "@coreModule/domain/portal/portalCatalog";
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
    const clause: Record<string, unknown> = {company: {$in: companyIds}, isPublic: true, deletedAt: null};
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
    // Daily rates are compared only between companies charging in one currency.
    const clause = {...categoryClause({...params, companyIds: samePriceCurrencyCompanies(params.companyIds, currencies, params)}), ...narrowing};
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
        const categories = await vehicleCategoryService.find({...categoryClause(params), company: companyId}, {}, undefined, undefined, {sortOrder: 1, name: 1});
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
            "en-US": {title: "Car rental", description: "Compare rental companies and book a car for your dates.", kinds: {vehicleCategory: "Cars"}},
            "sq-AL": {title: "Qiraja e makinave", description: "Krahasoni kompanitë e qirasë dhe rezervoni një makinë për datat tuaja.", kinds: {vehicleCategory: "Makina"}},
            "it-IT": {title: "Noleggio auto", description: "Confronta i noleggiatori e prenota un'auto per le tue date.", kinds: {vehicleCategory: "Auto"}},
            "fr-FR": {title: "Location de voitures", description: "Comparez les loueurs et réservez une voiture pour vos dates.", kinds: {vehicleCategory: "Voitures"}},
            "de-CH": {title: "Autovermietung", description: "Vergleichen Sie Vermieter und buchen Sie ein Auto für Ihre Daten.", kinds: {vehicleCategory: "Autos"}},
        },
        kinds: ["vehicleCategory"],
        companyIds: rentalPortalCompanyIds,
        citiesByCompany: (companyIds) => addressCitiesByCompany(RentalLocation, companyIds, {isActive: true}),
        browse(params) {
            const trip = tripOf(params);
            return trip ? browseAvailable(params, trip) : browseCategories(params);
        },
        // Car classes added after the date (D178), whatever the trip: a saved trip's dates pass, its car filters stay.
        newSince: (context: PortalNewSinceContext) => browseCategories({...context, sort: "newest", skip: 0}, newSinceClause(context)),
        // A car class's page (D181): `/categories/{slug or id}`, with or without a trip's dates.
        itemAt: async ({scope, companyId, path, languageCode}) => {
            const [page, ref] = itemPagePath(path).segments;
            if (page !== "categories" || !ref) return undefined;
            const {items} = await browseCategories({kind: "vehicleCategory", scope, companyIds: [companyId], filters: {}, skip: 0, limit: 1, languageCode}, slugOrIdClause(ref));
            return items[0] ? {item: items[0], schemaType: "Product"} : undefined;
        },
    });
}
