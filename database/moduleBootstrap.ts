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
import {registerDefaultRoles} from "@coreModule/database/schemas/role/role.defaults";
import {registerPublicMediaBackfillSource} from "@coreModule/utilities/media/publicMediaBackfillRegistry";
import {carRentalDefaultRoles} from "@carRentalModule/database/schemas/role/carRental.role.defaults";
import {VehicleCategorySchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";

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
    loadModel: () => import("@carRentalModule/database/schemas/vehicleCategory/vehicleCategory").then((m) => m.default),
});

export const moduleBootstrap = {
    models: carRentalModels,
    dropModuleCollections: dropCarRentalCollections,
    defaultRoles: carRentalDefaultRoles,
};
