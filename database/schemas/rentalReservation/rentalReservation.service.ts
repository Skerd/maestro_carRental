import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalReservation, {IRentalReservation} from "./rentalReservation";
import type {ClientSession, FilterQuery} from "mongoose";

export class RentalReservationService extends BaseCrudService<IRentalReservation, typeof RentalReservation> {
    constructor() {
        super(RentalReservation, "RentalReservation");
    }

    /** The latest booking handed over among those matching, e.g. who had the car at a given time. */
    findLastHandedOver(filter: FilterQuery<IRentalReservation>, session?: ClientSession) {
        return this.model.findOne(filter).sort({"handover.at": -1}).session(session ?? null);
    }

    /** Ids of the cars booked by the matching reservations. */
    distinctVehicles(filter: FilterQuery<IRentalReservation>, session?: ClientSession | null) {
        return this.model.distinct("vehicle", filter).session(session ?? null);
    }
}

export const rentalReservationService = new RentalReservationService();
