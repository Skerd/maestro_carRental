import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalBusinessAccount, {IRentalBusinessAccount} from "./rentalBusinessAccount";

export class RentalBusinessAccountService extends BaseCrudService<IRentalBusinessAccount, typeof RentalBusinessAccount> {
    constructor() {
        super(RentalBusinessAccount, "RentalBusinessAccount");
    }
}

export const rentalBusinessAccountService = new RentalBusinessAccountService();
