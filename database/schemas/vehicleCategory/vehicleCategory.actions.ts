import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {action} from "@coreModule/api/actionDecorator";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import {getModelCollectedData} from "@coreModule/database/collections";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {reorderVehicleCategoriesFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/reorderVehicleCategories.form.validator";
import type {ActionMessage} from "armonia/src/modules/core/types/shared.types";
import type {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import VehicleCategory from "./vehicleCategory";
import {vehicleCategoryService} from "./vehicleCategory.service";

type ActionParams = AuthenticatedMWType & {session: ClientSession};

export class VehicleCategoryActions {
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async showOnWebsite(params: ActionParams & {_id: string}): Promise<ActionMessage> {
        return setWebsiteVisibility(params, true);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
        transaction: true,
    })
    async hideFromWebsite(params: ActionParams & {_id: string}): Promise<ActionMessage> {
        return setWebsiteVisibility(params, false);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: reorderVehicleCategoriesFormSchema,
        transaction: true,
    })
    async reorder(params: ActionParams & {orderedIds: string[]}): Promise<ActionMessage> {
        const {logger, languageCode, session, company, actionUserCtx, orderedIds} = params;

        const writeFields = SchemaGuard.sanitizeFields(
            VehicleCategory,
            getModelCollectedData("vehiclecategories").writeFields!,
            "write",
            actionUserCtx,
            languageCode,
        );
        if (!writeFields.sortOrder) {
            throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
        }

        const existing = await vehicleCategoryService.find(
            {company: company._id},
            {session, logger, languageCode},
            undefined,
            "_id",
        );
        const ownedIds = new Set(existing.map((category) => category._id.toString()));
        const coversCompany = ownedIds.size === orderedIds.length && orderedIds.every((id) => ownedIds.has(id));
        if (!coversCompany) {
            throw apiValidationException("not_found", "", null, languageCode);
        }

        const result = await vehicleCategoryService.bulkUpdate(
            orderedIds.map((id, index) => ({
                id,
                update: {$set: {sortOrder: index}},
            })),
            {session, logger, languageCode},
        );
        if (result.matchedCount !== orderedIds.length) {
            throw apiValidationException("not_found", "", null, languageCode);
        }

        return {message: "Categories reordered successfully"};
    }
}

async function setWebsiteVisibility(params: ActionParams & {_id: string}, isPublic: boolean): Promise<ActionMessage> {
    const {logger, languageCode, session, company, actionUserCtx, _id} = params;

    const writeFields = SchemaGuard.sanitizeFields(
        VehicleCategory,
        getModelCollectedData("vehiclecategories").writeFields!,
        "write",
        actionUserCtx,
        languageCode,
    );
    if (!writeFields.isPublic) {
        throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
    }

    const existing = await vehicleCategoryService.findOneOrThrow(
        {_id: new ObjectId(_id), company: company._id},
        {session, logger, languageCode},
    );

    if (existing.isPublic === isPublic) {
        return {message: isPublic ? "Category already shown on the website" : "Category already hidden from the website"};
    }

    await vehicleCategoryService.updateByIdOrThrow(
        existing._id,
        {isPublic},
        {session, logger, languageCode, auditUserId: actionUserCtx.userId},
    );

    return {message: isPublic ? "Category shown on the website" : "Category hidden from the website"};
}
