import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {expandWeeklyHours, localDateOf, localToUtc} from "@coreModule/utilities/time/timeWindows";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import RentalLocation, {type IRentalLocation} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export type RentalTripInput = {
    pickupLocation: string;
    returnLocation: string;
    pickupDate: string;
    pickupTime: string;
    returnDate: string;
    returnTime: string;
};

export type RentalTrip = {
    pickupLocation: IRentalLocation;
    returnLocation: IRentalLocation;
    pickupAt: Date;
    returnAt: Date;
};

/**
 * True when the location is open at `instant`: inside one of its weekly opening
 * rows (in its own timezone) and not on a closed day. No rows means open around
 * the clock.
 */
export function isLocationOpenAt(location: Pick<IRentalLocation, "openingHours" | "closures" | "timezone">, instant: Date): boolean {
    if (location.closures?.some((closure) => closure.date === localDateOf(instant, location.timezone))) {
        return false;
    }
    if (!location.openingHours?.length) {
        return true;
    }
    const hours = expandWeeklyHours(location.openingHours, location.timezone, new Date(instant.getTime() - DAY), new Date(instant.getTime() + DAY));
    return hours.some((interval) => interval.start <= instant && instant <= interval.end);
}

/**
 * Turns the customer's (or agent's) local dates and times into real instants and
 * checks every rule a trip must meet before any vehicle is looked at. `online`
 * adds the lead-time rule; staff may book a walk-in for right now.
 */
export async function resolveRentalTrip(
    input: RentalTripInput,
    config: ICarRentalConfig,
    ctx: {companyId: ObjectId; languageCode: string; online: boolean; now?: Date; session?: ClientSession},
): Promise<RentalTrip> {
    const {companyId, languageCode, online, session} = ctx;
    const now = ctx.now ?? new Date();

    const findLocation = async (id: string) => {
        const location = ObjectId.isValid(id)
            ? await RentalLocation.findOne({_id: new ObjectId(id), company: companyId, isActive: true, deletedAt: null})
                .populate([{path: "address.city", select: "name"}, {path: "address.country", select: "name"}])
                .session(session ?? null)
            : null;
        if (!location) throw apiValidationException("rental_location_not_found", "", null, languageCode);
        return location;
    };
    const pickupLocation = await findLocation(input.pickupLocation);
    const returnLocation = input.returnLocation === input.pickupLocation ? pickupLocation : await findLocation(input.returnLocation);

    if (!pickupLocation.pickupAllowed) {
        throw apiValidationException("rental_location_no_pickup", "", null, languageCode, [pickupLocation.name]);
    }
    if (!returnLocation.returnAllowed) {
        throw apiValidationException("rental_location_no_return", "", null, languageCode, [returnLocation.name]);
    }

    const pickupAt = localToUtc(input.pickupDate, input.pickupTime, pickupLocation.timezone);
    if (!pickupAt) throw apiValidationException("rental_invalid_pickup_time", "", null, languageCode);
    const returnAt = localToUtc(input.returnDate, input.returnTime, returnLocation.timezone);
    if (!returnAt) throw apiValidationException("rental_invalid_return_time", "", null, languageCode);

    if (returnAt <= pickupAt) {
        throw apiValidationException("rental_return_before_pickup", "", null, languageCode);
    }
    const duration = returnAt.getTime() - pickupAt.getTime();
    if (duration < config.minRentalHours * HOUR) {
        throw apiValidationException("rental_duration_too_short", "", null, languageCode, [String(config.minRentalHours)]);
    }
    if (duration > config.maxRentalDays * DAY) {
        throw apiValidationException("rental_duration_too_long", "", null, languageCode, [String(config.maxRentalDays)]);
    }
    if (online && pickupAt.getTime() < now.getTime() + config.minLeadTimeHours * HOUR) {
        throw apiValidationException("rental_pickup_too_soon", "", null, languageCode, [String(config.minLeadTimeHours)]);
    }
    if (pickupAt.getTime() > now.getTime() + config.maxAdvanceDays * DAY) {
        throw apiValidationException("rental_pickup_too_far_ahead", "", null, languageCode, [String(config.maxAdvanceDays)]);
    }
    if (!isLocationOpenAt(pickupLocation, pickupAt)) {
        throw apiValidationException("rental_location_closed_at_pickup", "", null, languageCode, [pickupLocation.name]);
    }
    if (!isLocationOpenAt(returnLocation, returnAt)) {
        throw apiValidationException("rental_location_closed_at_return", "", null, languageCode, [returnLocation.name]);
    }

    return {pickupLocation, returnLocation, pickupAt, returnAt};
}
