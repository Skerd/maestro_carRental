import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import type {IRentalLocation} from "./rentalLocation";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const RentalLocationSimpleSnippet = defineSnippet<IRentalLocation, RentalLocationSimple>()({
    keys: {
        _id: {},
        name: {},
        timezone: {},
    },
});
