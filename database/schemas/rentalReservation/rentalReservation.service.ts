import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalReservation, {IRentalReservation} from "./rentalReservation";

export class RentalReservationService extends BaseCrudService<IRentalReservation, typeof RentalReservation> {
    constructor() {
        super(RentalReservation, "RentalReservation");
    }
}

export const rentalReservationService = new RentalReservationService();
