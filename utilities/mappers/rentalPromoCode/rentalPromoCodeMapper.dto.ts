import type {IRentalPromoCode} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import type {RentalPromoCode} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/rentalPromoCode.dto";
import type {VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import {VehicleCategorySimpleSnippet} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.snippets";
import {dateToISOString, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function rentalPromoCodeToDTO(promo: IRentalPromoCode): RentalPromoCode {
    return {
        _id: promo._id.toString(),
        code: promo.code,
        type: promo.type,
        value: promo.value,
        category: mapSnippet<VehicleCategorySimple>()(promo.category, VehicleCategorySimpleSnippet),
        bookableFrom: promo.bookableFrom ? dateToISOString(promo.bookableFrom) : undefined,
        bookableUntil: promo.bookableUntil ? dateToISOString(promo.bookableUntil) : undefined,
        tripFrom: promo.tripFrom ? dateToISOString(promo.tripFrom) : undefined,
        tripUntil: promo.tripUntil ? dateToISOString(promo.tripUntil) : undefined,
        minRentalDays: promo.minRentalDays,
        usageLimit: promo.usageLimit,
        usageLimitPerEmail: promo.usageLimitPerEmail,
        usageCount: promo.usageCount,
        isActive: promo.isActive,
        description: promo.description,
        ...mapSoftDeleteToDTO(promo),
        ...mapOwnershipToDTO(promo),
        ...mapLifeCycleToDTO(promo),
    };
}

export function rentalPromoCodesToDTO(records: IRentalPromoCode[]): RentalPromoCode[] {
    return records.map(rentalPromoCodeToDTO);
}
