import type {IRentalDenyEntry} from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";
import type {RentalDenyEntry} from "armonia/src/modules/carRental/api/carRental/private/rentalDenyEntry/rentalDenyEntry.dto";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function rentalDenyEntryToDTO(entry: IRentalDenyEntry): RentalDenyEntry {
    return {
        _id: entry._id.toString(),
        email: entry.email,
        licenseNumber: entry.licenseNumber,
        reason: entry.reason,
        isActive: entry.isActive,
        ...mapSoftDeleteToDTO(entry),
        ...mapOwnershipToDTO(entry),
        ...mapLifeCycleToDTO(entry),
    };
}

export function rentalDenyEntrysToDTO(records: IRentalDenyEntry[]): RentalDenyEntry[] {
    return records.map(rentalDenyEntryToDTO);
}
