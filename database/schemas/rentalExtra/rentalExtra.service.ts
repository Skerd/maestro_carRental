import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalExtra, {IRentalExtra} from "./rentalExtra";

export class RentalExtraService extends BaseCrudService<IRentalExtra, typeof RentalExtra> {
    constructor() {
        super(RentalExtra, "RentalExtra");
    }
}

export const rentalExtraService = new RentalExtraService();
