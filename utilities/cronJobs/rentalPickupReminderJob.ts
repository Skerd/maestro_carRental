/**
 * Hourly: emails customers whose confirmed pickup is within the next 24 hours.
 * `pickupReminderSentAt` is stamped first, so a reminder goes out at most once
 * even if two runs overlap.
 */

import type {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {notifyRentalCustomer} from "@carRentalModule/utilities/services/rentalNotify";

const REMINDER_WINDOW_MS = 24 * 3600 * 1000;
const BATCH_SIZE = 200;

export async function runRentalPickupReminders(company: ObjectId, parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("rental_pickup_reminders", parentLogger);
    const languageCode = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    const now = new Date();
    logger.start("Sending rental pickup reminders...");

    const due = await RentalReservation.find({
        company,
        status: "confirmed",
        deletedAt: null,
        pickupReminderSentAt: {$exists: false},
        pickupAt: {$gt: now, $lte: new Date(now.getTime() + REMINDER_WINDOW_MS)},
    }).limit(BATCH_SIZE);

    let sent = 0;
    for (const reservation of due) {
        // Claim it: only the run that sets the stamp sends.
        const claimed = await RentalReservation.updateOne(
            {_id: reservation._id, pickupReminderSentAt: {$exists: false}},
            {$set: {pickupReminderSentAt: now}},
        );
        if (!claimed.modifiedCount) continue;
        try {
            await notifyRentalCustomer("reminder", reservation, {languageCode});
            sent += 1;
        } catch (error) {
            logger.err(`Failed to send pickup reminder for ${reservation.number}`, error);
        }
    }
    logger.finish(`Rental pickup reminders sent: ${sent}`);
}
