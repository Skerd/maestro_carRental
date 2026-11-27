import type {Model} from "mongoose";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import RentalPromoCode from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import VehicleTransfer from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import RentalDenyEntry from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import RentalSubscription from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";
import RentalSearchStat from "@carRentalModule/database/schemas/rentalSearchStat/rentalSearchStat";
import {registerDefaultRoles} from "@coreModule/database/schemas/role/role.defaults";
import {registerPublicMediaBackfillSource} from "@coreModule/utilities/media/publicMediaBackfillRegistry";
import {carRentalDefaultRoles} from "@carRentalModule/database/schemas/role/carRental.role.defaults";
import {VehicleCategorySchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import type {SelfServeBusinessType} from "@coreModule/domain/company/selfServeBusinessTypes";
import type {AccountVerifiedHook} from "@coreModule/utilities/modules/moduleCompanyDefaults";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import VehicleCatalogEntry from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog";
import {seedVehicleCatalog} from "@carRentalModule/database/seeds/vehicleCatalog/vehicleCatalog.seed";
import {carRentalReportables} from "@carRentalModule/domain/reports/carRentalReportables";

export const carRentalModels: Model<any>[] = [
    CarRentalConfig,
    RentalLocation,
    VehicleCategory,
    Vehicle,
    VehicleBlock,
    RentalExtra,
    RentalReservation,
    VehicleInsurance,
    VehicleDocument,
    VehicleMaintenance,
    VehicleDamage,
    RentalPromoCode,
    VehicleFine,
    VehicleTransfer,
    RentalBusinessAccount,
    RentalDenyEntry,
    RentalReview,
    RentalSubscription,
    RentalSearchStat,
    VehicleCatalogEntry,
];

export async function dropCarRentalCollections(): Promise<void> {
    for (const model of carRentalModels) {
        try {
            await model.collection.drop();
        } catch {
            // collection may not exist
        }
    }
}

registerDefaultRoles(carRentalDefaultRoles);
registerPublicMediaBackfillSource({
    name: "VehicleCategory",
    schemaDef: VehicleCategorySchemaDef,
    loadModel: () =>
        import("@carRentalModule/database/schemas/vehicleCategory/vehicleCategory").then(
            (m) => m.default,
        ),
});

/** A car rental company may sign itself up on the portal; it is listed there once the platform approves it (D178). */
const selfServeBusinessTypes: SelfServeBusinessType[] = [{
    key: "carRental",
    modules: ["carRental"],
    onCreated: async ({company, session, logger, languageCode}) => {
        const config = await carRentalConfigService.getOrCreateForCompany(company._id, {session, logger, languageCode});
        // Booking online on, too: the portal and the company's own site show only a business that takes bookings, so
        // without it a self-serve business never appeared anywhere (P23.12). With nothing set up yet there is nothing
        // to book; the owner can turn it off in the settings.
        await carRentalConfigService.updateOne({_id: config._id}, {$set: {listedOnPortal: true, publicBookingEnabled: true}}, {session, logger});
    },
}];

/**
 * A guest's bookings become theirs once they hold an account with the booking's email, verified (P23.9): the portal's
 * "My bookings" lists them from then on, at whichever rental company they were made.
 */
const onAccountVerified: AccountVerifiedHook = async ({userId, email, session, logger}) => {
    const {modifiedCount} = await asCrossTenant("an account claims its guest bookings at every rental company", () =>
        rentalReservationService.claimGuestBookings(email, userId, session));
    if (modifiedCount) logger.info(`Account ${userId} claimed ${modifiedCount} guest rental booking(s)`);
};

export const moduleBootstrap = {
    models: carRentalModels,
    dropModuleCollections: dropCarRentalCollections,
    defaultRoles: carRentalDefaultRoles,
    selfServeBusinessTypes,
    onAccountVerified,
    reportables: carRentalReportables,
    // The platform's vehicle catalog (D199), seeded into the platform company at every database setup.
    platformLists: seedVehicleCatalog,
};
