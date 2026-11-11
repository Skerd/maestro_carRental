import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {restoreUnlessKeyTaken} from "@coreModule/api/restoreUnlessKeyTaken";
import {RentalExtraSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.schema-def";
import {createRentalExtraFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/createRentalExtra.form.validator";
import {editRentalExtraFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/editRentalExtra.form.validator";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import {rentalExtraService} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.service";
import {rentalExtraToDTO, rentalExtrasToDTO} from "@carRentalModule/utilities/mappers/rentalExtra/rentalExtraMapper.dto";
import {rentalExtrasToSelect} from "@carRentalModule/utilities/mappers/rentalExtra/rentalExtraMapper.select";
import {RentalExtraActions} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.actions";
import {withRentalCurrency} from "@carRentalModule/utilities/services/rentalCurrency";

export const basePath = "/api/carRental/rentalExtra";

export const {router} = createCrudRouter({
    collectionName: "rentalextras",
    model: RentalExtra,
    service: rentalExtraService,
    entityName: "RentalExtra",
    createSchema: createRentalExtraFormSchema,
    editSchema: editRentalExtraFormSchema,
    toDTO: rentalExtraToDTO,
    toDTOArray: rentalExtrasToDTO,
    // Every amount is in the rental currency (UX-07).
    enrichList: (docs, params: any) => withRentalCurrency(rentalExtrasToDTO(docs), params.company._id, params.languageCode),
    enrichSingle: async (doc, params: any) => (await withRentalCurrency([rentalExtraToDTO(doc)], params.company._id, params.languageCode))[0],
    enrichUpdate: async (doc, params: any) => (await withRentalCurrency([rentalExtraToDTO(doc)], params.company._id, params.languageCode))[0],
    toSelect: rentalExtrasToSelect,
    defaultSort: {sortOrder: 1, name: 1},
    extraSelectFilter: () => ({isActive: true}),
    actions: RentalExtraActions,
    buildCreateData: buildCreateDataFromSchemaDef(RentalExtraSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(RentalExtraSchemaDef),
    overrideRestoreHandler: restoreUnlessKeyTaken({
        model: RentalExtra,
        service: rentalExtraService,
        entityName: "RentalExtra",
        keys: ["name"],
        errorCode: "rental_extra_name_taken",
    }),
});
