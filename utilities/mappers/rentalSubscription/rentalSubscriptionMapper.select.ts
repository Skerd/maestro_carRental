import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalSubscription} from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";

export function rentalSubscriptionsToSelect(records: IRentalSubscription[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: record.contactName}));
}
