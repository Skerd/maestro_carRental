import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {action} from "@coreModule/api/actionDecorator";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {getModelCollectedData} from "@coreModule/database/collections";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {ActionMessage} from "armonia/src/modules/core/types/shared.types";
import type {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import RentalReview from "./rentalReview";
import {rentalReviewService} from "./rentalReview.service";

type ActionParams = AuthenticatedMWType & {session: ClientSession};

export class RentalReviewActions {
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async publish(params: ActionParams & {_id: string}): Promise<ActionMessage> {
        return setPublished(params, true);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async unpublish(params: ActionParams & {_id: string}): Promise<ActionMessage> {
        return setPublished(params, false);
    }
}

async function setPublished(params: ActionParams & {_id: string}, isPublished: boolean): Promise<ActionMessage> {
    const {logger, languageCode, session, company, actionUserCtx, _id} = params;

    const writeFields = SchemaGuard.sanitizeFields(
        RentalReview,
        getModelCollectedData("rentalreviews").writeFields!,
        "write",
        actionUserCtx,
        languageCode,
    );
    if (!writeFields.isPublished) {
        throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
    }

    const existing = await rentalReviewService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );

    if (existing.isPublished === isPublished) {
        return {message: isPublished ? "Review already published" : "Review already unpublished"};
    }

    await rentalReviewService.updateByIdOrThrow(
        existing._id,
        {isPublished},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );

    return {message: isPublished ? "Review published" : "Review unpublished"};
}
