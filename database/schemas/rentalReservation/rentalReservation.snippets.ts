import type {RentalReservationSimple} from "armonia/src/modules/carRental/dto/rentalReservation.dto";
import type {IRentalReservation} from "./rentalReservation";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const RentalReservationSimpleSnippet = defineSnippet<IRentalReservation, RentalReservationSimple>()({
    keys: {
        _id: {},
        number: {},
    },
});
