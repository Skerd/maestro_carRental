import type {VehicleCategoryPriced, VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import type {IVehicleCategory} from "./vehicleCategory";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleCategorySimpleSnippet = defineSnippet<IVehicleCategory, VehicleCategorySimple>()({
    keys: {
        _id: {},
        name: {},
    },
});

/** A car's category with its prices, for the car's sheet (D198, TD-F173). */
export const VehicleCategoryPricedSnippet = defineSnippet<IVehicleCategory, VehicleCategoryPriced>()({
    keys: {
        _id: {},
        name: {},
        dailyRate: {},
        weekendDailyRate: {},
        weeklyRate: {},
        depositAmount: {},
    },
});
