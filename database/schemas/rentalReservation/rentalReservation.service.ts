import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import RentalReservation, {IRentalReservation} from "./rentalReservation";
import type {ClientSession, FilterQuery} from "mongoose";
import type {ObjectId} from "mongodb";

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

    /**
     * Gives the account every booking made with this email that no account holds yet (P23.9). `customer` is immutable,
     * so no edit moves a booking to another account; this is the one write that sets it, only where it is unset, and
     * `strict: false` is how Mongoose 6 lets an update write an immutable path.
     */
    claimGuestBookings(email: string, accountId: ObjectId, session: ClientSession) {
        return this.model.updateMany(
            {"contact.email": email, customer: null, deletedAt: null},
            {$set: {customer: accountId}},
            {session, strict: false},
        );
    }
}

export const rentalReservationService = new RentalReservationService();
