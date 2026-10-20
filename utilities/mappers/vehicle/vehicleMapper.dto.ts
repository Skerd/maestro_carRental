import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import type {Vehicle} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.dto";
import type {VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {VehicleCategorySimpleSnippet} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.snippets";
import {RentalLocationSimpleSnippet} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleToDTO(vehicle: IVehicle): Vehicle {
    return {
        _id: vehicle._id.toString(),
        category: mapSnippet<VehicleCategorySimple>()(vehicle.category, VehicleCategorySimpleSnippet),
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate,
        vin: vehicle.vin,
        color: vehicle.color,
        homeLocation: mapSnippet<RentalLocationSimple>()(vehicle.homeLocation, RentalLocationSimpleSnippet),
        status: vehicle.status,
        odometerKm: vehicle.odometerKm,
        notes: vehicle.notes,
        ...mapSoftDeleteToDTO(vehicle),
        ...mapOwnershipToDTO(vehicle),
        ...mapLifeCycleToDTO(vehicle),
    };
}

export function vehiclesToDTO(vehicles: IVehicle[]): Vehicle[] {
    return vehicles.map(vehicleToDTO);
}
