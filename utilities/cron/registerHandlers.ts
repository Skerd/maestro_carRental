import {registerCronHandler} from "@coreModule/cronjobs/registry/handlerRegistry";
import {runRentalHoldExpiry} from "@carRentalModule/utilities/cronJobs/rentalHoldExpiryJob";
import {runRentalPickupReminders} from "@carRentalModule/utilities/cronJobs/rentalPickupReminderJob";

export function registerCarRentalCronHandlers(): void {
    registerCronHandler({
        code: "carRental.holdExpiry",
        handler: async (ctx) => {
            await runRentalHoldExpiry(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Rental hold expiry",
            cronExpression: "0 */5 * * * *",
            priority: 20,
        },
    });

    registerCronHandler({
        code: "carRental.pickupReminder",
        handler: async (ctx) => {
            await runRentalPickupReminders(ctx.logger);
        },
        version: "1",
        defaultJob: {
            name: "Rental pickup reminders",
            cronExpression: "0 10 * * * *",
            priority: 10,
        },
    });
}
