import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import type {IVehicle} from "./vehicle";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleSimpleSnippet = defineSnippet<IVehicle, VehicleSimple>()({
    keys: {
        _id: {},
        make: {},
        model: {},
        plate: {},
    },
});
