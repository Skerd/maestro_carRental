import type {VehicleInsuranceSimple} from "armonia/src/modules/carRental/dto/vehicleInsurance.dto";
import type {IVehicleInsurance} from "./vehicleInsurance";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleInsuranceSimpleSnippet = defineSnippet<IVehicleInsurance, VehicleInsuranceSimple>()({
    keys: {
        _id: {},
        insurer: {},
        policyNumber: {},
        coverage: {},
        status: {},
    },
});
