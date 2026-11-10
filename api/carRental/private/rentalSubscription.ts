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

const buildSubscriptionUpdate = buildUpdateDataFromSchemaDef(RentalSubscriptionSchemaDef);

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
    buildUpdateData: (params, writeFields) => {
        const data = buildSubscriptionUpdate(params, writeFields);
        // A moved next date is a new day of the month: the job takes it as the anchor again (TD-B143).
        const moved = data.nextRunAt != null && new Date(data.nextRunAt).getTime() !== params.existing.nextRunAt.getTime();
        return moved ? {...data, anchorDay: null} : data;
    },
});
