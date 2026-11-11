import type {ObjectId} from "mongodb";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";

/**
 * Records with the rental currency their amounts are in (UX-07): rates, fees, fines, costs and prices are all in the
 * one rental currency, so routes add it for the panel to show "€95" instead of a bare number. None yet while the
 * company never set up its rental settings.
 */
export async function withRentalCurrency<T extends object>(dtos: T[], companyId: ObjectId, languageCode: string): Promise<(T & {currency?: CurrencySimple})[]> {
    const config = await carRentalConfigService.findForCompany(companyId, {languageCode});
    const currency = config ? await carRentalConfigService.currencyOf(config, languageCode).catch(() => undefined) : undefined;
    return currency ? dtos.map((dto) => ({...dto, currency})) : dtos;
}
