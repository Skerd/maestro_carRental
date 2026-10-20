import type {IVehicleBlock} from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import type {VehicleBlock} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/vehicleBlock.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import {dateToISOString, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleBlockToDTO(block: IVehicleBlock): VehicleBlock {
    return {
        _id: block._id.toString(),
        vehicle: mapSnippet<VehicleSimple>()(block.vehicle, VehicleSimpleSnippet),
        startAt: dateToISOString(block.startAt),
        endAt: dateToISOString(block.endAt),
        reason: block.reason,
        note: block.note,
        ...mapSoftDeleteToDTO(block),
        ...mapOwnershipToDTO(block),
        ...mapLifeCycleToDTO(block),
    };
}

export function vehicleBlocksToDTO(blocks: IVehicleBlock[]): VehicleBlock[] {
    return blocks.map(vehicleBlockToDTO);
}
