import type {IVehicleDamage} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import type {VehicleDamage} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import type {RentalReservationSimple} from "armonia/src/modules/carRental/dto/rentalReservation.dto";
import {dateToISOString, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {RentalReservationSimpleSnippet} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.snippets";

export function vehicleDamageToDTO(damage: IVehicleDamage): VehicleDamage {
    return {
        _id: damage._id.toString(),
        vehicle: mapSnippet<VehicleSimple>()(damage.vehicle, VehicleSimpleSnippet),
        reservation: mapSnippet<RentalReservationSimple>()(damage.reservation, RentalReservationSimpleSnippet),
        reportedAt: dateToISOString(damage.reportedAt),
        area: damage.area,
        severity: damage.severity,
        description: damage.description,
        photos: damage.photos?.length ? damage.photos.map(mapMedia).filter((media) => media !== undefined) : undefined,
        status: damage.status,
        estimatedCost: damage.estimatedCost,
        repairCost: damage.repairCost,
        repairedAt: damage.repairedAt ? dateToISOString(damage.repairedAt) : undefined,
        ...mapSoftDeleteToDTO(damage),
        ...mapOwnershipToDTO(damage),
        ...mapLifeCycleToDTO(damage),
    };
}

export function vehicleDamagesToDTO(damages: IVehicleDamage[]): VehicleDamage[] {
    return damages.map(vehicleDamageToDTO);
}
