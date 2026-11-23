import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";

import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {
    RentalReservation as RentalReservationDto,
    RentalDepositResponse,
    RentalExtendWindow,
    RentalFreeVehicle,
    RentalOpenDamage,
    RentalReturnChargesPreview,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.dto";
import {
    cancelRentalReservationFormSchema,
    extendRentalReservationFormSchema,
    handoverRentalReservationFormSchema,
    previewReturnChargesFormSchema,
    reassignRentalVehicleFormSchema,
    recordRentalPaymentFormSchema,
    returnRentalReservationFormSchema,
    saveRentalDriversFormSchema,
    settleRentalDepositFormSchema,
    takeRentalDepositFormSchema,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.form.validators";
import type {
    CancelRentalReservationFormType,
    ExtendRentalReservationFormType,
    HandoverRentalReservationFormType,
    PreviewReturnChargesFormType,
    ReassignRentalVehicleFormType,
    RecordRentalPaymentFormType,
    ReturnRentalReservationFormType,
    SaveRentalDriversFormType,
    SettleRentalDepositFormType,
    TakeRentalDepositFormType,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.schema-def";
import Vehicle from "../vehicle/vehicle";
import VehicleDamage from "../vehicleDamage/vehicleDamage";
import type {VehicleReadiness} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import {
    mapMedia,
    nestedEntityToRef,
} from "@coreModule/utilities/mappers/common.mapper";
import VehicleCategory from "../vehicleCategory/vehicleCategory";
import RentalLocation from "../rentalLocation/rentalLocation";
import RentalReservation, {type IRentalReservation} from "./rentalReservation";
import {carRentalConfigService} from "../carRentalConfig/carRentalConfig.service";
import {rentalReservationToDTO} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {
    blockingReservationFilter,
    busyVehicleIds,
    lockVehicle,
    needsTransferFor,
} from "@carRentalModule/utilities/services/rentalAvailability";
import VehicleBlock from "../vehicleBlock/vehicleBlock";
import {addLocalDays} from "@coreModule/utilities/time/timeWindows";
import {
    assertStatus,
    cancelRentalReservation,
    extendRentalReservation,
    handOverRentalReservation,
    markRentalNoShow,
    returnRentalReservation,
} from "@carRentalModule/workflows/rentalLifecycle";
import {recordCounterPayment, reservationCurrency} from "@carRentalModule/utilities/services/rentalPayments";
import {
    applyDriverFees,
    assertDriverList,
} from "@carRentalModule/utilities/services/rentalDrivers";
import {suggestReturnCharges} from "@carRentalModule/utilities/services/rentalReturnCharges";
import {
    refreshDeposit,
    settleDeposit,
    takeDeposit,
} from "@carRentalModule/utilities/services/rentalDeposit";
import {PAYMENTS} from "@financeModule/environment";
import {vehiclesWithLapsingPapers} from "@carRentalModule/utilities/services/vehiclePapers";

const MINUTE = 60 * 1000;

type ActionParams<F> = TransactionRequiredParams & F;

async function loadReservation(
    params: TransactionRequiredParams & {_id: string},
): Promise<IRentalReservation> {
    const {_id, company, session, languageCode} = params;
    const reservation = ObjectId.isValid(_id)
        ? await RentalReservation.findOne({
              _id: new ObjectId(_id),
              company: company._id,
              deletedAt: null,
          }).session(session)
        : null;
    if (!reservation)
        throw apiValidationException(
            "rental_reservation_not_found",
            "",
            null,
            languageCode,
        );
    return reservation;
}

async function toDto(
    reservation: IRentalReservation,
    params: TransactionRequiredParams,
): Promise<RentalReservationDto> {
    const {session, actionUserCtx, languageCode} = params;
    const readFields = SchemaGuard.sanitizeFields(
        RentalReservation,
        getModelCollectedData("rentalreservations").readFields!,
        "read",
        actionUserCtx,
        languageCode,
    );
    const populate = SchemaGuard.generatePopulate(
        readFields,
        RentalReservation.schema,
    );
    const fresh = await RentalReservation.findById(reservation._id)
        .populate(populate.populate)
        .session(session);
    return rentalReservationToDTO(fresh ?? reservation);
}

function ctxOf(params: TransactionRequiredParams) {
    return {
        session: params.session,
        logger: params.logger,
        languageCode: params.languageCode,
        auditUserId: params.actionUserCtx.userId,
    };
}

export class RentalReservationActions {
    /** Money taken at the counter (cash or card terminal). */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: recordRentalPaymentFormSchema,
    })
    async recordPayment(
        params: ActionParams<RecordRentalPaymentFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        assertStatus(
            reservation,
            ["confirmed", "in_progress", "completed"],
            params.languageCode,
        );
        await recordCounterPayment(
            reservation,
            params.amount,
            params.note,
            ctxOf(params),
        );
        await reservation.save({session: params.session});
        return toDto(reservation, params);
    }

    /** Replaces who may drive and re-prices the driver fees. Licence details can be completed later, up to the handover. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: saveRentalDriversFormSchema,
    })
    async saveDrivers(
        params: ActionParams<SaveRentalDriversFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        assertStatus(
            reservation,
            ["held", "confirmed", "in_progress"],
            params.languageCode,
        );
        const [category, config] = await Promise.all([
            VehicleCategory.findOne({
                _id: reservation.category,
                company: params.company._id,
            })
                .select("minDriverAge")
                .session(params.session),
            carRentalConfigService.getOrCreateForCompany(
                params.company._id,
                ctxOf(params),
            ),
        ]);
        const pickupDate = localDateOf(
            reservation.pickupAt,
            reservation.snapshot.timezone,
        );
        assertDriverList(
            params.drivers,
            {pickupDate, returnDate: localDateOf(reservation.returnAt, reservation.snapshot.timezone), minDriverAge: category?.minDriverAge},
            params.languageCode,
        );

        reservation.drivers = params.drivers;
        const {decimalPlaces} = await reservationCurrency(reservation, params.session);
        applyDriverFees(reservation, config, params.languageCode, decimalPlaces);
        reservation.timeline.push({
            event: "drivers_updated",
            at: new Date(),
            by: new ObjectId(params.actionUserCtx.userId),
        });
        await reservation.save({session: params.session});
        return toDto(reservation, params);
    }

    /** The car's open damage reports for the customer to acknowledge at handover, and whether the car is ready. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 60},
        schema: validateSingleForm,
    })
    async openDamages(
        params: ActionParams<{_id: string}>,
    ): Promise<{data: RentalOpenDamage[]; readiness?: VehicleReadiness}> {
        const reservation = await loadReservation(params);
        const vehicle = await Vehicle.findOne({
            _id: reservation.vehicle,
            company: params.company._id,
        })
            .select("readiness")
            .session(params.session);
        const damages = await VehicleDamage.find({
            company: params.company._id,
            vehicle: reservation.vehicle,
            status: {$in: ["open", "in_repair"]},
            deletedAt: null,
        })
            .sort({reportedAt: -1})
            .populate("photos")
            .session(params.session);
        return {
            data: damages.map((damage) => ({
                _id: damage._id.toString(),
                area: damage.area,
                severity: damage.severity,
                description: damage.description,
                photos: damage.photos
                    ?.map(mapMedia)
                    .filter((media) => media !== undefined),
            })),
            readiness: vehicle?.readiness,
        };
    }

    /**
     * Takes the deposit at pickup: cash, or the customer's card (a hold for short
     * rentals, a saved card for long ones). A card answers with the form's secret.
     */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: takeRentalDepositFormSchema,
    })
    async takeDeposit(
        params: ActionParams<TakeRentalDepositFormType>,
    ): Promise<{data: RentalDepositResponse}> {
        const reservation = await loadReservation(params);
        assertStatus(
            reservation,
            ["confirmed", "in_progress"],
            params.languageCode,
        );
        const form = await takeDeposit(
            reservation,
            {choice: params.method, amount: params.amount},
            ctxOf(params),
        );
        return {
            data: {
                reservation: await toDto(reservation, params),
                payment: form
                    ? {
                          ...form,
                          publishableKey: PAYMENTS.STRIPE_PUBLISHABLE_KEY ?? "",
                      }
                    : undefined,
            },
        };
    }

    /** Checks with the gateway whether the customer has confirmed the card. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 60},
        schema: validateSingleForm,
    })
    async refreshDeposit(
        params: ActionParams<{_id: string}>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        await refreshDeposit(reservation, ctxOf(params));
        return toDto(reservation, params);
    }

    /** Keeps part of the deposit for what is still owed and releases the rest. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: settleRentalDepositFormSchema,
    })
    async settleDeposit(
        params: ActionParams<SettleRentalDepositFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        assertStatus(
            reservation,
            ["in_progress", "completed"],
            params.languageCode,
        );
        await settleDeposit(
            reservation,
            params.keepAmount,
            {by: new ObjectId(params.actionUserCtx.userId)},
            ctxOf(params),
        );
        return toDto(reservation, params);
    }

    /** The customer drives off: odometer and fuel are recorded and the car is on the road. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: handoverRentalReservationFormSchema,
    })
    async handover(
        params: ActionParams<HandoverRentalReservationFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        const {
            odometerKm,
            fuelLevel,
            notes,
            photos,
            acknowledgedDamages,
            signature,
            signerName,
        } = params;
        await handOverRentalReservation(
            reservation,
            {
                odometerKm,
                fuelLevel,
                notes,
                photos,
                acknowledgedDamages,
                signature,
                signerName,
                by: new ObjectId(params.actionUserCtx.userId),
            },
            ctxOf(params),
        );
        return toDto(reservation, params);
    }

    /** What returning now with these readings would add: km, fuel and lateness, plus the preset fees. Changes nothing. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 120},
        schema: previewReturnChargesFormSchema,
    })
    async previewReturnCharges(
        params: ActionParams<PreviewReturnChargesFormType>,
    ): Promise<{data: RentalReturnChargesPreview}> {
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["in_progress"], params.languageCode);
        const [config, category] = await Promise.all([
            carRentalConfigService.getOrCreateForCompany(
                params.company._id,
                ctxOf(params),
            ),
            VehicleCategory.findOne({
                _id: reservation.category,
                company: params.company._id,
            })
                .select("dailyRate")
                .session(params.session),
        ]);
        const reading = {
            odometerKm: params.odometerKm,
            fuelLevel: params.fuelLevel,
            returnedAt: new Date(),
        };
        return {
            data: suggestReturnCharges(
                reservation,
                reading,
                config,
                category?.dailyRate,
                params.languageCode,
            ),
        };
    }

    /** The car is back. Extra charges (fuel, km, damage) are added to what the customer owes. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: returnRentalReservationFormSchema,
    })
    async returnVehicle(
        params: ActionParams<ReturnRentalReservationFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        const {
            odometerKm,
            fuelLevel,
            notes,
            damageNoted,
            extraCharges,
            photos,
            newDamages,
        } = params;
        await returnRentalReservation(
            reservation,
            {
                odometerKm,
                fuelLevel,
                notes,
                damageNoted,
                extraCharges,
                photos,
                newDamages,
                by: new ObjectId(params.actionUserCtx.userId),
            },
            ctxOf(params),
        );
        return toDto(reservation, params);
    }

    /** Staff cancellation. The policy fee applies only when asked; any remaining payment is refunded. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: cancelRentalReservationFormSchema,
    })
    async cancel(
        params: ActionParams<CancelRentalReservationFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        await cancelRentalReservation(
            reservation,
            {
                by: "staff",
                reason: params.reason,
                applyFee: params.applyCancellationFee ?? false,
            },
            ctxOf(params),
        );
        return toDto(reservation, params);
    }

    /** The customer never came. Allowed once the pickup time plus the grace period has passed. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: validateSingleForm,
    })
    async noShow(
        params: ActionParams<{_id: string}>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["confirmed"], params.languageCode);
        const config = await carRentalConfigService.getOrCreateForCompany(
            params.company._id,
            ctxOf(params),
        );
        const now = new Date();
        if (
            now.getTime() <
            reservation.pickupAt.getTime() + config.lateGraceMinutes * MINUTE
        ) {
            throw apiValidationException(
                "rental_no_show_too_early",
                "",
                null,
                params.languageCode,
            );
        }
        await markRentalNoShow(
            reservation,
            {by: new ObjectId(params.actionUserCtx.userId), now},
            ctxOf(params),
        );
        return toDto(reservation, params);
    }

    /**
     * How far the booking can be extended on its car, for the extend dialog's calendar: the server's extend
     * refuses anything past the next booking or block (turnaround kept) and returns when the branch is closed.
     */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 60},
        schema: validateSingleForm,
    })
    async extendWindow(
        params: ActionParams<{_id: string}>,
    ): Promise<{data: RentalExtendWindow}> {
        const reservation = await loadReservation(params);
        const companyId = params.company._id;
        const [config, returnLocation, nextBooking, nextBlock] = await Promise.all([
            carRentalConfigService.getOrCreateForCompany(companyId, ctxOf(params)),
            RentalLocation.findOne({_id: reservation.returnLocation, company: companyId}).session(params.session),
            RentalReservation.findOne({
                company: companyId,
                vehicle: reservation.vehicle,
                _id: {$ne: reservation._id},
                pickupAt: {$gte: reservation.returnAt},
                ...blockingReservationFilter(new Date()),
            }).sort({pickupAt: 1}).select("pickupAt").session(params.session),
            VehicleBlock.findOne({
                company: companyId,
                vehicle: reservation.vehicle,
                deletedAt: null,
                startAt: {$gte: reservation.returnAt},
            }).sort({startAt: 1}).select("startAt").session(params.session),
        ]);
        const timeZone = returnLocation?.timezone ?? reservation.snapshot.timezone;
        const nextStart = [nextBooking?.pickupAt, nextBlock?.startAt]
            .filter((at): at is Date => !!at)
            .sort((a, b) => a.getTime() - b.getTime())[0];
        const until = nextStart ? new Date(nextStart.getTime() - config.turnaroundBufferMinutes * MINUTE) : undefined;

        // The days the return location is closed, from the current return to the limit (or 90 days on).
        const closedDays: string[] = [];
        const first = localDateOf(reservation.returnAt, timeZone);
        const last = until ? localDateOf(until, timeZone) : addLocalDays(first, 90);
        const weekdays = new Set((returnLocation?.openingHours ?? []).map((slot) => Number(slot.dayOfWeek)));
        const closures = new Set((returnLocation?.closures ?? []).map((closure) => closure.date));
        for (let day = first; day <= last; day = addLocalDays(day, 1)) {
            const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
            if (closures.has(day) || (weekdays.size > 0 && !weekdays.has(weekday))) closedDays.push(day);
        }
        return {data: {until: until?.toISOString(), closedDays, timeZone}};
    }

    /** The cars of the booking's class free for its whole window (turnaround kept), for "Change car". */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 60},
        schema: validateSingleForm,
    })
    async freeVehicles(
        params: ActionParams<{_id: string}>,
    ): Promise<{data: RentalFreeVehicle[]}> {
        const reservation = await loadReservation(params);
        const companyId = params.company._id;
        const [busy, cars] = await Promise.all([
            busyVehicleIds({
                companyId,
                start: reservation.pickupAt,
                end: reservation.blockedUntil,
                now: new Date(),
                excludeReservationId: reservation._id,
                session: params.session,
            }),
            Vehicle.find({
                company: companyId,
                category: reservation.category,
                status: "active",
                deletedAt: null,
                _id: {$ne: reservation.vehicle},
            }).select("plate make model readiness").sort({plate: 1}).session(params.session),
        ]);
        const free = cars.filter((car) => !busy.has(String(car._id)));
        // Staff may renew the papers before the handover, so such a car stays on the list, marked (TD-B264).
        const lapsing = await vehiclesWithLapsingPapers(free.map((car) => car._id), {from: reservation.pickupAt, until: reservation.returnAt}, {companyId, session: params.session});
        return {
            data: free.map((car) => ({
                value: String(car._id),
                label: `${car.make} ${car.model} · ${car.plate}`,
                readiness: car.readiness,
                ...(lapsing.has(String(car._id)) ? {papersLapse: true} : {}),
            })),
        };
    }

    /** Moves the booking to another car of the same category that is free for its whole window. */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: reassignRentalVehicleFormSchema,
    })
    async reassignVehicle(
        params: ActionParams<ReassignRentalVehicleFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        assertStatus(reservation, ["held", "confirmed"], params.languageCode);
        const companyId = params.company._id;
        const target = await Vehicle.findOne({
            _id: new ObjectId(params.vehicle),
            company: companyId,
            deletedAt: null,
        }).session(params.session);
        if (!target)
            throw apiValidationException(
                "vehicle_not_found",
                "",
                null,
                params.languageCode,
            );
        if (String(target.category) !== String(reservation.category)) {
            throw apiValidationException(
                "rental_vehicle_wrong_category",
                "",
                null,
                params.languageCode,
            );
        }
        await lockVehicle(target._id, {
            companyId,
            session: params.session,
            languageCode: params.languageCode,
        });
        const busy = await busyVehicleIds({
            companyId,
            vehicleIds: [target._id],
            start: reservation.pickupAt,
            end: reservation.blockedUntil,
            now: new Date(),
            excludeReservationId: reservation._id,
            session: params.session,
        });
        if (busy.size)
            throw apiValidationException(
                "vehicle_unavailable",
                "",
                null,
                params.languageCode,
            );

        reservation.vehicle = target._id;
        reservation.needsTransfer = await needsTransferFor(
            target._id,
            {
                locationId: nestedEntityToRef(reservation.pickupLocation)!,
                at: reservation.pickupAt,
            },
            companyId,
            params.session,
        );
        reservation.timeline.push({
            event: "vehicle_reassigned",
            at: new Date(),
            by: new ObjectId(params.actionUserCtx.userId),
            note: target.plate,
        });
        await reservation.save({session: params.session});
        return toDto(reservation, params);
    }

    /**
     * Keeps the car longer. The extra days are charged at today's prices: the
     * difference between today's price for the longer and the original trip.
     */
    @action({
        auth: "private",
        transaction: true,
        rateLimit: {windowMs: 60000, max: 30},
        schema: extendRentalReservationFormSchema,
    })
    async extend(
        params: ActionParams<ExtendRentalReservationFormType>,
    ): Promise<RentalReservationDto> {
        const reservation = await loadReservation(params);
        await extendRentalReservation(
            reservation,
            {
                returnDate: params.returnDate,
                returnTime: params.returnTime,
                by: new ObjectId(params.actionUserCtx.userId),
            },
            ctxOf(params),
        );
        return toDto(reservation, params);
    }
}
