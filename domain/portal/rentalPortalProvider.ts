import type {ObjectId} from "mongodb";
import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import type {PortalBrowseParams} from "@coreModule/domain/portal/portalProvider.types";
import {catalogItems, configCurrencies, filterValue, priceRange} from "@coreModule/domain/portal/portalCatalog";
import {addressCitiesByCompany, portalListedCompanyIds, type PortalScope} from "@coreModule/utilities/marketing/portalCompanies";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {publicMediaUrl} from "@coreModule/utilities/media/publicMediaUrl";
import {rentalPortalTripSchema} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.form.validators";
import type {RentalPortalTripType} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.forms";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory, {type IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {busyUntil, freeVehiclesInCategory} from "@carRentalModule/utilities/services/rentalAvailability";
import {quoteTrip} from "@carRentalModule/utilities/services/rentalReservationService";
import {currencyOf} from "@carRentalModule/api/carRental/public/rentalStorefront";

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

/** Without dates: the public car classes at their daily rate; each opens the company's rental site. */
async function browseCategories(params: PortalBrowseParams) {
    const clause = categoryClause(params);
    const price = priceRange(params.priceMin, params.priceMax);
    if (price) clause.dailyRate = price;
    const [categories, total, currencies] = await Promise.all([
        VehicleCategory.find(clause)
            .select("company name images dailyRate")
            .sort(CATEGORY_SORTS[params.sort ?? "newest"])
            .skip(params.skip).limit(params.limit)
            .lean<{_id: ObjectId; company: ObjectId; name: string; images?: ObjectId[]; dailyRate: number}[]>(),
        VehicleCategory.countDocuments(clause),
        configCurrencies(CarRentalConfig, params.companyIds),
    ]);
    const items = await catalogItems(categories, (category) => {
        const currency = currencies.get(category.company.toString());
        return {
            kind: "vehicleCategory",
            id: category._id.toString(),
            title: category.name,
            image: publicMediaUrl(category.images?.[0]),
            ...(currency ? {price: {amount: category.dailyRate, currency, per: "day" as const}} : {}),
            section: "carRental",
            path: `/categories/${category._id.toString()}`,
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
    const config = await CarRentalConfig.findOne({company: companyId, deletedAt: null});
    if (!config) return [];
    const where = params.city?.toLowerCase();
    const locations = (await RentalLocation.find({company: companyId, isActive: true, pickupAllowed: true, returnAllowed: true, deletedAt: null})
        .select("name address.city")
        .populate({path: "address.city", select: "name"})
        .sort({name: 1})
        .lean<{_id: ObjectId; name: string; address?: {city?: {name?: string}}}[]>())
        .filter((location) => !where || (location.address?.city?.name ?? "").toLowerCase().includes(where));
    for (const location of locations) {
        const id = location._id.toString();
        let resolved;
        try {
            resolved = await resolveRentalTrip({...trip, pickupLocation: id, returnLocation: id}, config, {companyId, languageCode: params.languageCode, online: true});
        } catch {
            continue;
        }
        const [categories, currency] = await Promise.all([
            VehicleCategory.find({...categoryClause(params), company: companyId}).sort({sortOrder: 1, name: 1}),
            currencyOf(config, params.languageCode),
        ]);
        const end = busyUntil(resolved.returnAt, config.turnaroundBufferMinutes);
        const now = new Date();
        const tripQuery = new URLSearchParams({pickupLocation: id, returnLocation: id, ...trip}).toString();
        const cars = await Promise.all(categories.map(async (category): Promise<AvailableCar | null> => {
            const free = await freeVehiclesInCategory({companyId, categoryId: category._id, start: resolved.pickupAt, end, now});
            if (free.length === 0) return null;
            const total = quoteTrip(config, category, [], resolved).grandTotal;
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
    const found = (await Promise.all(params.companyIds.slice(0, TRIP_COMPANIES_MAX).map((companyId) => availableInCompany(companyId, trip, params))))
        .flat()
        .filter((car) => (priceMin == null || car.total >= priceMin) && (priceMax == null || car.total <= priceMax));
    if (sort === "priceAsc") found.sort((a, b) => a.total - b.total);
    if (sort === "priceDesc") found.sort((a, b) => b.total - a.total);
    const items = await catalogItems(found.slice(params.skip, params.skip + params.limit), (car) => ({
        kind: "vehicleCategory",
        id: car.category._id.toString(),
        title: car.category.name,
        image: publicMediaUrl(car.category.images?.[0]),
        price: {amount: car.total, currency: car.currency},
        city: car.city,
        section: "carRental",
        path: `/categories/${car.category._id}?${car.tripQuery}`,
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
    return parsed.success ? parsed.data : null;
}

/** The car rental section of the portal: companies by their locations' cities, their car classes, free cars for a trip. */
export function registerRentalPortalProvider(): void {
    registerPortalProvider({
        key: "carRental",
        order: 20,
        kinds: ["vehicleCategory"],
        companyIds: rentalPortalCompanyIds,
        citiesByCompany: (companyIds) => addressCitiesByCompany(RentalLocation, companyIds, {isActive: true}),
        browse(params) {
            const trip = tripOf(params);
            return trip ? browseAvailable(params, trip) : browseCategories(params);
        },
    });
}
