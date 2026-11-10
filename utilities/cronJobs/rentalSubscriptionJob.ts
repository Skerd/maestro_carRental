/**
 * Creates the next booking for each subscription whose date has arrived, then
 * schedules the one after it. A failure leaves the date where it is, so the
 * next run tries again.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {isValidTimeZone, localDateOf, localTimeOf, localToUtc} from "@coreModule/utilities/time/timeWindows";
import {companyTimeZoneOf} from "@coreModule/utilities/time/companyTimeZone";
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

dayjs.extend(utc);
dayjs.extend(timezone);

const BATCH_SIZE = 50;
const MINUTE_MS = 60_000;

/**
 * The same wall-clock time a week or a month later at the pickup location (GLB-09): across a DST change the instant
 * moves by an hour, the local time does not. A month from the 31st lands on the month's last day.
 */
function advance(date: Date, period: "week" | "month", timeZone: string): Date {
    const day = dayjs.utc(localDateOf(date, timeZone))
        .add(period === "week" ? 7 : 1, period === "week" ? "day" : "month")
        .format("YYYY-MM-DD");
    const time = localTimeOf(date, timeZone);
    // A time skipped by spring-forward does not exist that day: it moves on by the hour the clocks skipped.
    const minute = localToUtc(day, time, timeZone) ?? dayjs.tz(`${day} ${time}`, timeZone).toDate();
    // Offsets are whole minutes, so the seconds carry over unchanged.
    return new Date(minute.getTime() + (date.getTime() % MINUTE_MS));
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
                const timeZone = isValidTimeZone(location.timezone)
                    ? location.timezone
                    : await companyTimeZoneOf(company, {session});
                const pickupAt = subscription.nextRunAt;
                const returnAt = advance(pickupAt, subscription.period, timeZone);
                const trip = await resolveRentalTrip(
                    {
                        pickupLocation: String(location._id),
                        returnLocation: String(location._id),
                        pickupDate: localDateOf(pickupAt, timeZone),
                        pickupTime: localTimeOf(pickupAt, timeZone),
                        returnDate: localDateOf(returnAt, timeZone),
                        returnTime: localTimeOf(returnAt, timeZone),
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
                subscription.nextRunAt = advance(pickupAt, subscription.period, timeZone);
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
