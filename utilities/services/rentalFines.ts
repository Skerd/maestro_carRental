import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import RentalReservation, {type IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleTransfer, {type IVehicleTransfer} from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";

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

/**
 * The staff transfer that had the car at the time of an offence: on its way (or done)
 * and between departure and arrival. Its driver is a staff member, so the fine is internal.
 */
export async function transferAtOffence(
    input: {companyId: ObjectId; vehicleId: ObjectId; offenceAt: Date},
    session: ClientSession | null,
): Promise<IVehicleTransfer | undefined> {
    const transfer = await VehicleTransfer.findOne({
        company: input.companyId,
        vehicle: input.vehicleId,
        deletedAt: null,
        status: {$in: ["in_transit", "done"]},
        departAt: {$lte: input.offenceAt},
        arriveAt: {$gte: input.offenceAt},
    })
        .populate("driver", "name surname")
        .session(session);
    return transfer ?? undefined;
}

/** Who had the car at the time of an offence: a booking and its main driver, else a transfer and its driver. */
export async function matchFine(
    input: {companyId: ObjectId; vehicleId: ObjectId; offenceAt: Date},
    session: ClientSession | null,
): Promise<{reservation?: IRentalReservation; transfer?: IVehicleTransfer; driverName?: string}> {
    const reservation = await bookingAtOffence(input, session);
    if (reservation) return {reservation, driverName: mainDriverName(reservation)};
    const transfer = await transferAtOffence(input, session);
    if (!transfer) return {};
    const driver = transfer.driver;
    return {transfer, driverName: driver ? `${driver.name} ${driver.surname}`.trim() : undefined};
}
