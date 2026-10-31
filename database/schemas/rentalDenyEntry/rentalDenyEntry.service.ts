import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalDenyEntry, {IRentalDenyEntry} from "./rentalDenyEntry";

export class RentalDenyEntryService extends BaseCrudService<IRentalDenyEntry, typeof RentalDenyEntry> {
    constructor() {
        super(RentalDenyEntry, "RentalDenyEntry");
    }
}

export const rentalDenyEntryService = new RentalDenyEntryService();
