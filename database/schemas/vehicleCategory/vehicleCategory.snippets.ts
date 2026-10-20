import type {VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import type {IVehicleCategory} from "./vehicleCategory";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleCategorySimpleSnippet = defineSnippet<IVehicleCategory, VehicleCategorySimple>()({
    keys: {
        _id: {},
        name: {},
    },
});
