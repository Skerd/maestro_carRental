import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalBusinessAccount} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";

export function rentalBusinessAccountsToSelect(records: IRentalBusinessAccount[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: record.name}));
}
