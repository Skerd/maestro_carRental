/**
 * Creates the next booking for each subscription whose date has arrived, then
 * schedules the one after it. A failure leaves the date where it is, so the
 * next run tries again.
 */

import dayjs from "dayjs";
import type {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {localDateOf, localTimeOf} from "@coreModule/utilities/time/timeWindows";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {
    createRentalReservation,
    loadBookableCategory,
} from "@carRentalModule/workflows/rentalReservationService";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {notifyRentalCustomer} from "@carRentalModule/utilities/services/rentalNotify";

import {rentalSubscriptionService} from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription.service";
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {rentalBusinessAccountService} from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount.service";
const BATCH_SIZE = 50;

function advance(date: Date, period: "week" | "month"): Date {
    return dayjs(date)
        .add(period === "week" ? 7 : 1, period === "week" ? "day" : "month")
        .toDate();
}

export async function runRentalSubscriptions(
    company: ObjectId,
    parentLogger?: serverLogger,
): Promise<void> {
    const logger = getLogger("rental_subscriptions", parentLogger);
    const languageCode = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    logger.start("Creating subscription bookings...");
    const due = await rentalSubscriptionService.find({
        company,
        status: "active",
        nextRunAt: {$lte: new Date()},
        deletedAt: null,
    }, {}, undefined, "_id", undefined, BATCH_SIZE);
    let createdCount = 0;
    for (const {_id} of due) {
        try {
            const created = await runInTransaction(logger, async (session) => {
                const subscription =
                    await rentalSubscriptionService.findById(_id, {session: session});
                if (
                    !subscription ||
                    subscription.status !== "active" ||
                    subscription.nextRunAt > new Date()
                )
                    return false;
                const ctx = {session, logger, languageCode};
                const config =
                    await carRentalConfigService.getOrCreateForCompany(
                        company,
                        ctx,
                    );
                const location = await rentalLocationService.findOne({
                    _id: subscription.pickupLocation,
                    company,
                    deletedAt: null,
                }, {session: session});
                if (!location) return false;
                const pickupAt = subscription.nextRunAt;
                const returnAt = advance(pickupAt, subscription.period);
                const trip = await resolveRentalTrip(
                    {
                        pickupLocation: String(location._id),
                        returnLocation: String(location._id),
                        pickupDate: localDateOf(pickupAt, location.timezone),
                        pickupTime: localTimeOf(pickupAt, location.timezone),
                        returnDate: localDateOf(returnAt, location.timezone),
                        returnTime: localTimeOf(returnAt, location.timezone),
                    },
                    config,
                    {
                        companyId: company,
                        languageCode,
                        online: false,
                        session,
                        now: pickupAt,
                    },
                );
                const category = await loadBookableCategory(
                    company,
                    String(nestedEntityToRef(subscription.category)),
                    {languageCode, online: false, session},
                );
                const account = subscription.businessAccount
                    ? await rentalBusinessAccountService.findOne({
                          _id: subscription.businessAccount,
                          company,
                          isActive: true,
                          deletedAt: null,
                      }, {session: session})
                    : null;
                const [first, ...rest] = subscription.contactName
                    .trim()
                    .split(/\s+/);
                const {reservation, created: made} =
                    await createRentalReservation(
                        {
                            companyId: company,
                            config,
                            category,
                            trip,
                            extras: [],
                            contact: {
                                firstName: first || subscription.contactName,
                                lastName: rest.join(" ") || "-",
                                email: subscription.email,
                                phone: subscription.phone,
                            },
                            businessAccountId: account?._id,
                            accountDiscountPercent: account?.discountPercent,
                            rentalPrice: subscription.price,
                            idempotencyKey: `sub-${subscription._id.toString()}-${pickupAt.getTime()}`,
                            source: "staff",
                            paymentChoice: account
                                ? "on_account"
                                : "pay_at_pickup",
                            now: pickupAt,
                        },
                        ctx,
                    );
                if (made && reservation.status === "confirmed")
                    await notifyRentalCustomer("confirmed", reservation, ctx);
                subscription.nextRunAt = advance(pickupAt, subscription.period);
                await subscription.save({session});
                return made;
            });
            if (created) createdCount += 1;
        } catch (error) {
            logger.err(
                `Failed to create the booking for subscription ${_id}`,
                error,
            );
        }
    }
    logger.finish(`Subscription bookings finished: ${createdCount} created`);
}
