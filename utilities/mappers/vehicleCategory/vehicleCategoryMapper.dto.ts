import type {IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import type {VehicleCategory} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.dto";
import {mapMedia} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleCategoryToDTO(category: IVehicleCategory): VehicleCategory {
    return {
        _id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        description: category.description,
        images: category.images?.length ? category.images.map(mapMedia).filter((media) => media !== undefined) : undefined,
        seats: category.seats,
        doors: category.doors,
        luggage: category.luggage,
        transmission: category.transmission,
        fuelType: category.fuelType,
        features: category.features ?? [],
        dailyRate: category.dailyRate,
        weekendDailyRate: category.weekendDailyRate,
        weeklyRate: category.weeklyRate,
        rateSeasons: (category.rateSeasons ?? []).map(({startDate, endDate, dailyRate}) => ({startDate, endDate, dailyRate})),
        depositAmount: category.depositAmount,
        mileagePolicy: category.mileagePolicy,
        includedKmPerDay: category.includedKmPerDay,
        extraKmPrice: category.extraKmPrice,
        minDriverAge: category.minDriverAge,
        isPublic: category.isPublic,
        sortOrder: category.sortOrder,
        ...mapSoftDeleteToDTO(category),
        ...mapOwnershipToDTO(category),
        ...mapLifeCycleToDTO(category),
    };
}

export function vehicleCategoriesToDTO(categories: IVehicleCategory[]): VehicleCategory[] {
    return categories.map(vehicleCategoryToDTO);
}
