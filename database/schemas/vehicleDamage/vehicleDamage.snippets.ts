import type {VehicleDamageSimple} from "armonia/src/modules/carRental/dto/vehicleDamage.dto";
import type {IVehicleDamage} from "./vehicleDamage";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleDamageSimpleSnippet = defineSnippet<IVehicleDamage, VehicleDamageSimple>()({
    keys: {
        _id: {},
        area: {},
        severity: {},
        status: {},
        description: {},
    },
});
