import type {ClientSession} from "mongoose";
import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {DEFAULT_DECIMAL_PLACES, minorToNumber, percentOfMoney, roundToCurrency, subtractMoney, toMinor} from "armonia/src/modules/core/helpers/money";
import {decimalToNumber, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {MoneyInput} from "armonia/src/modules/core/helpers/money";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import type {SettledPaymentIntent} from "@financeModule/utilities/services/payment/paymentSourceHandlers";
import type {
    RentalPriceLineCode,
    RentalReservationStatus,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {
    IRentalReservation,
    IRentalVehicleCheck,
} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import VehicleCategory from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {localToUtc} from "@coreModule/utilities/time/timeWindows";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {assertCustomerAllowed} from "@carRentalModule/utilities/services/rentalDeny";
import {assertVehiclePapersValid} from "@carRentalModule/utilities/services/vehicleRecords";
import {applyDriverFees, assertDriversReadyForHandover} from "@carRentalModule/utilities/services/rentalDrivers";
import {computeRentalQuote, quoteCategoryFor} from "@carRentalModule/utilities/services/rentalQuote";
import {isLocationOpenAt} from "@carRentalModule/utilities/services/rentalTrip";
import {loadSelectedExtras, quoteTrip} from "@carRentalModule/workflows/rentalReservationService";
import {releasePromoCode} from "@carRentalModule/utilities/services/rentalPromo";
import {creditInvoicedLines, invoiceNewLines} from "@carRentalModule/utilities/services/rentalInvoices";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";
import {
    acknowledgedDamageIds,
    companyMediaIds,
    recordReturnDamages,
    type MediaIdsInput,
    type NewDamageInput,
} from "@carRentalModule/utilities/services/rentalInspection";
import {busyUntil, busyVehicleIds, lockVehicle, needsTransferFor} from "@carRentalModule/utilities/services/rentalAvailability";
import {rentalExtraService} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.service";
import {vehicleListingTitle} from "armonia/src/modules/carRental/helpers/vehicleRates";
import type {RentalReassignPricing} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.schema-def";
import {
    addToAmountPaid,
    amountDue,
    paymentStatusFor,
    refundRentalPayments,
    reservationCurrency,
} from "@carRentalModule/utilities/services/rentalPayments";
import {storedAmount, storedPriceLine, storedTotalsFor} from "@carRentalModule/utilities/services/rentalQuote";
import {
    formatAmount,
    notifyRentalCustomer,
    notifyRentalStaff,
} from "@carRentalModule/utilities/services/rentalNotify";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

const HOUR = 3600 * 1000;

type Ctx = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    auditUserId?: string | ObjectId;
};

export function assertStatus(
    reservation: IRentalReservation,
    allowed: RentalReservationStatus[],
    languageCode: string,
): void {
    if (!allowed.includes(reservation.status)) {
        throw apiValidationException(
            "rental_reservation_invalid_status",
            "",
            null,
            languageCode,
        );
    }
}

/** Last moment a cancellation is free, under the policy the customer booked with. */
export function freeCancellationUntil(
    reservation: Pick<IRentalReservation, "pickupAt" | "policy">,
): Date {
    return new Date(
        reservation.pickupAt.getTime() -
            reservation.policy.freeCancellationHours * HOUR,
    );
}

/** The fee a cancellation at `now` costs: nothing before the free-cancellation deadline. */
export function cancellationFeeFor(
    reservation: Pick<IRentalReservation, "pickupAt" | "policy" | "pricing">,
    now: Date,
    decimals: number = DEFAULT_DECIMAL_PLACES,
): number {
    if (now < freeCancellationUntil(reservation)) return 0;
    return percentOfMoney(
        reservation.pricing.grandTotal,
        reservation.policy.cancellationFeePercent,
        decimals,
    );
}

/** Cancels the gateway intent of an unpaid hold once the transaction has committed. */
async function cancelIntentAfterCommit(
    reservation: IRentalReservation,
    ctx: Ctx,
): Promise<void> {
    const intentId = reservation.stripePaymentIntentId;
    if (!intentId || reservation.paymentStatus === "paid") return;
    await runAfterCommit(ctx.session, async () => {
        await getPaymentAdapter("stripe")?.cancelPaymentIntent(intentId);
    });
}

/**
 * Cancels a held or confirmed reservation. What was paid comes back minus the fee
 * (when one applies); the payment status only changes once a refund is recorded.
 * Old guest links stop working.
 */
export async function cancelRentalReservation(
    reservation: IRentalReservation,
    input: {
        by: "customer" | "staff" | "system";
        reason?: string;
        applyFee: boolean;
        now?: Date;
    },
    ctx: Ctx,
): Promise<{fee: number; refunded: number}> {
    assertStatus(reservation, ["held", "confirmed"], ctx.languageCode);
    const now = input.now ?? new Date();
    const {decimalPlaces} = await reservationCurrency(reservation, ctx.session);
    const fee = input.applyFee ? cancellationFeeFor(reservation, now, decimalPlaces) : 0;

    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    reservation.cancelledBy = input.by;
    reservation.cancellationReason = input.reason;
    reservation.holdExpiresAt = undefined;
    reservation.manageTokenVersion += 1;
    reservation.timeline.push({
        event: "cancelled",
        at: now,
        note:
            [input.reason, fee > 0 ? `fee ${fee}` : undefined]
                .filter(Boolean)
                .join(" · ") || undefined,
    });

    await releasePromoCode(reservation, ctx.session);
    const refunded = await refundRentalPayments(
        reservation,
        subtractMoney(reservation.amountPaid, fee, decimalPlaces),
        input.reason ?? "cancelled",
        ctx,
    );
    await cancelIntentAfterCommit(reservation, ctx);
    await reservation.save({session: ctx.session});
    await notifyRentalCustomer("cancelled", reservation, ctx);
    if (input.by === "customer") {
        await notifyRentalStaff(
            NotificationEventCodes.RENTAL_RESERVATION_CANCELLED,
            reservation,
            ctx,
        );
    }
    return {fee, refunded};
}

/**
 * What staff record when the car leaves or comes back; photos are uploaded media ids.
 * `now` defaults to the present (the demo seed replays past dates).
 */
type VehicleCheckInput = Pick<
    IRentalVehicleCheck,
    "odometerKm" | "fuelLevel" | "notes"
> & {
    photos?: MediaIdsInput;
    by?: ObjectId;
    now?: Date;
    /** No customer email (the demo seed replays bookings of made-up customers). */
    silent?: boolean;
};

/** At handover: the damage reports the customer saw, and the signature (uploaded first). */
type HandoverInput = VehicleCheckInput & {
    acknowledgedDamages?: string[];
    signature?: {toString(): string};
    signerName?: string;
};

/**
 * The customer drives off: odometer and fuel are recorded and the car is on the road.
 * Refused until every driver has a licence that is valid to the return day, and while
 * the car's insurance or road papers run out before the return.
 */
export async function handOverRentalReservation(
    reservation: IRentalReservation,
    input: HandoverInput,
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["confirmed"], ctx.languageCode);
    const companyId = nestedEntityToRef(reservation.company)!;
    const [vehicle, category] = await Promise.all([
        vehicleService.findOne({_id: reservation.vehicle, company: companyId}, {session: ctx.session}),
        vehicleCategoryService.findOne(
            {_id: reservation.category, company: companyId},
            {session: ctx.session},
            undefined,
            "minDriverAge",
        ),
    ]);
    assertDriversReadyForHandover(
        reservation,
        category?.minDriverAge,
        ctx.languageCode,
    );
    await assertCustomerAllowed(
        companyId,
        {
            email: reservation.contact.email,
            licenseNumbers: reservation.drivers
                .map((driver) => driver.licenseNumber)
                .filter((license): license is string => Boolean(license)),
        },
        ctx,
    );
    const now = input.now ?? new Date();
    if (vehicle) {
        await assertVehiclePapersValid({_id: vehicle._id, plate: vehicle.plate}, {from: now, until: reservation.returnAt}, {companyId, session: ctx.session, languageCode: ctx.languageCode});
    }
    const [photos, acknowledgedDamages, [signature]] = await Promise.all([
        companyMediaIds(input.photos, companyId, ctx),
        acknowledgedDamageIds(
            input.acknowledgedDamages,
            reservation,
            companyId,
            ctx,
        ),
        companyMediaIds(
            input.signature ? [input.signature] : [],
            companyId,
            ctx,
        ),
    ]);
    reservation.status = "in_progress";
    reservation.handover = {
        at: now,
        by: input.by,
        odometerKm: input.odometerKm,
        fuelLevel: input.fuelLevel,
        notes: input.notes,
        photos,
        acknowledgedDamages,
    };
    reservation.agreement = signature
        ? {
              signedAt: now,
              signerName: input.signerName,
              signature,
              termsVersion: reservation.policy.termsVersion,
          }
        : {termsVersion: reservation.policy.termsVersion};
    reservation.snapshot.vehicleLabel = vehicle
        ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}`
        : undefined;
    reservation.timeline.push({
        event: "handover",
        at: now,
        by: input.by,
        note: signature ? undefined : "unsigned",
    });
    await reservation.save({session: ctx.session});
    if (vehicle) {
        vehicle.odometerKm = input.odometerKm;
        await vehicle.save({session: ctx.session});
    }
    if (!input.silent)
        await notifyRentalCustomer("handedOver", reservation, ctx, {withAgreement: true});
}

/** The car is back. Extra charges (fuel, km, damage) are added to what the customer owes. */
export async function returnRentalReservation(
    reservation: IRentalReservation,
    input: VehicleCheckInput & {
        damageNoted?: boolean;
        extraCharges?: {
            label: string;
            amount: number;
            code?: RentalPriceLineCode;
        }[];
        newDamages?: NewDamageInput[];
    },
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["in_progress"], ctx.languageCode);
    const now = input.now ?? new Date();
    const companyId = nestedEntityToRef(reservation.company)!;
    const photos = await companyMediaIds(input.photos, companyId, ctx);
    const newDamages = input.newDamages ?? [];
    await recordReturnDamages(reservation, newDamages, {companyId, now}, ctx);

    const {decimalPlaces} = await reservationCurrency(reservation, ctx.session);
    for (const charge of input.extraCharges ?? []) {
        const amount = roundToCurrency(charge.amount, decimalPlaces);
        reservation.pricing.lines.push(storedPriceLine({
            label: charge.label,
            kind: "charge",
            code: charge.code,
            quantity: 1,
            unitPrice: amount,
            total: amount,
        }, decimalPlaces));
    }
    Object.assign(
        reservation.pricing,
        storedTotalsFor(
            reservation.pricing.lines,
            reservation.pricing.vatRate,
            reservation.pricing.pricesIncludeVat,
            decimalPlaces,
        ),
    );
    reservation.paymentStatus = paymentStatusFor(reservation, false, decimalPlaces);

    reservation.status = "completed";
    reservation.returnInfo = {
        at: now,
        by: input.by,
        odometerKm: input.odometerKm,
        fuelLevel: input.fuelLevel,
        notes: input.notes,
        photos,
        damageNoted: (input.damageNoted ?? false) || newDamages.length > 0,
    };
    reservation.timeline.push({event: "returned", at: now, by: input.by});
    await reservation.save({session: ctx.session});
    const invoice = await invoiceNewLines(reservation, ctx, now);
    if (!input.silent) {
        await notifyRentalCustomer(
            "returned",
            reservation,
            ctx,
            invoice ? {invoiceId: invoice._id} : {},
        );
    }
    // The car is wherever it was returned; for a one-way rental that is another location.
    await vehicleService.updateOne(
        {_id: reservation.vehicle, company: companyId},
        {
            $set: {
                odometerKm: input.odometerKm,
                currentLocation: reservation.returnLocation,
                readiness: "needs_cleaning",
            },
        },
        {session: ctx.session},
    );
}

/** The customer never came. The caller checks that the grace period has passed. */
export async function markRentalNoShow(
    reservation: IRentalReservation,
    input: {by?: ObjectId; now?: Date},
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["confirmed"], ctx.languageCode);
    reservation.status = "no_show";
    reservation.timeline.push({
        event: "no_show",
        at: input.now ?? new Date(),
        by: input.by,
    });
    await reservation.save({session: ctx.session});
}

/**
 * Marks a held reservation whose hold ran out as expired, freeing the vehicle for
 * good. Returns false when it was confirmed or changed in the meantime.
 */
export async function expireRentalHold(
    reservation: IRentalReservation,
    ctx: Ctx,
    now = new Date(),
): Promise<boolean> {
    if (
        reservation.status !== "held" ||
        !reservation.holdExpiresAt ||
        reservation.holdExpiresAt > now
    )
        return false;
    reservation.status = "expired";
    reservation.timeline.push({event: "expired", at: now});
    await releasePromoCode(reservation, ctx.session);
    await cancelIntentAfterCommit(reservation, ctx);
    await reservation.save({session: ctx.session});
    return true;
}

/**
 * Applies a succeeded online payment (from the webhook) to its reservation.
 *
 * - The amount must be what the reservation costs, or nothing changes (logged).
 * - A held (or already expired) booking is confirmed if its vehicle is still free;
 *   if the car was taken after the hold ran out, the booking is cancelled and the
 *   money refunded in full. A payment for a cancelled booking is refunded too.
 */
export async function settleRentalPayment(
    reservation: IRentalReservation,
    intent: SettledPaymentIntent,
    ctx: Ctx,
    now = new Date(),
): Promise<void> {
    if (reservation.paymentStatus === "paid") return;
    const adapter = getPaymentAdapter("stripe");
    const currency = await reservationCurrency(reservation, ctx.session);
    const due = amountDue(reservation, currency.decimalPlaces);
    if (
        !adapter ||
        due <= 0 ||
        adapter.toMinorUnits(due, currency.code, currency.decimalPlaces) !== intent.amountMinor ||
        (intent.currencyCode &&
            intent.currencyCode.toLowerCase() !== currency.code)
    ) {
        ctx.logger.err(
            `Rental payment ${intent.id} does not match reservation ${reservation.number}; left for staff to review`,
        );
        return;
    }

    addToAmountPaid(reservation, due, currency.decimalPlaces);
    reservation.paymentStatus = paymentStatusFor(reservation, false, currency.decimalPlaces);
    reservation.timeline.push({event: "payment_received", at: now});

    if (reservation.status === "held" || reservation.status === "expired") {
        const companyId = nestedEntityToRef(reservation.company);
        const vehicleId = nestedEntityToRef(reservation.vehicle);
        await lockVehicle(vehicleId, {
            companyId,
            session: ctx.session,
            languageCode: ctx.languageCode,
            requireActive: false,
        });
        const busy = await busyVehicleIds({
            companyId,
            vehicleIds: [vehicleId],
            start: reservation.pickupAt,
            end: reservation.blockedUntil,
            now,
            excludeReservationId: reservation._id,
            session: ctx.session,
        });
        if (!busy.size) {
            reservation.status = "confirmed";
            reservation.holdExpiresAt = undefined;
            reservation.timeline.push({event: "confirmed", at: now});
            await reservation.save({session: ctx.session});
            await notifyRentalCustomer("confirmed", reservation, ctx);
            await notifyRentalStaff(
                NotificationEventCodes.RENTAL_RESERVATION_NEW,
                reservation,
                ctx,
            );
            return;
        }
        reservation.status = "cancelled";
        reservation.cancelledAt = now;
        reservation.cancelledBy = "system";
        reservation.cancellationReason = "payment_after_expiry";
        reservation.holdExpiresAt = undefined;
        reservation.manageTokenVersion += 1;
        reservation.timeline.push({
            event: "cancelled",
            at: now,
            note: "payment_after_expiry",
        });
    }

    if (reservation.status === "cancelled") {
        await refundRentalPayments(
            reservation,
            minorToNumber(toMinor(reservation.amountPaid, currency.decimalPlaces), currency.decimalPlaces),
            "payment_after_cancellation",
            ctx,
        );
        await notifyRentalCustomer("cancelled", reservation, ctx);
    }
    await reservation.save({session: ctx.session});
}

/** Records a failed online payment; the hold stays so the customer can retry until it runs out. */
export async function failRentalPayment(
    reservation: IRentalReservation,
    intent: SettledPaymentIntent,
    ctx: Ctx,
): Promise<void> {
    if (reservation.status !== "held") return;
    reservation.paymentStatus = "failed";
    reservation.timeline.push({
        event: "payment_failed",
        at: new Date(),
        note: intent.failureReason,
    });
    await reservation.save({session: ctx.session});
}

/**
 * Charges added after the booking was priced: damage found later, a traffic
 * fine and its handling fee. The customer owes them on top and gets one email.
 */
export async function addReservationCharges(
    reservation: IRentalReservation,
    charges: {label: string; amount: number; code: RentalPriceLineCode}[],
    input: {by?: ObjectId; now?: Date; silent?: boolean},
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["in_progress", "completed"], ctx.languageCode);
    const notes: string[] = [];
    const {decimalPlaces} = await reservationCurrency(reservation, ctx.session);
    for (const charge of charges) {
        const amount = roundToCurrency(charge.amount, decimalPlaces);
        reservation.pricing.lines.push(storedPriceLine({
            label: charge.label,
            kind: "charge",
            code: charge.code,
            quantity: 1,
            unitPrice: amount,
            total: amount,
        }, decimalPlaces));
        reservation.timeline.push({
            event: "charge_added",
            at: input.now ?? new Date(),
            by: input.by,
            note: `${charge.label} · ${amount}`,
        });
        notes.push(
            `${charge.label} (${await formatAmount(reservation, amount, ctx.languageCode)})`,
        );
    }
    Object.assign(
        reservation.pricing,
        storedTotalsFor(
            reservation.pricing.lines,
            reservation.pricing.vatRate,
            reservation.pricing.pricesIncludeVat,
            decimalPlaces,
        ),
    );
    reservation.paymentStatus = paymentStatusFor(reservation, false, decimalPlaces);
    await reservation.save({session: ctx.session});
    // After the return the booking is invoiced already, so a later charge gets its own invoice.
    const invoice =
        reservation.status === "completed"
            ? await invoiceNewLines(reservation, ctx)
            : undefined;
    if (!input.silent) {
        await notifyRentalCustomer("charged", reservation, ctx, {
            note: notes.join(", "),
            ...(invoice ? {invoiceId: invoice._id} : {}),
        });
    }
}

/**
 * Takes charges added by `addReservationCharges` back off the booking (a fine the
 * authority annulled). Not invoiced yet (before the return), the lines are removed;
 * invoiced, they are credited on their invoice and offset by negative lines. What the
 * customer paid beyond the new total is refunded.
 */
export async function removeReservationCharges(
    reservation: IRentalReservation,
    charges: {label: string; amount: number}[],
    input: {by?: ObjectId; reason: string},
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["in_progress", "completed"], ctx.languageCode);
    const lines = reservation.pricing.lines;
    const invoicedCount = reservation.invoicedLineCount ?? 0;
    const {decimalPlaces} = await reservationCurrency(reservation, ctx.session);
    const credited: {description: string; total: MoneyInput}[] = [];
    for (const charge of charges) {
        let index = -1;
        for (let i = lines.length - 1; i >= 0 && index < 0; i--) {
            if (lines[i].kind === "charge" && lines[i].label === charge.label && decimalToNumber(lines[i].total) === charge.amount) index = i;
        }
        if (index < 0) throw apiValidationException("rental_charge_not_found", "", null, ctx.languageCode);
        const [line] = index >= invoicedCount ? lines.splice(index, 1) : [lines[index]];
        if (index < invoicedCount) {
            credited.push({description: line.label, total: line.total});
            const removed = -(decimalToNumber(line.total) ?? 0);
            lines.push(storedPriceLine({
                label: rentalPricingLabel(ctx.languageCode, "chargeRemoved", {label: line.label}),
                kind: "charge",
                code: line.code,
                quantity: 1,
                unitPrice: removed,
                total: removed,
            }, decimalPlaces));
        }
        reservation.timeline.push({event: "charge_removed", at: new Date(), by: input.by, note: `${line.label} · ${line.total}`});
    }
    Object.assign(reservation.pricing, storedTotalsFor(lines, reservation.pricing.vatRate, reservation.pricing.pricesIncludeVat, decimalPlaces));
    if (credited.length) {
        await creditInvoicedLines(reservation, credited, ctx);
        reservation.invoicedLineCount = lines.length;
    }
    const overpaid = minorToNumber(toMinor(reservation.amountPaid, decimalPlaces) - toMinor(reservation.pricing.grandTotal, decimalPlaces), decimalPlaces);
    if (overpaid > 0) await refundRentalPayments(reservation, overpaid, input.reason, ctx);
    else reservation.paymentStatus = paymentStatusFor(reservation, false, decimalPlaces);
    await reservation.save({session: ctx.session});
}

/**
 * Keeps the car longer. The extra days are charged at today's prices: the
 * difference between today's price for the longer and the original trip.
 */
export async function extendRentalReservation(
    reservation: IRentalReservation,
    input: {returnDate: string; returnTime: string; by?: ObjectId},
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["confirmed", "in_progress"], ctx.languageCode);
    const companyId = nestedEntityToRef(reservation.company)!;
    const [config, returnLocation, category] = await Promise.all([
        carRentalConfigService.getOrCreateForCompany(companyId, ctx),
        rentalLocationService.findOne({_id: reservation.returnLocation, company: companyId}, {session: ctx.session}),
        vehicleCategoryService.findOne({_id: reservation.category, company: companyId}, {session: ctx.session}),
    ]);
    if (!returnLocation || !category)
        throw apiValidationException(
            "rental_reservation_not_found",
            "",
            null,
            ctx.languageCode,
        );

    const newReturnAt = localToUtc(
        input.returnDate,
        input.returnTime,
        returnLocation.timezone,
    );
    if (!newReturnAt)
        throw apiValidationException(
            "rental_invalid_return_time",
            "",
            null,
            ctx.languageCode,
        );
    if (newReturnAt <= reservation.returnAt)
        throw apiValidationException(
            "rental_return_before_pickup",
            "",
            null,
            ctx.languageCode,
        );
    if (!isLocationOpenAt(returnLocation, newReturnAt)) {
        throw apiValidationException(
            "rental_location_closed_at_return",
            "",
            null,
            ctx.languageCode,
            [returnLocation.name],
        );
    }

    const newBlockedUntil = busyUntil(
        newReturnAt,
        config.turnaroundBufferMinutes,
    );
    const vehicleId = new ObjectId(String(reservation.vehicle));
    await lockVehicle(vehicleId, {
        companyId,
        session: ctx.session,
        languageCode: ctx.languageCode,
        requireActive: false,
    });
    const busy = await busyVehicleIds({
        companyId,
        vehicleIds: [vehicleId],
        start: reservation.pickupAt,
        end: newBlockedUntil,
        now: new Date(),
        excludeReservationId: reservation._id,
        session: ctx.session,
    });
    if (busy.size)
        throw apiValidationException(
            "vehicle_unavailable",
            "",
            null,
            ctx.languageCode,
        );

    const {decimalPlaces} = await reservationCurrency(reservation, ctx.session);
    // An exact booking's extra days are at that car's prices, as booked (D198).
    const exactVehicle = reservation.exactVehicle
        ? (await vehicleService.findOne({_id: vehicleId, company: companyId}, {session: ctx.session})) ?? undefined
        : undefined;
    const priced = quoteCategoryFor(category, exactVehicle);
    const quoteFor = (returnAt: Date) =>
        computeRentalQuote({
            category: priced,
            extras: reservation.extras.map(
                ({name, pricing, unitPrice, quantity}) => ({
                    name,
                    pricing,
                    price: minorToNumber(toMinor(unitPrice, decimalPlaces), decimalPlaces),
                    quantity,
                }),
            ),
            pickupAt: reservation.pickupAt,
            returnAt,
            timeZone: reservation.snapshot.timezone,
            settings: {
                vatRate: reservation.pricing.vatRate,
                pricesIncludeVat: reservation.pricing.pricesIncludeVat,
                lateGraceMinutes: config.lateGraceMinutes,
                decimalPlaces,
            },
        });
    const longer = quoteFor(newReturnAt);
    const original = quoteFor(reservation.returnAt);
    const extension = Math.max(0, subtractMoney(longer.subtotal, original.subtotal, decimalPlaces));
    if (extension > 0) {
        reservation.pricing.lines.push(storedPriceLine({
            label: priced.name,
            kind: "extension",
            quantity: 1,
            unitPrice: extension,
            total: extension,
        }, decimalPlaces));
    }
    reservation.pricing.rentalDays = longer.rentalDays;
    applyDriverFees(reservation, config, ctx.languageCode, decimalPlaces);
    reservation.returnAt = newReturnAt;
    reservation.blockedUntil = newBlockedUntil;
    reservation.timeline.push({
        event: "extended",
        at: new Date(),
        by: input.by,
        note: newReturnAt.toISOString(),
    });
    await reservation.save({session: ctx.session});
}

/**
 * Adds extras before pickup. The rental price stays as booked; only the extra
 * lines are replaced with a fresh quote.
 */
export async function addRentalExtras(
    reservation: IRentalReservation,
    selections: {extra: string; quantity: number}[],
    ctx: Ctx,
): Promise<void> {
    const now = new Date();
    if (
        (reservation.status !== "confirmed" && reservation.status !== "held") ||
        reservation.pickupAt <= now
    ) {
        throw apiValidationException(
            "rental_extend_not_open",
            "",
            null,
            ctx.languageCode,
        );
    }
    const companyId = nestedEntityToRef(reservation.company)!;
    const [config, category, pickupLocation, returnLocation, extras] =
        await Promise.all([
            carRentalConfigService.getOrCreateForCompany(companyId, ctx),
            vehicleCategoryService.findOne({_id: reservation.category, company: companyId}, {session: ctx.session}),
            rentalLocationService.findOne({_id: reservation.pickupLocation, company: companyId}, {session: ctx.session}),
            rentalLocationService.findOne({_id: reservation.returnLocation, company: companyId}, {session: ctx.session}),
            loadSelectedExtras(companyId, selections, {
                languageCode: ctx.languageCode,
                session: ctx.session,
            }),
        ]);
    if (!category || !pickupLocation || !returnLocation)
        throw apiValidationException(
            "rental_reservation_not_found",
            "",
            null,
            ctx.languageCode,
        );
    const {decimalPlaces} = await reservationCurrency(reservation, ctx.session);
    const quote = quoteTrip(
        config,
        category,
        extras,
        {
            pickupAt: reservation.pickupAt,
            returnAt: reservation.returnAt,
            pickupLocation,
            returnLocation,
        },
        {languageCode: ctx.languageCode, crossBorder: reservation.crossBorder, decimalPlaces},
    );
    const extraLines = quote.lines.filter((line) => line.kind === "extra");
    reservation.extras = extras.map(({extra, quantity}) => ({
        extra: extra._id,
        name: extra.name,
        pricing: extra.pricing,
        unitPrice: storedAmount(extra.price, decimalPlaces),
        quantity,
        total: storedAmount(extraLines.find((line) => line.label === extra.name)?.total ?? 0, decimalPlaces),
    }));
    reservation.pricing.lines = [
        ...reservation.pricing.lines.filter((line) => line.kind !== "extra"),
        ...extraLines.map((line) => storedPriceLine(line, decimalPlaces)),
    ];
    Object.assign(
        reservation.pricing,
        storedTotalsFor(
            reservation.pricing.lines,
            reservation.pricing.vatRate,
            reservation.pricing.pricesIncludeVat,
            decimalPlaces,
        ),
    );
    reservation.paymentStatus = paymentStatusFor(reservation, false, decimalPlaces);
    reservation.timeline.push({
        event: "charge_added",
        at: now,
        note: extras.map(({extra}) => extra.name).join(", "),
    });
    await reservation.save({session: ctx.session});
}

/**
 * "Change car" (D198): moves a booking that has not started to another free car, of its group or of another one.
 * `keep` leaves it as booked, price and km terms included (a free upgrade); `reprice` prices the rental days again
 * for the new car (its own prices when the booking is for an exact car, else its group's) and takes the new group's
 * km terms and deposit, while extras, fees and discount lines keep their amounts. An exact booking stays exact, now
 * for the new car, and its customer is told; a class booking only gets another of the cars it was "similar" to.
 */
export async function reassignRentalVehicle(
    reservation: IRentalReservation,
    input: {vehicleId: ObjectId; pricing?: RentalReassignPricing; by?: ObjectId},
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["held", "confirmed"], ctx.languageCode);
    const companyId = nestedEntityToRef(reservation.company)!;
    const target = await vehicleService.findOne({_id: input.vehicleId, company: companyId, deletedAt: null}, {session: ctx.session});
    if (!target) throw apiValidationException("vehicle_not_found", "", null, ctx.languageCode);
    await lockVehicle(target._id, {companyId, session: ctx.session, languageCode: ctx.languageCode});
    const busy = await busyVehicleIds({
        companyId,
        vehicleIds: [target._id],
        start: reservation.pickupAt,
        end: reservation.blockedUntil,
        now: new Date(),
        excludeReservationId: reservation._id,
        session: ctx.session,
    });
    if (busy.size) throw apiValidationException("vehicle_unavailable", "", null, ctx.languageCode);

    const targetGroupId = nestedEntityToRef(target.category);
    const group = await vehicleCategoryService.findOne({_id: targetGroupId, company: companyId}, {session: ctx.session});
    if (!group) throw apiValidationException("vehicle_category_not_found", "", null, ctx.languageCode);
    if (String(targetGroupId) !== String(nestedEntityToRef(reservation.category))) {
        reservation.category = group._id;
        reservation.snapshot.categoryName = group.name;
    }
    if (input.pricing === "reprice") {
        const [config, {decimalPlaces}] = await Promise.all([
            carRentalConfigService.getOrCreateForCompany(companyId, ctx),
            reservationCurrency(reservation, ctx.session),
        ]);
        const priced = quoteCategoryFor(group, reservation.exactVehicle ? target : undefined);
        const quote = computeRentalQuote({
            category: priced,
            extras: [],
            pickupAt: reservation.pickupAt,
            returnAt: reservation.returnAt,
            timeZone: reservation.snapshot.timezone,
            settings: {
                vatRate: reservation.pricing.vatRate,
                pricesIncludeVat: reservation.pricing.pricesIncludeVat,
                lateGraceMinutes: config.lateGraceMinutes,
                decimalPlaces,
            },
        });
        reservation.pricing.lines = [
            ...quote.lines.filter((line) => line.kind === "rental").map((line) => storedPriceLine(line, decimalPlaces)),
            ...reservation.pricing.lines.filter((line) => line.kind !== "rental"),
        ];
        Object.assign(
            reservation.pricing,
            storedTotalsFor(reservation.pricing.lines, reservation.pricing.vatRate, reservation.pricing.pricesIncludeVat, decimalPlaces),
        );
        // A protection package sets the deposit; otherwise it follows the car now booked.
        const protectedBooking = reservation.extras.length > 0 && await rentalExtraService.exists(
            {_id: {$in: reservation.extras.map((extra) => nestedEntityToRef(extra.extra))}, company: companyId, kind: "protection"},
            {session: ctx.session},
        );
        if (!protectedBooking) reservation.pricing.depositAmount = storedAmount(priced.depositAmount ?? 0, decimalPlaces);
        reservation.snapshot.mileagePolicy = group.mileagePolicy;
        reservation.snapshot.includedKmPerDay = group.includedKmPerDay;
        reservation.snapshot.extraKmPrice = group.extraKmPrice;
        reservation.paymentStatus = paymentStatusFor(reservation, false, decimalPlaces);
    }
    const title = vehicleListingTitle(target);
    if (reservation.exactVehicle) reservation.snapshot.vehicleTitle = title;
    reservation.vehicle = target._id;
    reservation.needsTransfer = await needsTransferFor(
        target._id,
        {locationId: nestedEntityToRef(reservation.pickupLocation)!, at: reservation.pickupAt},
        companyId,
        ctx.session,
    );
    reservation.timeline.push({
        event: "vehicle_reassigned",
        at: new Date(),
        by: input.by,
        note: input.pricing === "reprice" ? `${target.plate} · ${rentalPricingLabel(ctx.languageCode, "repriced")}` : target.plate,
    });
    await reservation.save({session: ctx.session});
    if (reservation.exactVehicle) await notifyRentalCustomer("carChanged", reservation, ctx, {note: title});
}
