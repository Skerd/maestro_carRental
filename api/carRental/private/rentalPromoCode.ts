import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {RentalPromoCodeSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/rentalPromoCode.schema-def";
import {createRentalPromoCodeFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/createRentalPromoCode.form.validator";
import {editRentalPromoCodeFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/editRentalPromoCode.form.validator";
import RentalPromoCode from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import {rentalPromoCodeService} from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode.service";
import {rentalPromoCodeToDTO, rentalPromoCodesToDTO} from "@carRentalModule/utilities/mappers/rentalPromoCode/rentalPromoCodeMapper.dto";
import {rentalPromoCodesToSelect} from "@carRentalModule/utilities/mappers/rentalPromoCode/rentalPromoCodeMapper.select";
import {withRentalCurrency} from "@carRentalModule/utilities/services/rentalCurrency";

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
    // Every amount is in the rental currency (UX-07).
    enrichList: (docs, params: any) => withRentalCurrency(rentalPromoCodesToDTO(docs), params.company._id, params.languageCode),
    enrichSingle: async (doc, params: any) => (await withRentalCurrency([rentalPromoCodeToDTO(doc)], params.company._id, params.languageCode))[0],
    enrichUpdate: async (doc, params: any) => (await withRentalCurrency([rentalPromoCodeToDTO(doc)], params.company._id, params.languageCode))[0],
    toSelect: rentalPromoCodesToSelect,
    selectSearchField: "code",
    defaultSort: {code: 1},
    buildCreateData: buildCreateDataFromSchemaDef(RentalPromoCodeSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(RentalPromoCodeSchemaDef),
});
