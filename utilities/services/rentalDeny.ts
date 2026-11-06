import type {ClientSession} from "mongoose";
import type {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";

import {rentalDenyEntryService} from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry.service";
type Ctx = {session?: ClientSession; languageCode: string};

/**
 * Refuses a booking or a handover when an active deny-list row matches the
 * customer's email or a driver's licence number.
 */
export async function assertCustomerAllowed(
    companyId: ObjectId,
    customer: {email?: string; licenseNumbers: string[]},
    ctx: Ctx,
): Promise<void> {
    const email = customer.email?.trim().toLowerCase();
    const licenses = customer.licenseNumbers
        .map((license) => license.trim().toUpperCase())
        .filter((license) => license.length > 0);
    if (!email && !licenses.length) return;
    const or = [
        ...(email ? [{email}] : []),
        ...licenses.map((licenseNumber) => ({licenseNumber})),
    ];
    const blocked = await rentalDenyEntryService.findOne({
        company: companyId,
        isActive: true,
        deletedAt: null,
        $or: or,
    }, {session: ctx.session ?? undefined});
    if (blocked)
        throw apiValidationException(
            "rental_customer_denied",
            "",
            null,
            ctx.languageCode,
        );
}
