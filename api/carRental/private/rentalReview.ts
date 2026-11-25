import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {RentalReviewSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/rentalReview.schema-def";
import {createRentalReviewFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/createRentalReview.form.validator";
import {editRentalReviewFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/editRentalReview.form.validator";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";
import {rentalReviewToDTO, rentalReviewsToDTO} from "@carRentalModule/utilities/mappers/rentalReview/rentalReviewMapper.dto";
import {rentalReviewsToSelect} from "@carRentalModule/utilities/mappers/rentalReview/rentalReviewMapper.select";

export const basePath = "/api/carRental/rentalReview";

export const {router} = createCrudRouter({
    collectionName: "rentalreviews",
    model: RentalReview,
    service: rentalReviewService,
    entityName: "RentalReview",
    createSchema: createRentalReviewFormSchema,
    editSchema: editRentalReviewFormSchema,
    toDTO: rentalReviewToDTO,
    toDTOArray: rentalReviewsToDTO,
    toSelect: rentalReviewsToSelect,
    selectSearchField: "authorName",
    defaultSort: {createdAt: -1},
    // A review comes only from the customer, through their booking's manage link: staff never write or delete one, and
    // only the platform hides one (D191).
    checkCreatePermission: ({languageCode}) => {
        throw apiValidationException("rental_review_written_by_customer_only", "", null, languageCode);
    },
    buildCreateData: buildCreateDataFromSchemaDef(RentalReviewSchemaDef),
    buildUpdateData: buildUpdateDataFromSchemaDef(RentalReviewSchemaDef),
});
