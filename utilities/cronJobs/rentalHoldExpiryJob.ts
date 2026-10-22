/**
 * Every few minutes: closes held reservations whose hold ran out. Availability
 * already ignores an expired hold, so this only tidies up: it marks the
 * reservation expired and cancels its unpaid payment intent.
 */

import type {ObjectId} from "mongodb";
import {CONSTANTS} from "@coreModule/environment";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {expireRentalHold} from "@carRentalModule/utilities/services/rentalLifecycle";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";

const BATCH_SIZE = 200;

export async function runRentalHoldExpiry(company: ObjectId, parentLogger?: serverLogger): Promise<void> {
    const logger = getLogger("rental_hold_expiry", parentLogger);
    const languageCode = CONSTANTS.DEFAULT_LANGUAGE ?? "en-US";
    logger.start("Expiring rental holds...");

    const due = await RentalReservation.find({company, status: "held", holdExpiresAt: {$lte: new Date()}, deletedAt: null})
        .select("_id")
        .limit(BATCH_SIZE);
    let expired = 0;
    for (const {_id} of due) {
        try {
            const done = await runInTransaction(logger, async (session) => {
                // Re-read inside the transaction: a payment may have confirmed it meanwhile.
                const reservation = await RentalReservation.findById(_id).session(session);
                return reservation ? expireRentalHold(reservation, {session, logger, languageCode}) : false;
            });
            if (done) expired += 1;
        } catch (error) {
            logger.err(`Failed to expire rental hold ${_id}`, error);
        }
    }
    logger.finish(`Rental hold expiry finished: ${expired} expired`);
}
