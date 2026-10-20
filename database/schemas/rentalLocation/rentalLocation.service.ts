import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalLocation, {IRentalLocation} from "./rentalLocation";

export class RentalLocationService extends BaseCrudService<IRentalLocation, typeof RentalLocation> {
    constructor() {
        super(RentalLocation, "RentalLocation");
    }
}

export const rentalLocationService = new RentalLocationService();
