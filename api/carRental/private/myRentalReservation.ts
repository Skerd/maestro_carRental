import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {type AuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {transactionHandler, type TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {
    PublicRentalReservationResponse,
    PublicRentalReservationsResponse,
} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.response.types";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReservationToPublic} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {cancelRentalReservation} from "@carRentalModule/utilities/services/rentalLifecycle";

/**
 * A signed-in customer's own rentals ("My rentals" on the public site). Scoped to
 * the caller as `customer`, so it needs no collection permission: the signup role
 * has none, and staff permissions are not what lets someone see their own booking.
 */
export const basePath = "/api/carRental/myRentalReservation";
export const router = Router();

const CURRENCY = {path: "pricing.currency", select: "name symbol abbreviation"};

router.post(
    "/list",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 60}),
    asyncHandler(async ({actionUserCtx, company}: AuthenticatedMWType): Promise<PublicRentalReservationsResponse> => {
        const reservations = await RentalReservation.find({
            company: company._id,
            customer: new ObjectId(actionUserCtx.userId),
            deletedAt: null,
        }).sort({pickupAt: -1}).limit(100).populate(CURRENCY);
        return {data: reservations.map((reservation) => rentalReservationToPublic(reservation))};
    }),
);

router.post(
    "/cancel",
    authMW("private"),
    rateLimiter({windowMs: 60000, max: 10}),
    transactionHandler(),
    validateFormZod(validateSingleForm),
    asyncHandler(async (params: TransactionRequiredParams & {_id: string}): Promise<PublicRentalReservationResponse> => {
        const {_id, actionUserCtx, company, session, logger, languageCode} = params;
        const reservation = ObjectId.isValid(_id)
            ? await RentalReservation.findOne({
                _id: new ObjectId(_id),
                company: company._id,
                customer: new ObjectId(actionUserCtx.userId),
                deletedAt: null,
            }).session(session)
            : null;
        if (!reservation) throw apiValidationException("rental_reservation_not_found", "", null, languageCode);
        if (reservation.pickupAt <= new Date()) {
            throw apiValidationException("rental_reservation_invalid_status", "", null, languageCode);
        }
        await cancelRentalReservation(
            reservation,
            {by: "customer", reason: "cancelled_by_customer", applyFee: true},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        await reservation.populate(CURRENCY);
        return {data: rentalReservationToPublic(reservation)};
    }),
);
