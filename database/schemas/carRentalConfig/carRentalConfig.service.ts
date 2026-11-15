import {ObjectId} from "mongodb";
import {BaseCrudService, CrudOptions} from "@coreModule/database/services/baseCrudService";
import Currency from "@coreModule/database/schemas/currency/currency";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {mapSnippet, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import CarRentalConfig, {ICarRentalConfig} from "./carRentalConfig";

export class CarRentalConfigService extends BaseCrudService<ICarRentalConfig, typeof CarRentalConfig> {
    constructor() {
        super(CarRentalConfig, "CarRentalConfig");
    }

    /** The currency every rental amount is in, with its own decimals (D90). */
    async currencyOf(config: ICarRentalConfig, languageCode: string): Promise<CurrencySimple> {
        const id = nestedEntityToRef(config.currency);
        const found = id ? await currencyService.findById(id, {}, undefined, "name symbol abbreviation decimalPlaces") : null;
        const currency = mapSnippet<CurrencySimple>()(found, CurrencySimpleSnippet);
        if (!currency) throw apiValidationException("rental_currency_not_configured", "", null, languageCode);
        return currency;
    }

    /** The company's rental settings, or null when the company never set up car rental. */
    async findForCompany(companyId: ObjectId, options: CrudOptions = {}): Promise<ICarRentalConfig | null> {
        return this.findOne({company: companyId}, {...options, withDeleted: false});
    }

    /**
     * The company's rental settings, created with defaults (public booking off, the
     * platform's first currency, D160) the first time staff open them.
     */
    async getOrCreateForCompany(companyId: ObjectId, options: CrudOptions = {}): Promise<ICarRentalConfig> {
        const existing = await this.findForCompany(companyId, options);
        if (existing) return existing;

        // The first row of the platform's currency list (D160).
        const currency = await Currency.findOne({}).sort({createdAt: 1}).select("_id").session(options.session ?? null);
        if (!currency) {
            throw apiValidationException("rental_currency_not_configured", "", null, options.languageCode ?? "en-US");
        }

        try {
            return await this.create({company: companyId, currency: currency._id}, options);
        } catch (err: unknown) {
            // Race: another request created the singleton — re-read.
            const raced = await this.findForCompany(companyId, options);
            if (raced) return raced;
            throw err;
        }
    }
}

export const carRentalConfigService = new CarRentalConfigService();
