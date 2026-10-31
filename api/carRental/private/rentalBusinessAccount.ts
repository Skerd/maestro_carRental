import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {RentalBusinessAccountSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalBusinessAccount/rentalBusinessAccount.schema-def";
import {createRentalBusinessAccountFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalBusinessAccount/createRentalBusinessAccount.form.validator";
import {editRentalBusinessAccountFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalBusinessAccount/editRentalBusinessAccount.form.validator";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import {rentalBusinessAccountService} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount.service";
import {rentalBusinessAccountToDTO, rentalBusinessAccountsToDTO} from "@carRentalModule/utilities/mappers/rentalBusinessAccount/rentalBusinessAccountMapper.dto";
import {rentalBusinessAccountsToSelect} from "@carRentalModule/utilities/mappers/rentalBusinessAccount/rentalBusinessAccountMapper.select";

export const basePath = "/api/carRental/rentalBusinessAccount";

export const {router} = createCrudRouter({
    collectionName: "rentalbusinessaccounts",
    model: RentalBusinessAccount,
    service: rentalBusinessAccountService,
    entityName: "RentalBusinessAccount",
    createSchema: createRentalBusinessAccountFormSchema,
    editSchema: editRentalBusinessAccountFormSchema,
    toDTO: rentalBusinessAccountToDTO,
    toDTOArray: rentalBusinessAccountsToDTO,
    toSelect: rentalBusinessAccountsToSelect,
    selectSearchField: "name",
    defaultSort: {name: 1},
    buildCreateData: buildCreateDataFromSchemaDef(RentalBusinessAccountSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(RentalBusinessAccountSchemaDef),
});
