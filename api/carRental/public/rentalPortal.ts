import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {type NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {portalCompanyCards} from "@coreModule/utilities/marketing/portalCompanies";
import {rentalPortalSearchFormSchema} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.form.validators";
import type {RentalPortalSearchFormType} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.forms";
import type {
    RentalPortalSearchResponse,
    RentalPortalSearchResult,
} from "armonia/src/modules/carRental/api/carRental/public/rentalPortal/rentalPortal.response.types";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {rentalPortalCompanyIds} from "@carRentalModule/domain/portal/rentalPortalProvider";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {busyUntil, freeVehiclesInCategory} from "@carRentalModule/utilities/services/rentalAvailability";
import {quoteTrip} from "@carRentalModule/utilities/services/rentalReservationService";
import {categoryToStorefront, currencyOf, publicCategories} from "./rentalStorefront";

/**
 * Car rental on the central portal (Public)
 *
 * - POST /search — cars free for a trip across every listed rental company, each at its
 *   pickup location in the searched city. Companies are searched a page at a time.
 *
 * Booking itself goes through `rentalStorefront` with the company in `x-site-company`.
 */
export const basePath = "/api/carRental/rentalPortal";
export const router = Router();

const DEFAULT_PAGE = 5;

/** The company's open pickup locations, those in `city` first-and-only when a city is given. */
async function pickupLocationsIn(companyId: ObjectId, city: string) {
    const locations = await RentalLocation.find({company: companyId, isActive: true, pickupAllowed: true, returnAllowed: true, deletedAt: null})
        .populate({path: "address.city", select: "name"})
        .sort({name: 1});
    const where = city.trim().toLowerCase();
    return where
        ? locations.filter((location) => ((location.address?.city as any)?.name ?? "").toLowerCase().includes(where))
        : locations;
}

/**
 * The first of the company's locations where the trip is possible (opening hours, lead
 * time, length), with every public category that has a car free and its price.
 */
async function searchCompany(companyId: ObjectId, params: RentalPortalSearchFormType, languageCode: string): Promise<Omit<RentalPortalSearchResult, "company"> | null> {
    const config = await CarRentalConfig.findOne({company: companyId, deletedAt: null});
    if (!config) return null;
    for (const location of await pickupLocationsIn(companyId, params.city ?? "")) {
        const id = location._id.toString();
        let trip;
        try {
            trip = await resolveRentalTrip({...params, pickupLocation: id, returnLocation: id}, config, {companyId, languageCode, online: true});
        } catch {
            continue;
        }
        const [categories, currency] = await Promise.all([publicCategories(companyId), currencyOf(config, languageCode)]);
        const end = busyUntil(trip.returnAt, config.turnaroundBufferMinutes);
        const now = new Date();
        const results = (await Promise.all(categories.map(async (category) => {
            const free = await freeVehiclesInCategory({companyId, categoryId: category._id, start: trip.pickupAt, end, now});
            return free.length > 0 ? {category: categoryToStorefront(category), quote: {...quoteTrip(config, category, [], trip), currency}} : null;
        }))).filter((result): result is NonNullable<typeof result> => result !== null);
        if (results.length === 0) continue;
        return {location: {_id: id, name: location.name}, pickupAt: trip.pickupAt.toISOString(), returnAt: trip.returnAt.toISOString(), results};
    }
    return null;
}

router.post(
    "/search",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 20}),
    validateFormZod(rentalPortalSearchFormSchema),
    asyncHandler(async (params: NotAuthenticatedMWType & RentalPortalSearchFormType): Promise<RentalPortalSearchResponse> => {
        const {languageCode, offset = 0, limit = DEFAULT_PAGE} = params;
        const cards = await portalCompanyCards(await rentalPortalCompanyIds(), new Map());
        const page = cards.slice(offset, offset + limit);
        const found = await Promise.all(page.map(async (card) => {
            const match = await searchCompany(new ObjectId(card._id), params, languageCode);
            return match ? {company: card, ...match} : null;
        }));
        return {data: found.filter((result): result is RentalPortalSearchResult => result !== null), total: cards.length};
    }),
);
