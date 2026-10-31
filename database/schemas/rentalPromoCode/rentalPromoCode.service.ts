import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalPromoCode, {IRentalPromoCode} from "./rentalPromoCode";

export class RentalPromoCodeService extends BaseCrudService<IRentalPromoCode, typeof RentalPromoCode> {
    constructor() {
        super(RentalPromoCode, "RentalPromoCode");
    }
}

export const rentalPromoCodeService = new RentalPromoCodeService();
