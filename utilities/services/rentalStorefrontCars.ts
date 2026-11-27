import type {ObjectId} from "mongodb";
import {notHiddenByPlatform} from "@coreModule/database/plugins/platformHiddenPlugin";
import {publicMediaUrls} from "@coreModule/utilities/media/publicMediaUrl";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {effectiveVehicleRates, vehicleListingTitle} from "armonia/src/modules/carRental/helpers/vehicleRates";
import type {RentalStorefrontCar} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.response.types";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import type {IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {busyVehicleIds, exactCarPlacement} from "@carRentalModule/utilities/services/rentalAvailability";
import {vehiclesWithLapsingPapers} from "@carRentalModule/utilities/services/vehiclePapers";
import type {RentalTrip} from "@carRentalModule/utilities/services/rentalTrip";

/**
 * The cars rented on their own (D198) that the public sees: active, listed, and in one of the public groups given
 * (which already leaves out groups the platform hid). Ordered by group, then by name.
 */
export async function publicCars(companyId: ObjectId, categories: IVehicleCategory[]): Promise<IVehicle[]> {
    if (!categories.length) return [];
    const order = new Map(categories.map((category, index) => [String(category._id), index]));
    const cars = await vehicleService.find(
        // A car the platform hid after a report is gone from every public page (D191).
        {company: companyId, listedAlone: true, status: "active", deletedAt: null, ...notHiddenByPlatform(), category: {$in: categories.map((category) => category._id)}},
        {},
        undefined,
        undefined,
        {make: 1, model: 1, year: -1},
    );
    return cars.sort((a, b) => (order.get(String(nestedEntityToRef(a.category))) ?? 0) - (order.get(String(nestedEntityToRef(b.category))) ?? 0));
}

/** A car for the public site: its own name, photos and prices, never its plate or internal photos. */
export function carToStorefront(car: IVehicle, category: IVehicleCategory): RentalStorefrontCar {
    const rates = effectiveVehicleRates(category, car);
    const own = publicMediaUrls(car.listingImages);
    return {
        _id: car._id.toString(),
        category: category._id.toString(),
        title: vehicleListingTitle(car),
        make: car.make,
        model: car.model,
        ...(car.year !== undefined ? {year: car.year} : {}),
        ...(car.color ? {color: car.color} : {}),
        ...(car.listingDescription ? {description: car.listingDescription} : {}),
        images: own.length ? own : publicMediaUrls(category.images),
        dailyRate: rates.dailyRate,
        depositAmount: rates.depositAmount ?? 0,
        // Its own specs where they differ, else its category's (TD-B291).
        seats: car.seats ?? category.seats,
        ...((car.doors ?? category.doors) !== undefined ? {doors: car.doors ?? category.doors} : {}),
        ...((car.luggage ?? category.luggage) !== undefined ? {luggage: car.luggage ?? category.luggage} : {}),
        transmission: car.transmission ?? category.transmission,
        fuelType: car.fuelType ?? category.fuelType,
    };
}

export type FreeExactCar = {
    car: IVehicle;
    category: IVehicleCategory;
    /** Set when the car is brought from another branch for the company's fee. */
    carTransfer?: {amount: number; fromName: string};
};

/**
 * Which of these cars can be booked online for the trip: free for it (turnaround kept), papers valid through it,
 * and at the pickup branch then or allowed to be brought there (see `exactCarPlacement`). Advisory, like the class
 * search: booking checks again under the car's lock.
 */
export async function freeExactCars(input: {
    companyId: ObjectId;
    config: ICarRentalConfig;
    cars: IVehicle[];
    categories: Map<string, IVehicleCategory>;
    trip: Pick<RentalTrip, "pickupAt" | "returnAt" | "pickupLocation">;
    end: Date;
    now: Date;
    languageCode: string;
}): Promise<FreeExactCar[]> {
    const {companyId, config, trip, now, languageCode} = input;
    const ids = input.cars.map((car) => car._id as ObjectId);
    if (!ids.length) return [];
    const [busy, lapsing] = await Promise.all([
        busyVehicleIds({companyId, vehicleIds: ids, start: trip.pickupAt, end: input.end, now}),
        vehiclesWithLapsingPapers(ids, {from: trip.pickupAt, until: trip.returnAt}, {companyId}),
    ]);
    const free: FreeExactCar[] = [];
    const locationNames = new Map<string, string>();
    for (const car of input.cars) {
        const category = input.categories.get(String(nestedEntityToRef(car.category)));
        if (!category || busy.has(String(car._id)) || lapsing.has(String(car._id))) continue;
        const placement = await exactCarPlacement(
            {_id: car._id as ObjectId, homeLocation: car.homeLocation, currentLocation: car.currentLocation},
            {locationId: trip.pickupLocation._id, at: trip.pickupAt},
            {companyId, config, now, languageCode},
        ).catch(() => null);
        if (placement === null) continue;
        if (!placement) {
            free.push({car, category});
            continue;
        }
        const key = String(placement.fromLocationId);
        if (!locationNames.has(key)) {
            const from = await rentalLocationService.findOne({_id: placement.fromLocationId, company: companyId}, {}, undefined, "name");
            locationNames.set(key, from?.name ?? "");
        }
        free.push({car, category, carTransfer: {amount: placement.fee, fromName: locationNames.get(key) ?? ""}});
    }
    return free;
}
