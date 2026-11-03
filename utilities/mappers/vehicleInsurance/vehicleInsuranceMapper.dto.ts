import type {IVehicleInsurance} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import type {VehicleInsurance} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import {dateToISOString, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import type {VehicleInsuranceSimple} from "armonia/src/modules/carRental/dto/vehicleInsurance.dto";
import {VehicleInsuranceSimpleSnippet} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleInsuranceToDTO(policy: IVehicleInsurance): VehicleInsurance {
    return {
        _id: policy._id.toString(),
        vehicle: mapSnippet<VehicleSimple>()(policy.vehicle, VehicleSimpleSnippet),
        insurer: policy.insurer,
        policyNumber: policy.policyNumber,
        coverage: policy.coverage,
        validFrom: dateToISOString(policy.validFrom),
        expiresAt: dateToISOString(policy.expiresAt),
        premium: policy.premium,
        deductible: policy.deductible,
        status: policy.status,
        attachments: policy.attachments?.length ? policy.attachments.map(mapMedia).filter((media) => media !== undefined) : undefined,
        notes: policy.notes,
        supersedes: mapSnippet<VehicleInsuranceSimple>()(policy.supersedes, VehicleInsuranceSimpleSnippet),
        supersededBy: mapSnippet<VehicleInsuranceSimple>()(policy.supersededBy, VehicleInsuranceSimpleSnippet),
        ...mapSoftDeleteToDTO(policy),
        ...mapOwnershipToDTO(policy),
        ...mapLifeCycleToDTO(policy),
    };
}

export function vehicleInsurancesToDTO(policys: IVehicleInsurance[]): VehicleInsurance[] {
    return policys.map(vehicleInsuranceToDTO);
}
