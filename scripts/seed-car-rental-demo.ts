/**
 * One-shot: seed car rental demo data (fleet, bookings in every status, papers, damages, fines and transfers in
 * every state, and today's counter work) for the demo rental company without dropping the database. Every row is
 * keyed, so re-running adds only what is new: on a later day, that day's pickups and returns. `--company=<name or id>`
 * seeds another company instead, e.g. one a user created in the panel.
 *
 * Usage (from maestro/):
 *   MONGODB_DB_NAME=xCloud-all npx ts-node --transpile-only -r tsconfig-paths/register modules/carRental/scripts/seed-car-rental-demo.ts [--company="Albania Rental"]
 */

process.env.ENABLED_MODULES = process.env.ENABLED_MODULES || "carRental";

import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectToMongoDb} from "@coreModule/connections/connectToMongoDb";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {companyService} from "@coreModule/database/schemas/company/company.service";
import {getLogger} from "@coreModule/loggers/serverLog";
import {seedCarRentalDemoData} from "@carRentalModule/database/demo/carRentalCompanyDemo";

async function main() {
    const logger = getLogger("seed_car_rental_demo");
    logger.start("Connecting and seeding car rental demo data...");

    await connectToMongoDb(logger, false);

    // By VAT by default: the demo rental company is renamed in the panel (e.g. "Adriatic Drive").
    const named = process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length).trim();
    const company = named
        ? await companyService.findOne(ObjectId.isValid(named) ? {_id: new ObjectId(named)} : {name: named})
        : await companyService.findOne({vat: "Z323456789Z"});
    if (!company) {
        throw new Error(named
            ? `Company "${named}" not found.`
            : "Car rental demo company (VAT Z323456789Z) not found — cannot seed.");
    }

    logger.info(`Seeding against company ${company.name} (${company._id})`);
    await seedCarRentalDemoData(logger, company);
    logger.finish("Car rental demo seed complete.");
    await mongoose.disconnect();
    process.exit(0);
}

// Operator scripts span companies on purpose (D16).

asCrossTenant("a demo seed writes the rental company's data", main).catch(async (err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
