import type {IRentalSubscription} from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";
import type {RentalSubscription} from "armonia/src/modules/carRental/api/carRental/private/rentalSubscription/rentalSubscription.dto";
import type {VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import {VehicleCategorySimpleSnippet} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.snippets";
import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import {RentalLocationSimpleSnippet} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.snippets";
import {dateToISOString, mapSnippet, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function rentalSubscriptionToDTO(subscription: IRentalSubscription): RentalSubscription {
    return {
        _id: subscription._id.toString(),
        contactName: subscription.contactName,
        email: subscription.email,
        phone: subscription.phone,
        category: mapSnippet<VehicleCategorySimple>()(subscription.category, VehicleCategorySimpleSnippet),
        pickupLocation: mapSnippet<RentalLocationSimple>()(subscription.pickupLocation, RentalLocationSimpleSnippet),
        businessAccount: subscription.businessAccount ? String(nestedEntityToRef(subscription.businessAccount)) : undefined,
        period: subscription.period,
        price: subscription.price,
        status: subscription.status,
        nextRunAt: dateToISOString(subscription.nextRunAt),
        ...mapSoftDeleteToDTO(subscription),
        ...mapOwnershipToDTO(subscription),
        ...mapLifeCycleToDTO(subscription),
    };
}

export function rentalSubscriptionsToDTO(records: IRentalSubscription[]): RentalSubscription[] {
    return records.map(rentalSubscriptionToDTO);
}
