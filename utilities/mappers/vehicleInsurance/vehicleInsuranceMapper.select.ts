import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleInsurance} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";

export function vehicleInsurancesToSelect(policies: IVehicleInsurance[]): ApiSelectDatum[] {
    return policies.map((policy) => ({value: policy._id.toString(), label: `${policy.policyNumber} · ${policy.insurer}`}));
}
