import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {action} from "@coreModule/api/actionDecorator";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import {reorderVehicleCategoriesFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/reorderVehicleCategories.form.validator";
import type {ActionMessage} from "armonia/src/modules/core/types/shared.types";
import type {AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import VehicleCategory from "./vehicleCategory";
import {vehicleCategoryService} from "./vehicleCategory.service";
import {setCarPricesFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/setCarPrices.form.validator";
import type {SetCarPricesFormType} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";
import type {CategoryCarPricesResponse} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.dto";
import {effectiveVehicleRates, vehicleListingTitle} from "armonia/src/modules/carRental/helpers/vehicleRates";
import {vehicleService} from "../vehicle/vehicle.service";
import {carRentalConfigService} from "../carRentalConfig/carRentalConfig.service";
import {countUpcomingExactBookings} from "@carRentalModule/utilities/services/rentalAvailability";

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

    /** The category's cars with their own prices and what each costs booked exactly, for "Car prices" (D198). */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 60},
        schema: validateSingleForm,
        transaction: true,
    })
    async carPrices(params: ActionParams & {_id: string}): Promise<CategoryCarPricesResponse> {
        const {logger, languageCode, session, company, _id} = params;
        const category = await vehicleCategoryService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        const [cars, config] = await Promise.all([
            vehicleService.find({company: company._id, category: category._id, status: {$ne: "retired"}, deletedAt: null}, {session}, undefined, undefined, {make: 1, model: 1, plate: 1}),
            carRentalConfigService.findForCompany(company._id, {session, languageCode}),
        ]);
        const currency = config ? await carRentalConfigService.currencyOf(config, languageCode).catch(() => undefined) : undefined;
        return {
            data: {
                ...(currency ? {currency} : {}),
                categoryDailyRate: category.dailyRate,
                ...(category.depositAmount !== undefined ? {categoryDepositAmount: category.depositAmount} : {}),
                cars: cars.map((car) => ({
                    _id: car._id.toString(),
                    title: vehicleListingTitle(car),
                    plate: car.plate,
                    ...(car.year !== undefined ? {year: car.year} : {}),
                    status: car.status,
                    listedAlone: car.listedAlone === true,
                    ...(car.dailyRate !== undefined ? {dailyRate: car.dailyRate} : {}),
                    ...(car.depositAmount !== undefined ? {depositAmount: car.depositAmount} : {}),
                    hasOtherOwnPrices: car.weekendDailyRate !== undefined || car.weeklyRate !== undefined || (car.rateSeasons?.length ?? 0) > 0,
                    rates: effectiveVehicleRates(category, car),
                })),
            },
        };
    }

    /**
     * Sets, for each listed car of the category, whether it is rented on its own and its own day price and deposit
     * (empty: the category's), in one go (D198). A car with exact bookings to come stays rented on its own.
     */
    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: setCarPricesFormSchema,
        transaction: true,
    })
    async setCarPrices(params: ActionParams & SetCarPricesFormType): Promise<ActionMessage> {
        const {logger, languageCode, session, company, _id, cars} = params;
        const category = await vehicleCategoryService.findOneOrThrow({_id: new ObjectId(_id), company: company._id}, {session, logger, languageCode});
        const ids = cars.map((row) => new ObjectId(row.vehicle));
        const existing = await vehicleService.find({_id: {$in: ids}, company: company._id, category: category._id, deletedAt: null}, {session});
        if (existing.length !== new Set(ids.map(String)).size) throw apiValidationException("vehicle_not_found", "", null, languageCode);
        const byId = new Map(existing.map((car) => [String(car._id), car]));
        for (const row of cars) {
            const car = byId.get(row.vehicle)!;
            if (car.listedAlone && !row.listedAlone) {
                const exact = await countUpcomingExactBookings(car._id, {companyId: company._id, session});
                if (exact > 0) throw apiValidationException("vehicle_has_future_exact_reservations", "", null, languageCode, [String(exact)]);
            }
            car.listedAlone = row.listedAlone;
            car.set("dailyRate", row.dailyRate ?? undefined);
            car.set("depositAmount", row.depositAmount ?? undefined);
            await car.save({session});
        }
        return {message: "Car prices saved"};
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        schema: reorderVehicleCategoriesFormSchema,
        transaction: true,
    })
    async reorder(params: ActionParams & {orderedIds: string[]}): Promise<ActionMessage> {
        const {logger, languageCode, session, company, actionUserCtx, orderedIds} = params;

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
