import type {IRentalExtra} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import type {RentalExtra} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.dto";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function rentalExtraToDTO(extra: IRentalExtra): RentalExtra {
    return {
        _id: extra._id.toString(),
        name: extra.name,
        kind: extra.kind,
        description: extra.description,
        pricing: extra.pricing,
        price: extra.price,
        maxQuantity: extra.maxQuantity,
        excessAmount: extra.excessAmount,
        depositAmount: extra.depositAmount,
        isActive: extra.isActive,
        sortOrder: extra.sortOrder,
        ...mapSoftDeleteToDTO(extra),
        ...mapOwnershipToDTO(extra),
        ...mapLifeCycleToDTO(extra),
    };
}

export function rentalExtrasToDTO(extras: IRentalExtra[]): RentalExtra[] {
    return extras.map(rentalExtraToDTO);
}
