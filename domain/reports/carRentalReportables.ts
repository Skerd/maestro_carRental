import type {ObjectId} from "mongodb";
import type {ReportableDefinition} from "@coreModule/domain/reports/reportables";
import {portalCompanyRefs} from "@coreModule/utilities/marketing/portalCompanies";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import {RENTAL_REVIEW_REPORT_KIND} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/rentalReview.dto";

/** How much of a review's words the report desk shows as its title. */
const REVIEW_EXCERPT_MAX = 80;

/** A car class's page on the portal, inside its company's rental site (`sitePath` of the car rental portal provider). */
async function carClassPath(companyId: ObjectId, category: {_id: ObjectId; slug?: string}): Promise<string | undefined> {
    const company = (await portalCompanyRefs([companyId])).get(companyId.toString());
    return company ? `/car-rental/${company.slug}/categories/${category.slug || category._id.toString()}` : undefined;
}

/** A review as the report desk names it: its stars and the start of its words, else who wrote it. */
function reviewTitle(review: {rating: number; comment?: string; authorName: string}): string {
    const words = review.comment?.trim();
    const excerpt = words && words.length > REVIEW_EXCERPT_MAX ? `${words.slice(0, REVIEW_EXCERPT_MAX - 1)}…` : words;
    return `${"★".repeat(review.rating)} ${excerpt || review.authorName}`;
}

/**
 * What people can report to the platform about car rental (D191): a car class the portal and the rental site show, and
 * a customer's review of one. Hiding either takes it off every public page and, for a review, out of every rating.
 */
export const carRentalReportables: ReportableDefinition[] = [
    {
        kind: "carRental.carClass",
        typeLabel: {
            "en-US": "Car class",
            "de-CH": "Fahrzeugkategorie",
            "fr-FR": "Catégorie de véhicule",
            "it-IT": "Categoria di veicolo",
            "sq-AL": "Kategori automjeti",
        },
        snapshot: async ({recordId, session}) => {
            const category = await vehicleCategoryService.findReportable(recordId, session);
            if (!category) return null;
            return {
                title: category.name,
                companyId: category.company,
                url: await carClassPath(category.company, category),
                hidden: category.hiddenByPlatform === true,
            };
        },
        model: VehicleCategory,
    },
    {
        kind: RENTAL_REVIEW_REPORT_KIND,
        typeLabel: {
            "en-US": "Car rental review",
            "de-CH": "Bewertung einer Autovermietung",
            "fr-FR": "Avis sur une location de voiture",
            "it-IT": "Recensione di un noleggio auto",
            "sq-AL": "Vlerësim për qiranë e makinës",
        },
        snapshot: async ({recordId, session}) => {
            const review = await rentalReviewService.findReportable(recordId, session);
            if (!review) return null;
            // The booking names the class the review shows under and the customer's account, when they had one.
            const booking = await rentalReservationService.findOne({_id: review.reservation}, {session}, undefined, "category customer");
            const categoryId = nestedEntityToRef(booking?.category);
            const category = categoryId ? await vehicleCategoryService.findReportable(categoryId, session) : null;
            const authorAccountId = nestedEntityToRef(booking?.customer);
            return {
                title: reviewTitle(review),
                companyId: review.company,
                ...(authorAccountId ? {authorAccountId} : {}),
                url: category ? await carClassPath(review.company, category) : undefined,
                hidden: review.hiddenByPlatform === true,
            };
        },
        // Ratings are counted when they are read, so hiding the review takes it out of them at once.
        model: RentalReview,
    },
];
