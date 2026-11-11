import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {restoreUnlessKeyTaken} from "@coreModule/api/restoreUnlessKeyTaken";
import {isValidTimeZone} from "@coreModule/utilities/time/timeWindows";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {RentalLocationSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalLocation/rentalLocation.schema-def";
import {createRentalLocationFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalLocation/createRentalLocation.form.validator";
import {editRentalLocationFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalLocation/editRentalLocation.form.validator";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {rentalLocationToDTO, rentalLocationsToDTO} from "@carRentalModule/utilities/mappers/rentalLocation/rentalLocationMapper.dto";
import {rentalLocationsToSelect} from "@carRentalModule/utilities/mappers/rentalLocation/rentalLocationMapper.select";
import {RentalLocationActions} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.actions";
import {withRentalCurrency} from "@carRentalModule/utilities/services/rentalCurrency";

/** The Zod contract can't compare fields, so the timezone name and each hours row are checked here. */
function assertValidSchedule(data: {timezone?: string; openingHours?: {startTime: string; endTime: string}[]}, languageCode: string): void {
    if (data.timezone !== undefined && !isValidTimeZone(data.timezone)) {
        throw apiValidationException("rental_invalid_timezone", "", null, languageCode, [data.timezone]);
    }
    for (const row of data.openingHours ?? []) {
        if (row.endTime <= row.startTime) {
            throw apiValidationException("rental_hours_end_before_start", "", null, languageCode);
        }
    }
}

export const basePath = "/api/carRental/rentalLocation";

export const {router} = createCrudRouter({
    collectionName: "rentallocations",
    model: RentalLocation,
    service: rentalLocationService,
    entityName: "RentalLocation",
    createSchema: createRentalLocationFormSchema,
    editSchema: editRentalLocationFormSchema,
    toDTO: rentalLocationToDTO,
    toDTOArray: rentalLocationsToDTO,
    // Every amount is in the rental currency (UX-07).
    enrichList: (docs, params: any) => withRentalCurrency(rentalLocationsToDTO(docs), params.company._id, params.languageCode),
    enrichSingle: async (doc, params: any) => (await withRentalCurrency([rentalLocationToDTO(doc)], params.company._id, params.languageCode))[0],
    enrichUpdate: async (doc, params: any) => (await withRentalCurrency([rentalLocationToDTO(doc)], params.company._id, params.languageCode))[0],
    toSelect: rentalLocationsToSelect,
    defaultSort: {name: 1},
    extraSelectFilter: () => ({isActive: true}),
    actions: RentalLocationActions,
    buildCreateData: (params: any) => {
        assertValidSchedule(params, params.languageCode);
        return buildCreateDataFromSchemaDef(RentalLocationSchemaDef)(params);
    },
    buildUpdateData: (params: any, writeFields) => {
        assertValidSchedule(params, params.languageCode);
        return buildUpdateDataFromSchemaDef(RentalLocationSchemaDef)(params, writeFields);
    },
    overrideRestoreHandler: restoreUnlessKeyTaken({
        model: RentalLocation,
        service: rentalLocationService,
        entityName: "RentalLocation",
        keys: ["name"],
        errorCode: "rental_location_name_taken",
    }),
});
