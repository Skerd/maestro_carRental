import type {RentalExtraSimple} from "armonia/src/modules/carRental/dto/rentalExtra.dto";
import type {IRentalExtra} from "./rentalExtra";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const RentalExtraSimpleSnippet = defineSnippet<IRentalExtra, RentalExtraSimple>()({
    keys: {
        _id: {},
        name: {},
    },
});
