import type {IRentalReview} from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import type {RentalReview} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/rentalReview.dto";
import type {RentalReservationSimple} from "armonia/src/modules/carRental/dto/rentalReservation.dto";
import {RentalReservationSimpleSnippet} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.snippets";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function rentalReviewToDTO(review: IRentalReview): RentalReview {
    return {
        _id: review._id.toString(),
        reservation: mapSnippet<RentalReservationSimple>()(review.reservation, RentalReservationSimpleSnippet),
        rating: review.rating,
        comment: review.comment,
        authorName: review.authorName,
        isPublished: review.isPublished,
        ...mapSoftDeleteToDTO(review),
        ...mapOwnershipToDTO(review),
        ...mapLifeCycleToDTO(review),
    };
}

export function rentalReviewsToDTO(records: IRentalReview[]): RentalReview[] {
    return records.map(rentalReviewToDTO);
}
