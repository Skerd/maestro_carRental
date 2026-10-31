import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import RentalReservation, {type IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

/** The main driver's name, or the booking contact's when no driver was recorded. */
export function mainDriverName(reservation: IRentalReservation): string {
    const driver = reservation.drivers?.find((entry) => entry.role === "primary") ?? reservation.contact;
    return `${driver.firstName} ${driver.lastName}`.trim();
}

/**
 * The booking that had the car at the time of an offence: handed over before it
 * and returned after it (or still on the road). Undefined when the car was not rented out.
 */
export async function bookingAtOffence(
    input: {companyId: ObjectId; vehicleId: ObjectId; offenceAt: Date},
    session: ClientSession | null,
): Promise<IRentalReservation | undefined> {
    const reservation = await RentalReservation.findOne({
        company: input.companyId,
        vehicle: input.vehicleId,
        deletedAt: null,
        "handover.at": {$lte: input.offenceAt},
        $or: [{status: "in_progress"}, {status: "completed", "returnInfo.at": {$gte: input.offenceAt}}],
    }).sort({"handover.at": -1}).session(session);
    return reservation ?? undefined;
}
