import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {
    buildCreateDataFromSchemaDef,
    buildUpdateDataFromSchemaDef,
} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {RentalDenyEntrySchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalDenyEntry/rentalDenyEntry.schema-def";
import {createRentalDenyEntryFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalDenyEntry/createRentalDenyEntry.form.validator";
import {editRentalDenyEntryFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalDenyEntry/editRentalDenyEntry.form.validator";
import RentalDenyEntry from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";
import {rentalDenyEntryService} from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry.service";
import {
    rentalDenyEntryToDTO,
    rentalDenyEntrysToDTO,
} from "@carRentalModule/utilities/mappers/rentalDenyEntry/rentalDenyEntryMapper.dto";
import {rentalDenyEntrysToSelect} from "@carRentalModule/utilities/mappers/rentalDenyEntry/rentalDenyEntryMapper.select";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";

function denyIdentity(
    data: {email?: string; licenseNumber?: string},
    languageCode: string,
) {
    const email = data.email?.trim().toLowerCase() || undefined;
    const licenseNumber = data.licenseNumber?.trim().toUpperCase() || undefined;
    if (!email && !licenseNumber)
        throw apiValidationException(
            "rental_deny_needs_identifier",
            "",
            null,
            languageCode,
        );
    return {email, licenseNumber};
}

export const basePath = "/api/carRental/rentalDenyEntry";

export const {router} = createCrudRouter({
    collectionName: "rentaldenyentries",
    model: RentalDenyEntry,
    service: rentalDenyEntryService,
    entityName: "RentalDenyEntry",
    createSchema: createRentalDenyEntryFormSchema,
    editSchema: editRentalDenyEntryFormSchema,
    toDTO: rentalDenyEntryToDTO,
    toDTOArray: rentalDenyEntrysToDTO,
    toSelect: rentalDenyEntrysToSelect,
    selectSearchField: "reason",
    defaultSort: {createdAt: -1},
    buildCreateData: async (params: any) => {
        const data = await buildCreateDataFromSchemaDef(
            RentalDenyEntrySchemaDef,
        )(params);
        return {...data, ...denyIdentity(data, params.languageCode)};
    },
    buildUpdateData: async (params: any, writeFields: any) => {
        const data = await buildUpdateDataFromSchemaDef(
            RentalDenyEntrySchemaDef,
        )(params, writeFields);
        const email = "email" in data ? data.email : params.email;
        const licenseNumber =
            "licenseNumber" in data ? data.licenseNumber : params.licenseNumber;
        return {
            ...data,
            ...denyIdentity({email, licenseNumber}, params.languageCode),
        };
    },
});
