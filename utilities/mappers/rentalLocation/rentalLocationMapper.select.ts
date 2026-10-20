import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalLocation} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";

export function rentalLocationsToSelect(locations: IRentalLocation[]): ApiSelectDatum[] {
    return locations.map((location) => ({value: location._id.toString(), label: location.name}));
}
