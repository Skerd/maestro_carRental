import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalExtra} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";

export function rentalExtrasToSelect(extras: IRentalExtra[]): ApiSelectDatum[] {
    return extras.map((extra) => ({value: extra._id.toString(), label: extra.name}));
}
