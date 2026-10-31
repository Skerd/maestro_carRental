import type {IVehicleFine} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import type {VehicleFine} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import type {RentalReservationSimple} from "armonia/src/modules/carRental/dto/rentalReservation.dto";
import {RentalReservationSimpleSnippet} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.snippets";
import {dateToISOString, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleFineToDTO(fine: IVehicleFine): VehicleFine {
    return {
        _id: fine._id.toString(),
        reference: fine.reference,
        vehicle: mapSnippet<VehicleSimple>()(fine.vehicle, VehicleSimpleSnippet),
        offenceAt: dateToISOString(fine.offenceAt),
        type: fine.type,
        authority: fine.authority,
        amount: fine.amount,
        place: fine.place,
        dueDate: fine.dueDate ? dateToISOString(fine.dueDate) : undefined,
        status: fine.status,
        reservation: mapSnippet<RentalReservationSimple>()(fine.reservation, RentalReservationSimpleSnippet),
        driverName: fine.driverName,
        chargedAmount: fine.chargedAmount,
        attachments: fine.attachments?.length ? fine.attachments.map(mapMedia).filter((media) => media !== undefined) : undefined,
        notes: fine.notes,
        ...mapSoftDeleteToDTO(fine),
        ...mapOwnershipToDTO(fine),
        ...mapLifeCycleToDTO(fine),
    };
}

export function vehicleFinesToDTO(records: IVehicleFine[]): VehicleFine[] {
    return records.map(vehicleFineToDTO);
}
