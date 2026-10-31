import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalSubscription, {IRentalSubscription} from "./rentalSubscription";

export class RentalSubscriptionService extends BaseCrudService<IRentalSubscription, typeof RentalSubscription> {
    constructor() {
        super(RentalSubscription, "RentalSubscription");
    }
}

export const rentalSubscriptionService = new RentalSubscriptionService();
