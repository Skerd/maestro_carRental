import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {RentalPromoCodeSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/rentalPromoCode.schema-def";
import {createRentalPromoCodeFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/createRentalPromoCode.form.validator";
import {editRentalPromoCodeFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/editRentalPromoCode.form.validator";
import RentalPromoCode from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import {rentalPromoCodeService} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode.service";
import {rentalPromoCodeToDTO, rentalPromoCodesToDTO} from "@carRentalModule/utilities/mappers/rentalPromoCode/rentalPromoCodeMapper.dto";
import {rentalPromoCodesToSelect} from "@carRentalModule/utilities/mappers/rentalPromoCode/rentalPromoCodeMapper.select";

export const basePath = "/api/carRental/rentalPromoCode";

export const {router} = createCrudRouter({
    collectionName: "rentalpromocodes",
    model: RentalPromoCode,
    service: rentalPromoCodeService,
    entityName: "RentalPromoCode",
    createSchema: createRentalPromoCodeFormSchema,
    editSchema: editRentalPromoCodeFormSchema,
    toDTO: rentalPromoCodeToDTO,
    toDTOArray: rentalPromoCodesToDTO,
    toSelect: rentalPromoCodesToSelect,
    selectSearchField: "code",
    defaultSort: {code: 1},
    buildCreateData: buildCreateDataFromSchemaDef(RentalPromoCodeSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(RentalPromoCodeSchemaDef),
});
