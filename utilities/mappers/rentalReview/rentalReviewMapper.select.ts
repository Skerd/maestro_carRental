import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IRentalReview} from "@carRentalModule/database/schemas/rentalReview/rentalReview";

export function rentalReviewsToSelect(records: IRentalReview[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: record.authorName}));
}
