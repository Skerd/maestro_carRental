import type {VehicleMaintenanceSimple} from "armonia/src/modules/carRental/dto/vehicleMaintenance.dto";
import type {IVehicleMaintenance} from "./vehicleMaintenance";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleMaintenanceSimpleSnippet = defineSnippet<IVehicleMaintenance, VehicleMaintenanceSimple>()({
    keys: {
        _id: {},
        type: {},
        status: {},
        provider: {},
        cost: {},
    },
});
