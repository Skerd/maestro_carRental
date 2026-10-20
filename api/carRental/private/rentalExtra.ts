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
    toSelect: rentalExtrasToSelect,
    defaultSort: {sortOrder: 1, name: 1},
    extraSelectFilter: () => ({isActive: true}),
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
