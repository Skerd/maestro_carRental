import {registerCronHandler} from "@coreModule/cronjobs/registry/handlerRegistry";
import {runRentalHoldExpiry} from "@carRentalModule/utilities/cronJobs/rentalHoldExpiryJob";
import {runRentalPickupReminders} from "@carRentalModule/utilities/cronJobs/rentalPickupReminderJob";
import {runFleetReminders} from "@carRentalModule/utilities/cronJobs/fleetReminderJob";

export function registerCarRentalCronHandlers(): void {
    registerCronHandler({
        code: "carRental.holdExpiry",
        handler: async (ctx) => {
            await runRentalHoldExpiry(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Rental hold expiry",
            cronExpression: "0 */5 * * * *",
            priority: 20,
        },
    });

    registerCronHandler({
        code: "carRental.pickupReminder",
        handler: async (ctx) => {
            await runRentalPickupReminders(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Rental pickup reminders",
            cronExpression: "0 10 * * * *",
            priority: 10,
        },
    });

    registerCronHandler({
        code: "carRental.fleetReminders",
        handler: async (ctx) => {
            await runFleetReminders(ctx.company, ctx.logger);
        },
        defaultJob: {
            name: "Fleet expiry and service reminders",
            cronExpression: "0 0 7 * * *",
            priority: 10,
        },
    });
}
