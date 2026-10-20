import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";

export function carRentalConfigsToSelect(configs: ICarRentalConfig[]): ApiSelectDatum[] {
    return configs.map((config) => ({value: config._id.toString(), label: config._id.toString()}));
}
