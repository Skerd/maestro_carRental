import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalDenyEntry} from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";

export function rentalDenyEntrysToSelect(records: IRentalDenyEntry[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: record.reason}));
}
