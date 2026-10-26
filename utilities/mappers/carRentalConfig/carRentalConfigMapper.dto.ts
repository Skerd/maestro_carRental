import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import type {CarRentalConfig} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.dto";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function carRentalConfigToDTO(config: ICarRentalConfig): CarRentalConfig {
    return {
        _id: config._id.toString(),
        publicBookingEnabled: config.publicBookingEnabled,
        listedOnPortal: config.listedOnPortal,
        currency: mapSnippet<CurrencySimple>()(config.currency, CurrencySimpleSnippet),
        minRentalHours: config.minRentalHours,
        maxRentalDays: config.maxRentalDays,
        minLeadTimeHours: config.minLeadTimeHours,
        maxAdvanceDays: config.maxAdvanceDays,
        turnaroundBufferMinutes: config.turnaroundBufferMinutes,
        holdMinutes: config.holdMinutes,
        lateGraceMinutes: config.lateGraceMinutes,
        paymentPolicy: config.paymentPolicy,
        freeCancellationHours: config.freeCancellationHours,
        cancellationFeePercent: config.cancellationFeePercent,
        vatRate: config.vatRate,
        pricesIncludeVat: config.pricesIncludeVat,
        guestBookingAllowed: config.guestBookingAllowed,
        termsVersion: config.termsVersion,
        termsText: config.termsText,
        notifyUsers: config.notifyUsers
            ?.map((user) => mapSnippet<SimpleBlankUser>()(user, SimpleBlankUserSnippet))
            .filter((user): user is SimpleBlankUser => user !== undefined),
        ...mapSoftDeleteToDTO(config),
        ...mapOwnershipToDTO(config),
        ...mapLifeCycleToDTO(config),
    };
}

export function carRentalConfigsToDTO(configs: ICarRentalConfig[]): CarRentalConfig[] {
    return configs.map(carRentalConfigToDTO);
}
