import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {ILifeCyclePluginFields, IOwnershipPluginFields, ISoftDeletePluginFields} from "@coreModule/database/types/plugin-fields";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {
    RENTAL_REVIEW_AUTHOR_NAME_MAX,
    RENTAL_REVIEW_COMMENT_MAX,
    RentalReviewSchemaDef,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/rentalReview.schema-def";
import type {IRentalReservation} from "../rentalReservation/rentalReservation";
import {RentalReservationSimpleSnippet} from "../rentalReservation/rentalReservation.snippets";
import {applyRentalReviewIndexes} from "./rentalReview.indexes";
import {rentalReviewViews} from "./rentalReview.views";

export interface IRentalReview extends Document, IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    reservation: IRentalReservation;
    rating: number;
    comment?: string;
    authorName: string;
    isPublished: boolean;
}

const RentalReviewSchema = new Schema<IRentalReview>(
    {
        reservation: {type: SchemaTypes.ObjectId, ref: "RentalReservation", required: true, refAllowlist: RentalReservationSimpleSnippet, dynamicTableConfiguration: {refDisplayKey: ["number"]}},
        rating: {type: SchemaTypes.Number, required: true, min: 1},
        comment: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_REVIEW_COMMENT_MAX, dynamicTableConfiguration: {hideColumn: true}},
        authorName: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: RENTAL_REVIEW_AUTHOR_NAME_MAX},
        isPublished: {type: SchemaTypes.Boolean, default: false},
    },
    {accessMode: "loose"},
);

ownershipPlugin(RentalReviewSchema);
auditPlugin(RentalReviewSchema);
softDeletePlugin(RentalReviewSchema);
lifeCyclePlugin(RentalReviewSchema);
applyRentalReviewIndexes(RentalReviewSchema);
const RentalReview = model<IRentalReview>("RentalReview", RentalReviewSchema);
normalizeSchemaPermissions(RentalReview);
export default RentalReview;

addModelData(RentalReview, rentalReviewViews);
validateSchemaDefAgainstMongoose(RentalReviewSchema, RentalReviewSchemaDef, "RentalReview");
