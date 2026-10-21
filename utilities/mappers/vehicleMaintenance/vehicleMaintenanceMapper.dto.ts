import type {IVehicleMaintenance} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import type {VehicleMaintenance} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenance.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import {dateToISOString, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleMaintenanceToDTO(record: IVehicleMaintenance): VehicleMaintenance {
    return {
        _id: record._id.toString(),
        vehicle: mapSnippet<VehicleSimple>()(record.vehicle, VehicleSimpleSnippet),
        type: record.type,
        status: record.status,
        serviceDate: dateToISOString(record.serviceDate),
        odometerKm: record.odometerKm,
        provider: record.provider,
        cost: record.cost,
        description: record.description,
        nextDueAt: record.nextDueAt ? dateToISOString(record.nextDueAt) : undefined,
        nextDueKm: record.nextDueKm,
        attachments: record.attachments?.length ? record.attachments.map(mapMedia).filter((media) => media !== undefined) : undefined,
        ...mapSoftDeleteToDTO(record),
        ...mapOwnershipToDTO(record),
        ...mapLifeCycleToDTO(record),
    };
}

export function vehicleMaintenancesToDTO(records: IVehicleMaintenance[]): VehicleMaintenance[] {
    return records.map(vehicleMaintenanceToDTO);
}
