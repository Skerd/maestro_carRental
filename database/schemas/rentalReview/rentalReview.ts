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

/**
 * A review is the customer's own words, written from their booking's manage link: staff publish or hide it, but never
 * write or change it, so the stars on the portal stay the customers'.
 */
const CustomerWrittenOnly = {self: {write: "no-permission"}, others: {write: "no-permission"}};

const RentalReviewSchema = new Schema<IRentalReview>(
    {
        reservation: {type: SchemaTypes.ObjectId, ref: "RentalReservation", required: true, refAllowlist: RentalReservationSimpleSnippet, permissions: CustomerWrittenOnly, dynamicTableConfiguration: {refDisplayKey: ["number"]}},
        rating: {type: SchemaTypes.Number, required: true, min: 1, max: 5, permissions: CustomerWrittenOnly},
        comment: {type: SchemaTypes.String, trim: true, maxlength: RENTAL_REVIEW_COMMENT_MAX, permissions: CustomerWrittenOnly, dynamicTableConfiguration: {hideColumn: true}},
        authorName: {type: SchemaTypes.String, required: true, trim: true, minlength: 1, maxlength: RENTAL_REVIEW_AUTHOR_NAME_MAX, permissions: CustomerWrittenOnly},
        isPublished: {type: SchemaTypes.Boolean, default: false},
    },
    {
        accessMode: "loose",
        // Only the customer's manage-link route creates a review (`rentalStorefront` `/manage/review`).
        permissions: {
            self: {create: "no-permission"},
            others: {create: "no-permission"},
        },
    },
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
