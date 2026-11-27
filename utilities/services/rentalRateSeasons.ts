import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";

/** A season ends on or after its first day; a category's and a car's own seasons alike (D198). */
export function assertValidSeasons(seasons: {startDate: string; endDate: string}[] | undefined, languageCode: string): void {
    if (seasons?.some((season) => season.endDate < season.startDate)) {
        throw apiValidationException("rental_season_end_before_start", "", null, languageCode);
    }
}

/** Each seasonal rate names the rental currency, so a sheet's season list shows "€ 59.00" (UX-07). */
export function withSeasonCurrency<T extends {rateSeasons: object[]; currency?: CurrencySimple}>(dto: T): T {
    return dto.currency ? {...dto, rateSeasons: dto.rateSeasons.map((season) => ({...season, currency: dto.currency}))} : dto;
}
