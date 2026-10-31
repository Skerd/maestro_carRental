import type {ClientSession} from "mongoose";
import {ObjectId} from "mongodb";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {roundMoney} from "@coreModule/utilities/helpers/money";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
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
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import {assertCustomerAllowed} from "./rentalDeny";
import {applyDriverFees, assertDriversReadyForHandover} from "./rentalDrivers";
import {computeRentalQuote} from "./rentalQuote";
import {isLocationOpenAt} from "./rentalTrip";
import {loadSelectedExtras, quoteTrip} from "./rentalReservationService";
import {releasePromoCode} from "./rentalPromo";
import {generateRentalAgreementPdf} from "../pdf/rentalAgreementPdf";
import {invoiceAttachment, invoiceNewLines} from "./rentalInvoices";
import {
    acknowledgedDamageIds,
    companyMediaIds,
    recordReturnDamages,
    type MediaIdsInput,
    type NewDamageInput,
} from "./rentalInspection";
import {busyUntil, busyVehicleIds, lockVehicle} from "./rentalAvailability";
import {
    amountDue,
    currencyCodeOf,
    paymentStatusFor,
    refundRentalPayments,
} from "./rentalPayments";
import {totalsFor} from "./rentalQuote";
import {
    formatAmount,
    notifyRentalCustomer,
    notifyRentalStaff,
} from "./rentalNotify";
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
): number {
    if (now < freeCancellationUntil(reservation)) return 0;
    return roundMoney(
        (reservation.pricing.grandTotal *
            reservation.policy.cancellationFeePercent) /
            100,
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
    const fee = input.applyFee ? cancellationFeeFor(reservation, now) : 0;

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
        roundMoney(reservation.amountPaid - fee),
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
 * Refused until every driver has a licence that is valid to the return day.
 */
export async function handOverRentalReservation(
    reservation: IRentalReservation,
    input: HandoverInput,
    ctx: Ctx,
): Promise<void> {
    assertStatus(reservation, ["confirmed"], ctx.languageCode);
    const companyId = nestedEntityToRef(reservation.company)!;
    const [vehicle, category] = await Promise.all([
        Vehicle.findOne({_id: reservation.vehicle, company: companyId}).session(
            ctx.session,
        ),
        VehicleCategory.findOne({_id: reservation.category, company: companyId})
            .select("minDriverAge")
            .session(ctx.session),
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
    const now = input.now ?? new Date();
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
        await notifyRentalCustomer("handedOver", reservation, ctx, {
            attachments: async () => [
                {
                    filename: `${reservation.number}.pdf`,
                    content: await generateRentalAgreementPdf(
                        reservation,
                        ctx.languageCode,
                    ),
                },
            ],
        });
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

    for (const charge of input.extraCharges ?? []) {
        const amount = roundMoney(charge.amount);
        reservation.pricing.lines.push({
            label: charge.label,
            kind: "charge",
            code: charge.code,
            quantity: 1,
            unitPrice: amount,
            total: amount,
        });
    }
    Object.assign(
        reservation.pricing,
        totalsFor(
            reservation.pricing.lines,
            reservation.pricing.vatRate,
            reservation.pricing.pricesIncludeVat,
        ),
    );
    reservation.paymentStatus = paymentStatusFor(reservation, false);

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
            invoice
                ? {
                      attachments: invoiceAttachment(
                          invoice._id,
                          ctx.languageCode,
                      ),
                  }
                : {},
        );
    }
    // The car is wherever it was returned; for a one-way rental that is another location.
    await Vehicle.updateOne(
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
    const currencyCode = await currencyCodeOf(reservation, ctx.session);
    const due = amountDue(reservation);
    if (
        !adapter ||
        due <= 0 ||
        adapter.toMinorUnits(due, currencyCode) !== intent.amountMinor ||
        (intent.currencyCode &&
            intent.currencyCode.toLowerCase() !== currencyCode)
    ) {
        ctx.logger.err(
            `Rental payment ${intent.id} does not match reservation ${reservation.number}; left for staff to review`,
        );
        return;
    }

    reservation.amountPaid = roundMoney(reservation.amountPaid + due);
    reservation.paymentStatus = paymentStatusFor(reservation, false);
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
            reservation.amountPaid,
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
    for (const charge of charges) {
        const amount = roundMoney(charge.amount);
        reservation.pricing.lines.push({
            label: charge.label,
            kind: "charge",
            code: charge.code,
            quantity: 1,
            unitPrice: amount,
            total: amount,
        });
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
        totalsFor(
            reservation.pricing.lines,
            reservation.pricing.vatRate,
            reservation.pricing.pricesIncludeVat,
        ),
    );
    reservation.paymentStatus = paymentStatusFor(reservation, false);
    await reservation.save({session: ctx.session});
    // After the return the booking is invoiced already, so a later charge gets its own invoice.
    const invoice =
        reservation.status === "completed"
            ? await invoiceNewLines(reservation, ctx)
            : undefined;
    if (!input.silent) {
        await notifyRentalCustomer("charged", reservation, ctx, {
            note: notes.join(", "),
            ...(invoice
                ? {
                      attachments: invoiceAttachment(
                          invoice._id,
                          ctx.languageCode,
                      ),
                  }
                : {}),
        });
    }
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
        RentalLocation.findOne({
            _id: reservation.returnLocation,
            company: companyId,
        }).session(ctx.session),
        VehicleCategory.findOne({
            _id: reservation.category,
            company: companyId,
        }).session(ctx.session),
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

    const quoteFor = (returnAt: Date) =>
        computeRentalQuote({
            category,
            extras: reservation.extras.map(
                ({name, pricing, unitPrice, quantity}) => ({
                    name,
                    pricing,
                    price: unitPrice,
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
            },
        });
    const longer = quoteFor(newReturnAt);
    const original = quoteFor(reservation.returnAt);
    const extension = roundMoney(
        Math.max(0, longer.subtotal - original.subtotal),
    );
    if (extension > 0) {
        reservation.pricing.lines.push({
            label: category.name,
            kind: "extension",
            quantity: 1,
            unitPrice: extension,
            total: extension,
        });
    }
    reservation.pricing.rentalDays = longer.rentalDays;
    applyDriverFees(reservation, config, ctx.languageCode);
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
            VehicleCategory.findOne({
                _id: reservation.category,
                company: companyId,
            }).session(ctx.session),
            RentalLocation.findOne({
                _id: reservation.pickupLocation,
                company: companyId,
            }).session(ctx.session),
            RentalLocation.findOne({
                _id: reservation.returnLocation,
                company: companyId,
            }).session(ctx.session),
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
        {languageCode: ctx.languageCode, crossBorder: reservation.crossBorder},
    );
    const extraLines = quote.lines.filter((line) => line.kind === "extra");
    reservation.extras = extras.map(({extra, quantity}) => ({
        extra: extra._id,
        name: extra.name,
        pricing: extra.pricing,
        unitPrice: extra.price,
        quantity,
        total: extraLines.find((line) => line.label === extra.name)?.total ?? 0,
    }));
    reservation.pricing.lines = [
        ...reservation.pricing.lines.filter((line) => line.kind !== "extra"),
        ...extraLines,
    ];
    Object.assign(
        reservation.pricing,
        totalsFor(
            reservation.pricing.lines,
            reservation.pricing.vatRate,
            reservation.pricing.pricesIncludeVat,
        ),
    );
    reservation.paymentStatus = paymentStatusFor(reservation, false);
    reservation.timeline.push({
        event: "charge_added",
        at: now,
        note: extras.map(({extra}) => extra.name).join(", "),
    });
    await reservation.save({session: ctx.session});
}
