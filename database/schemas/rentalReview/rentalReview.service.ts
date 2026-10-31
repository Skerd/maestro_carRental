import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalReview, {IRentalReview} from "./rentalReview";

export class RentalReviewService extends BaseCrudService<IRentalReview, typeof RentalReview> {
    constructor() {
        super(RentalReview, "RentalReview");
    }
}

export const rentalReviewService = new RentalReviewService();
