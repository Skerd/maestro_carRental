import type {IRentalBusinessAccount} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import type {RentalBusinessAccount} from "armonia/src/modules/carRental/api/carRental/private/rentalBusinessAccount/rentalBusinessAccount.dto";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function rentalBusinessAccountToDTO(account: IRentalBusinessAccount): RentalBusinessAccount {
    return {
        _id: account._id.toString(),
        name: account.name,
        vatNumber: account.vatNumber,
        billingEmail: account.billingEmail,
        address: account.address,
        discountPercent: account.discountPercent,
        paymentTermsDays: account.paymentTermsDays,
        isActive: account.isActive,
        notes: account.notes,
        ...mapSoftDeleteToDTO(account),
        ...mapOwnershipToDTO(account),
        ...mapLifeCycleToDTO(account),
    };
}

export function rentalBusinessAccountsToDTO(records: IRentalBusinessAccount[]): RentalBusinessAccount[] {
    return records.map(rentalBusinessAccountToDTO);
}
