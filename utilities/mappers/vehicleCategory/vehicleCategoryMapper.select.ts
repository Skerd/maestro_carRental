import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";

export function vehicleCategoriesToSelect(categories: IVehicleCategory[]): ApiSelectDatum[] {
    return categories.map((category) => ({value: category._id.toString(), label: category.name}));
}
