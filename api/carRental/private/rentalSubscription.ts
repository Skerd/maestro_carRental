import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {RentalSubscriptionSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalSubscription/rentalSubscription.schema-def";
import {createRentalSubscriptionFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalSubscription/createRentalSubscription.form.validator";
import {editRentalSubscriptionFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalSubscription/editRentalSubscription.form.validator";
import RentalSubscription from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";
import {rentalSubscriptionService} from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription.service";
import {rentalSubscriptionToDTO, rentalSubscriptionsToDTO} from "@carRentalModule/utilities/mappers/rentalSubscription/rentalSubscriptionMapper.dto";
import {rentalSubscriptionsToSelect} from "@carRentalModule/utilities/mappers/rentalSubscription/rentalSubscriptionMapper.select";

export const basePath = "/api/carRental/rentalSubscription";

export const {router} = createCrudRouter({
    collectionName: "rentalsubscriptions",
    model: RentalSubscription,
    service: rentalSubscriptionService,
    entityName: "RentalSubscription",
    createSchema: createRentalSubscriptionFormSchema,
    editSchema: editRentalSubscriptionFormSchema,
    toDTO: rentalSubscriptionToDTO,
    toDTOArray: rentalSubscriptionsToDTO,
    toSelect: rentalSubscriptionsToSelect,
    selectSearchField: "contactName",
    defaultSort: {nextRunAt: 1},
    buildCreateData: buildCreateDataFromSchemaDef(RentalSubscriptionSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(RentalSubscriptionSchemaDef),
});
