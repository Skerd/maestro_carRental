/**
 * One-off (D199, asked for with the vehicle catalog): links every existing car to the catalog model its typed make and
 * model name, keeping the typed names. Reports by default; `--apply` writes. `--company="<name or id>"` limits it to one
 * company. Cars that match nothing are listed for staff to pick by hand.
 *
 * Usage (from maestro/):
 *   MONGODB_DB_NAME=xCloud-all npx ts-node --transpile-only -r tsconfig-paths/register modules/carRental/scripts/link-vehicle-catalog.ts [--company="Albania Rental"] [--apply]
 */

process.env.ENABLED_MODULES = process.env.ENABLED_MODULES || "carRental";

import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectToMongoDb} from "@coreModule/connections/connectToMongoDb";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {companyService} from "@coreModule/database/schemas/company/company.service";
import {getLogger} from "@coreModule/loggers/serverLog";
import {linkVehiclesToCatalog} from "@carRentalModule/utilities/services/vehicleCatalogLink";

async function main() {
    const logger = getLogger("link_vehicle_catalog");
    await connectToMongoDb(logger, false);
    const named = process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length).trim();
    const company = named
        ? await companyService.findOne(ObjectId.isValid(named) ? {_id: new ObjectId(named)} : {name: named})
        : null;
    if (named && !company) throw new Error(`Company "${named}" not found.`);
    const apply = process.argv.includes("--apply");
    const result = await linkVehiclesToCatalog({companyId: company?._id, apply});
    logger.info(`${apply ? "Linked" : "Would link"} ${result.linked.length} car(s); ${result.unmatched.length} match nothing.`);
    for (const car of result.unmatched) logger.info(`Unmatched: ${car.plate} ${car.make} ${car.model}`);
    await mongoose.disconnect();
    process.exit(0);
}

// Operator scripts span companies on purpose (D16).
asCrossTenant("the vehicle catalog link reads and links every company's cars", main).catch(async (err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
