import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import type {Vehicle} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.dto";
import type {VehicleCategoryPriced} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import {dateToISOString, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {vehicleCatalogEntrySimpleToDTO} from "@carRentalModule/utilities/mappers/vehicleCatalog/vehicleCatalogMapper.dto";
import {VehicleCategoryPricedSnippet} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.snippets";
import {RentalLocationSimpleSnippet} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapPlatformHiddenToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleToDTO(vehicle: IVehicle): Vehicle {
    return {
        _id: vehicle._id.toString(),
        category: mapSnippet<VehicleCategoryPriced>()(vehicle.category, VehicleCategoryPricedSnippet),
        catalogMake: vehicleCatalogEntrySimpleToDTO(vehicle.catalogMake),
        catalogModel: vehicleCatalogEntrySimpleToDTO(vehicle.catalogModel),
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate,
        vin: vehicle.vin,
        color: vehicle.color,
        homeLocation: mapSnippet<RentalLocationSimple>()(vehicle.homeLocation, RentalLocationSimpleSnippet),
        readiness: vehicle.readiness ?? "ready",
        currentLocation: mapSnippet<RentalLocationSimple>()(vehicle.currentLocation, RentalLocationSimpleSnippet),
        status: vehicle.status,
        odometerKm: vehicle.odometerKm,
        notes: vehicle.notes,
        images: vehicle.images?.length ? vehicle.images.map(mapMedia).filter((media) => media !== undefined) : undefined,
        videos: vehicle.videos?.length ? vehicle.videos.map(mapMedia).filter((media) => media !== undefined) : undefined,
        acquiredAt: vehicle.acquiredAt ? dateToISOString(vehicle.acquiredAt) : undefined,
        purchasePrice: vehicle.purchasePrice,
        trackerId: vehicle.trackerId,
        lastLatitude: vehicle.lastLatitude,
        lastLongitude: vehicle.lastLongitude,
        lastReportedAt: vehicle.lastReportedAt ? dateToISOString(vehicle.lastReportedAt) : undefined,
        nextServiceDueAt: vehicle.nextServiceDueAt ? dateToISOString(vehicle.nextServiceDueAt) : undefined,
        nextServiceDueKm: vehicle.nextServiceDueKm,
        listedAlone: vehicle.listedAlone === true,
        listingTitle: vehicle.listingTitle,
        listingDescription: vehicle.listingDescription,
        listingImages: vehicle.listingImages?.length ? vehicle.listingImages.map(mapMedia).filter((media) => media !== undefined) : undefined,
        dailyRate: vehicle.dailyRate,
        weekendDailyRate: vehicle.weekendDailyRate,
        weeklyRate: vehicle.weeklyRate,
        rateSeasons: (vehicle.rateSeasons ?? []).map(({startDate, endDate, dailyRate}) => ({startDate, endDate, dailyRate})),
        depositAmount: vehicle.depositAmount,
        seats: vehicle.seats,
        doors: vehicle.doors,
        luggage: vehicle.luggage,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        ...mapPlatformHiddenToDTO(vehicle),
        ...mapSoftDeleteToDTO(vehicle),
        ...mapOwnershipToDTO(vehicle),
        ...mapLifeCycleToDTO(vehicle),
    };
}

export function vehiclesToDTO(vehicles: IVehicle[]): Vehicle[] {
    return vehicles.map(vehicleToDTO);
}
