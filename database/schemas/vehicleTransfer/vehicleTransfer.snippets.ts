import type {VehicleTransferSimple} from "armonia/src/modules/carRental/dto/vehicleTransfer.dto";
import type {IVehicleTransfer} from "./vehicleTransfer";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleTransferSimpleSnippet = defineSnippet<IVehicleTransfer, VehicleTransferSimple>()({
    keys: {
        _id: {},
        status: {},
        departAt: {},
    },
});
