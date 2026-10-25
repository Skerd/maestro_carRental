import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {action} from "@coreModule/api/actionDecorator";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {getModelCollectedData} from "@coreModule/database/collections";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {reorderRentalExtrasFormSchema} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/reorderRentalExtras.form.validator";
import type {ActionMessage} from "armonia/src/modules/core/types/shared.types";
import type {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import RentalExtraModel from "./rentalExtra";
import {rentalExtraService} from "./rentalExtra.service";

type ActionParams = AuthenticatedMWType & {session: ClientSession};

export class RentalExtraActions {
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async activate(params: Record<string, any>): Promise<ActionMessage> {
        return setActiveState(params, true);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async deactivate(params: Record<string, any>): Promise<ActionMessage> {
        return setActiveState(params, false);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: reorderRentalExtrasFormSchema,
        transaction: true,
    })
    async reorder(params: ActionParams & {orderedIds: string[]}): Promise<ActionMessage> {
        const {logger, languageCode, session, company, actionUserCtx, orderedIds} = params;

        const writeFields = SchemaGuard.sanitizeFields(
            RentalExtraModel,
            getModelCollectedData("rentalextras").writeFields!,
            "write",
            actionUserCtx,
            languageCode,
        );
        if (!writeFields.sortOrder) {
            throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
        }

        const existing = await rentalExtraService.find(
            {company: company._id},
            {session, logger, languageCode},
            undefined,
            "_id",
        );
        const ownedIds = new Set(existing.map((extra) => extra._id.toString()));
        const coversCompany = ownedIds.size === orderedIds.length && orderedIds.every((id) => ownedIds.has(id));
        if (!coversCompany) {
            throw apiValidationException("not_found", "", null, languageCode);
        }

        const result = await rentalExtraService.bulkUpdate(
            orderedIds.map((id, index) => ({
                id,
                update: {$set: {sortOrder: index}},
            })),
            {session, logger, languageCode},
        );
        if (result.matchedCount !== orderedIds.length) {
            throw apiValidationException("not_found", "", null, languageCode);
        }

        return {message: "Extras reordered successfully"};
    }
}

async function setActiveState(params: Record<string, any>, isActive: boolean): Promise<ActionMessage> {
    const {logger, languageCode, session, company, actionUserCtx, _id} = params;

    const writeFields = SchemaGuard.sanitizeFields(
        RentalExtraModel,
        getModelCollectedData("rentalextras").writeFields!,
        "write",
        actionUserCtx,
        languageCode,
    );
    if (!writeFields.isActive) {
        throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
    }

    const existing = await rentalExtraService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );

    if (existing.isActive === isActive) {
        return {message: isActive ? "Rental extra already active" : "Rental extra already inactive"};
    }

    await rentalExtraService.updateByIdOrThrow(
        existing._id,
        {isActive},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );

    return {message: isActive ? "Rental extra activated" : "Rental extra deactivated"};
}
