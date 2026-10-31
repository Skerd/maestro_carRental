import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalPromoCode} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";

export function rentalPromoCodesToSelect(records: IRentalPromoCode[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: record.code}));
}
