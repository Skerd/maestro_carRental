import {ObjectId} from "mongodb";
import {BaseCrudService, CrudOptions} from "@coreModule/database/services/baseCrudService";
import Currency from "@coreModule/database/schemas/currency/currency";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import CarRentalConfig, {ICarRentalConfig} from "./carRentalConfig";

export class CarRentalConfigService extends BaseCrudService<ICarRentalConfig, typeof CarRentalConfig> {
    constructor() {
        super(CarRentalConfig, "CarRentalConfig");
    }

    /** The company's rental settings, or null when the company never set up car rental. */
    async findForCompany(companyId: ObjectId, options: CrudOptions = {}): Promise<ICarRentalConfig | null> {
        return this.findOne({company: companyId}, {...options, withDeleted: false});
    }

    /**
     * The company's rental settings, created with defaults (public booking off, the
     * company's first currency) the first time staff open them.
     */
    async getOrCreateForCompany(companyId: ObjectId, options: CrudOptions = {}): Promise<ICarRentalConfig> {
        const existing = await this.findForCompany(companyId, options);
        if (existing) return existing;

        const currency =
            (await Currency.findOne({company: companyId}).sort({createdAt: 1}).select("_id").session(options.session ?? null))
            ?? (await Currency.findOne({}).sort({createdAt: 1}).select("_id").session(options.session ?? null));
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
