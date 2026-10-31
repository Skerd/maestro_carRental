import type {IVehicleTransfer} from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import type {VehicleTransfer} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/vehicleTransfer.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import {RentalLocationSimpleSnippet} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.snippets";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {dateToISOString, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleTransferToDTO(transfer: IVehicleTransfer): VehicleTransfer {
    return {
        _id: transfer._id.toString(),
        vehicle: mapSnippet<VehicleSimple>()(transfer.vehicle, VehicleSimpleSnippet),
        fromLocation: mapSnippet<RentalLocationSimple>()(transfer.fromLocation, RentalLocationSimpleSnippet),
        toLocation: mapSnippet<RentalLocationSimple>()(transfer.toLocation, RentalLocationSimpleSnippet),
        departAt: dateToISOString(transfer.departAt),
        arriveAt: dateToISOString(transfer.arriveAt),
        driver: mapSnippet<SimpleBlankUser>()(transfer.driver, SimpleBlankUserSnippet),
        status: transfer.status,
        odometerKm: transfer.odometerKm,
        notes: transfer.notes,
        ...mapSoftDeleteToDTO(transfer),
        ...mapOwnershipToDTO(transfer),
        ...mapLifeCycleToDTO(transfer),
    };
}

export function vehicleTransfersToDTO(records: IVehicleTransfer[]): VehicleTransfer[] {
    return records.map(vehicleTransferToDTO);
}
