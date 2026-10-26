import {registerPortalProvider} from "@coreModule/domain/portal/portalProviderRegistry";
import {
    addressCitiesByCompany,
    portalCompanyRefs,
    portalListedCompanyIds,
} from "@coreModule/utilities/marketing/portalCompanies";
import {escapeRegex} from "@coreModule/utilities/helpers";
import {publicMediaUrl} from "@coreModule/utilities/media/publicMediaUrl";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";

/** Rental companies on the portal: taking public bookings and opted in to the portal. */
export function rentalPortalCompanyIds() {
    return portalListedCompanyIds("carRental", {
        configModel: CarRentalConfig,
        configFilter: {publicBookingEnabled: true, listedOnPortal: true},
    });
}

export function rentalPortalPath(slug: string): string {
    return `/car-rental/${slug}`;
}

/** The car rental section of the portal: companies by their locations' cities, public vehicle categories by name. */
export function registerRentalPortalProvider(): void {
    registerPortalProvider({
        key: "carRental",
        order: 20,
        companyPath: (company) => rentalPortalPath(company.slug),
        listedCompanyIds: rentalPortalCompanyIds,
        citiesByCompany: (companyIds) => addressCitiesByCompany(RentalLocation, companyIds, {isActive: true}),
        async search({query, companyIds, limit}) {
            const categories = await VehicleCategory.find({
                company: {$in: companyIds},
                isPublic: true,
                deletedAt: null,
                name: {$regex: escapeRegex(query), $options: "i"},
            }).select("company name images dailyRate").sort({name: 1}).limit(limit).lean();
            const companies = await portalCompanyRefs(categories.map((category) => category.company as any));
            return categories.flatMap((category) => {
                const company = companies.get(String(category.company));
                return company ? [{
                    kind: "vehicleCategory",
                    title: category.name,
                    subtitle: company.name,
                    image: publicMediaUrl(category.images?.[0]),
                    path: rentalPortalPath(company.slug),
                    company,
                }] : [];
            });
        },
    });
}
