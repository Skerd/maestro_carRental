import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {seedCarRentalDemoData} from "@carRentalModule/database/demo/carRentalCompanyDemo";

/** After finance (50); car rental depends on nothing else seeded. */
export const companyDemoSeedOrder = 60;

export async function seedCompanyDemoData(parentLogger: serverLogger | undefined, company: any): Promise<void> {
    const logger = getLogger("carRental_company_demo_seed", parentLogger);
    await seedCarRentalDemoData(logger, company);
}
