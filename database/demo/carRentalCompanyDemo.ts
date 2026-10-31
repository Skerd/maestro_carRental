/**
 * Seeds the car-rental demo company: 6 branches, 10 categories with photos and
 * videos, 80 cars, extras (including two protection products), about 170 bookings
 * from 90 days ago to 60 days ahead in every status, each car's insurance,
 * documents, service log and damages, plus the counter records staff lists need:
 * promo codes, fees, fines, transfers, cash deposits, accounts, reviews and a deny list.
 *
 * Every row is keyed by a natural key (branch name, category slug, plate, extra
 * name, booking idempotency key), and a car's paperwork is only added when it has
 * none, so running it twice changes nothing. Bookings go through
 * `createRentalReservation` and the lifecycle steps staff use, with the dates of
 * the plan, so they take the vehicle lock and can never overlap.
 */

import type {ClientSession, Model} from "mongoose";
import type {ObjectId} from "mongodb";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {
    resolveDemoImagesFromUnsplash,
    resolveDemoVideosFromUrls,
} from "@coreModule/database/demo/demoMedia";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {roundMoney} from "@coreModule/utilities/helpers/money";
import {
    addLocalDays,
    localDateOf,
    localToUtc,
} from "@coreModule/utilities/time/timeWindows";
import CarRentalConfig from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import RentalLocation, {
    type IRentalLocation,
} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory, {
    type IVehicleCategory,
} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import Vehicle from "@carRentalModule/database/schemas/vehicle/vehicle";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import RentalPromoCode from "@carRentalModule/database/schemas/rentalPromoCode/rentalPromoCode";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import VehicleTransfer from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import RentalBusinessAccount from "@carRentalModule/database/schemas/rentalBusinessAccount/rentalBusinessAccount";
import RentalDenyEntry from "@carRentalModule/database/schemas/rentalDenyEntry/rentalDenyEntry";
import RentalReview from "@carRentalModule/database/schemas/rentalReview/rentalReview";
import RentalSubscription from "@carRentalModule/database/schemas/rentalSubscription/rentalSubscription";
import RentalReservation, {
    type IRentalReservation,
} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import {
    bookingAtOffence,
    mainDriverName,
} from "@carRentalModule/utilities/services/rentalFines";
import {takeDeposit} from "@carRentalModule/utilities/services/rentalDeposit";
import {
    assertNoBookingClash,
    blockingReservationFilter,
} from "@carRentalModule/utilities/services/rentalAvailability";
import {
    createRentalReservation,
    loadBookableCategory,
    loadSelectedExtras,
} from "@carRentalModule/utilities/services/rentalReservationService";
import {
    expireRentalHold,
    handOverRentalReservation,
    markRentalNoShow,
    returnRentalReservation,
} from "@carRentalModule/utilities/services/rentalLifecycle";
import {recordCounterPayment} from "@carRentalModule/utilities/services/rentalPayments";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {syncVehicleServiceDue} from "@carRentalModule/utilities/services/vehicleRecords";
import {
    DEMO_CATEGORIES,
    DEMO_CONTACTS,
    DEMO_EXTRAS,
    demoDriver,
    DEMO_LOCATIONS,
    DEMO_MODELS,
    DEMO_TIMEZONE,
    demoVehicles,
    type DemoVehicle,
} from "./carRental.demo.data";
import {
    CATEGORY_PHOTOS,
    CATEGORY_PHOTO_SIZE,
    CATEGORY_VIDEOS,
    DEMO_VIDEO_URLS,
    VEHICLE_VIDEOS,
    modelPhotos,
} from "./carRental.demo.media";
import {
    planDemoBookings,
    planVehicleHistory,
    type DemoBooking,
    type DemoHistory,
} from "./carRental.demo.plan";
import City from "@coreModule/database/schemas/city/city";

const LANGUAGE = "en-US";

/** The company's own City record by name; cities are seeded per company. */
async function demoCityId(companyId: unknown, name: string) {
    return (await City.findOne({company: companyId, name}).select("_id"))?._id;
}
const DAY_MS = 24 * 3600 * 1000;
const MINUTE_MS = 60 * 1000;

async function upsert<T>(
    model: Model<T>,
    filter: Record<string, unknown>,
    payload: Record<string, unknown>,
    onInsert: Record<string, unknown> = {},
) {
    const existing = await model.findOne(filter);
    if (existing) {
        existing.set(payload);
        return existing.save();
    }
    return model.create({...filter, ...payload, ...onInsert});
}

/** A local date and time at the demo branches as an instant, shifted by `minutes`. */
function at(date: string, time: string, minutes = 0): Date {
    return new Date(
        localToUtc(date, time, DEMO_TIMEZONE)!.getTime() + minutes * MINUTE_MS,
    );
}

/** Paperwork dates are days, stored at local noon so they read the same in every time zone around. */
const day = (date: string) => at(date, "12:00");

export async function seedCarRentalDemoData(
    parentLogger: serverLogger | undefined,
    company: ICompany,
): Promise<void> {
    const logger = getLogger("carRental_demo_data", parentLogger);
    logger.start(`Seeding car rental demo data for '${company.name}'...`);
    const createdBy = nestedEntityToRef(company.createdBy);
    const owned = {company: company._id, createdBy};
    const today = localDateOf(new Date(), DEMO_TIMEZONE);
    const year = Number(today.slice(0, 4));

    try {
        const config = await carRentalConfigService.getOrCreateForCompany(
            company._id,
            {logger, languageCode: LANGUAGE},
        );
        await CarRentalConfig.updateOne(
            {_id: config._id},
            {
                // The company's owner gets the staff alerts (new bookings, expiring paperwork, service due).
                $set: {
                    publicBookingEnabled: true,
                    listedOnPortal: true,
                    paymentPolicy: "pay_at_pickup",
                    vatRate: 20,
                    termsVersion: "demo-1",
                    notifyUsers: [createdBy],
                    youngDriverUnderAge: 25,
                    youngDriverDailyFee: 8,
                    additionalDriverDailyFee: 5,
                    oneWayFee: 20,
                    fuelPricePerQuarter: 6,
                    refuelServiceFee: 15,
                    lateFeePerHour: 10,
                    cleaningFee: 40,
                    smokingFee: 150,
                    fineAdminFee: 15,
                },
            },
        );

        const locationDocs: IRentalLocation[] = [];
        for (const {cityName, ...location} of DEMO_LOCATIONS) {
            const oneWayFee =
                location.name === "Tirana City Center"
                    ? 25
                    : location.name === "Tirana Airport (TIA)"
                      ? 15
                      : undefined;
            locationDocs.push(
                (await upsert(
                    RentalLocation,
                    {company: company._id, name: location.name},
                    {
                        ...owned,
                        ...location,
                        address: {
                            ...location.address,
                            city: await demoCityId(company._id, cityName),
                        },
                        timezone: DEMO_TIMEZONE,
                        closures: [],
                        isActive: true,
                        ...(oneWayFee !== undefined ? {oneWayFee} : {}),
                    },
                )) as unknown as IRentalLocation,
            );
        }

        const videoIds = await resolveDemoVideosFromUrls(
            DEMO_VIDEO_URLS,
            company,
            createdBy,
            logger,
        );
        const clips = (urls: string[] | undefined) =>
            (urls ?? []).flatMap((url) => videoIds.get(url) ?? []);

        const categoryBySlug = new Map<string, IVehicleCategory>();
        for (const {summerDailyRate, ...category} of DEMO_CATEGORIES) {
            const {galleryIds} = await resolveDemoImagesFromUnsplash(
                CATEGORY_PHOTOS[category.slug],
                `${company._id}:${category.slug}`,
                category.name,
                company,
                createdBy,
                logger,
                "vehicleCategory",
                CATEGORY_PHOTO_SIZE,
            );
            const rateSeasons = [year, year + 1].map((y) => ({
                startDate: `${y}-06-15`,
                endDate: `${y}-09-15`,
                dailyRate: summerDailyRate,
            }));
            const doc = await upsert(
                VehicleCategory,
                {company: company._id, slug: category.slug},
                {
                    ...owned,
                    ...category,
                    features: [...category.features],
                    rateSeasons,
                    images: galleryIds,
                    videos: clips(CATEGORY_VIDEOS[category.slug]),
                    isPublic: true,
                },
            );
            categoryBySlug.set(
                category.slug,
                doc as unknown as IVehicleCategory,
            );
        }

        for (const extra of DEMO_EXTRAS) {
            await upsert(
                RentalExtra,
                {company: company._id, name: extra.name},
                {...owned, ...extra, isActive: true},
            );
        }

        const fleet = demoVehicles(year);
        const plan = planDemoBookings(fleet, today);
        const finalKm = new Map(
            fleet.map((vehicle) => [vehicle.index, vehicle.baseKm]),
        );
        for (const booking of plan)
            finalKm.set(
                booking.vehicleIndex,
                booking.returnKm ??
                    booking.handoverKm ??
                    finalKm.get(booking.vehicleIndex)!,
            );
        const histories = new Map(
            fleet.map((vehicle) => [
                vehicle.index,
                planVehicleHistory(vehicle, today, finalKm.get(vehicle.index)!),
            ]),
        );

        // Cars share their photos per model: one set of uploads per model, not per car.
        const photosByModel = new Map<string, ObjectId[]>();
        for (const [offset, model] of DEMO_MODELS.entries()) {
            const modelKey = `${model.make} ${model.model}`;
            const {galleryIds} = await resolveDemoImagesFromUnsplash(
                modelPhotos(model.category, offset),
                `${company._id}:${modelKey}`,
                modelKey,
                company,
                createdBy,
                logger,
                "vehicle",
                CATEGORY_PHOTO_SIZE,
            );
            photosByModel.set(modelKey, galleryIds);
        }

        const vehicleIdByIndex = new Map<number, ObjectId>();
        for (const vehicle of fleet) {
            const history = histories.get(vehicle.index)!;
            // Every car is active while its bookings are made (the lock needs it); off-road statuses come after.
            const doc = await upsert(
                Vehicle,
                {company: company._id, plate: vehicle.plate},
                {
                    ...owned,
                    category: categoryBySlug.get(vehicle.category)!._id,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: vehicle.year,
                    color: vehicle.color,
                    homeLocation: locationDocs[vehicle.home]._id,
                    images: photosByModel.get(vehicle.modelKey) ?? [],
                    videos: clips(VEHICLE_VIDEOS[vehicle.category]),
                    status: "active",
                },
                {
                    // Only on insert: a re-run keeps the readings the bookings left.
                    odometerKm: vehicle.baseKm,
                    acquiredAt: day(history.acquiredAt),
                    purchasePrice: history.purchasePrice,
                },
            );
            vehicleIdByIndex.set(vehicle.index, doc._id as ObjectId);
        }

        const existingKeys = new Set(
            await RentalReservation.find({
                company: company._id,
                idempotencyKey: {$in: plan.map((b) => b.key)},
            }).distinct("idempotencyKey"),
        );
        const freshConfig = (await carRentalConfigService.findForCompany(
            company._id,
            {logger, languageCode: LANGUAGE},
        ))!;
        const extraIds = new Map(
            (await RentalExtra.find({company: company._id})).map((extra) => [
                extra.name,
                String(extra._id),
            ]),
        );
        let created = 0;
        for (const booking of plan.filter(
            (entry) => !existingKeys.has(entry.key),
        )) {
            // One booking that cannot be made (a clash with an older seed's booking) must not stop the rest.
            try {
                await runInTransaction(logger, async (session) => {
                    const ctx = {
                        session,
                        logger,
                        languageCode: LANGUAGE,
                        auditUserId: createdBy,
                    };
                    const vehicle = fleet[booking.vehicleIndex];
                    const pickupAt = at(booking.pickupDate, booking.time);
                    // A held booking waits for its payment right now; the rest were booked some days before pickup, never later than today.
                    const bookedAt =
                        booking.outcome === "held"
                            ? new Date()
                            : new Date(
                                  Math.min(
                                      Date.now(),
                                      pickupAt.getTime() -
                                          booking.bookedDaysBefore * DAY_MS,
                                  ),
                              );
                    const trip = await resolveRentalTrip(
                        {
                            pickupLocation: String(
                                locationDocs[booking.pickupLocation]._id,
                            ),
                            returnLocation: String(
                                locationDocs[booking.returnLocation]._id,
                            ),
                            pickupDate: booking.pickupDate,
                            pickupTime: booking.time,
                            returnDate: booking.returnDate,
                            returnTime: booking.time,
                        },
                        freshConfig,
                        {
                            companyId: company._id,
                            languageCode: LANGUAGE,
                            online: false,
                            now: bookedAt,
                            session,
                        },
                    );
                    const extras = await loadSelectedExtras(
                        company._id,
                        booking.extras.map((name) => ({
                            extra: extraIds.get(name)!,
                            quantity: 1,
                        })),
                        {languageCode: LANGUAGE, session},
                    );
                    const category = await loadBookableCategory(
                        company._id,
                        String(categoryBySlug.get(vehicle.category)!._id),
                        {languageCode: LANGUAGE, online: false, session},
                    );
                    const online =
                        booking.outcome === "held" ||
                        booking.outcome === "expired";
                    const {reservation} = await createRentalReservation(
                        {
                            companyId: company._id,
                            config: freshConfig,
                            category,
                            vehicleId: String(
                                vehicleIdByIndex.get(booking.vehicleIndex),
                            ),
                            trip,
                            extras,
                            contact: {...DEMO_CONTACTS[booking.contact]},
                            idempotencyKey: booking.key,
                            source:
                                online || booking.contact % 3 === 0
                                    ? "online"
                                    : "staff",
                            paymentChoice: online ? "online" : "pay_at_pickup",
                            now: bookedAt,
                        },
                        ctx,
                    );
                    await playOutcome(reservation, booking, ctx, createdBy);
                });
                created += 1;
            } catch (error: unknown) {
                logger.warn(
                    `Skipped demo booking ${booking.key}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        for (const vehicle of fleet.filter(
            (entry) => entry.status !== "active",
        )) {
            await Vehicle.updateOne(
                {_id: vehicleIdByIndex.get(vehicle.index)},
                {$set: {status: vehicle.status}},
            );
        }

        let papered = 0;
        for (const vehicle of fleet) {
            const vehicleId = vehicleIdByIndex.get(vehicle.index)!;
            if (
                await VehicleMaintenance.exists({
                    company: company._id,
                    vehicle: vehicleId,
                })
            )
                continue;
            await seedVehicleHistory(
                vehicle,
                vehicleId,
                histories.get(vehicle.index)!,
                plan,
                {owned, today},
            );
            await syncVehicleServiceDue(vehicleId, {companyId: company._id});
            papered += 1;
        }

        await seedCounterRecords({
            companyId: company._id,
            owned,
            today,
            logger,
            categories: categoryBySlug,
        });

        logger.finish(
            `Finished seeding car rental demo data (${created} new bookings, paperwork for ${papered} cars)!`,
        );
    } catch (error: unknown) {
        logger.err("Error seeding car rental demo data", error);
        logger.fail("Failed to seed car rental demo data!");
    }
}

type SeedCtx = {
    session: ClientSession;
    logger: serverLogger;
    languageCode: string;
    auditUserId: ObjectId;
};

/** Moves a freshly made booking to its planned state, at the planned times. */
async function playOutcome(
    reservation: IRentalReservation,
    booking: DemoBooking,
    ctx: SeedCtx,
    by: ObjectId,
): Promise<void> {
    const pay = async (share: number, when: Date) => {
        const amount = roundMoney(
            reservation.pricing.grandTotal * share - reservation.amountPaid,
        );
        if (amount > 0)
            await recordCounterPayment(
                reservation,
                amount,
                undefined,
                ctx,
                when,
            );
        await reservation.save({session: ctx.session});
    };
    // Cars only leave with a licensed driver; half the upcoming bookings are ready for pickup too.
    if (
        booking.outcome === "completed" ||
        booking.outcome === "in_progress" ||
        (booking.outcome === "confirmed" && booking.contact % 2 === 0)
    ) {
        reservation.drivers = [demoDriver(booking.contact, booking.pickupDate)];
        await reservation.save({session: ctx.session});
    }
    switch (booking.outcome) {
        case "completed":
            await handOverRentalReservation(
                reservation,
                {
                    odometerKm: booking.handoverKm!,
                    fuelLevel: "full",
                    by,
                    now: at(booking.pickupDate, booking.time, 15),
                    silent: true,
                },
                ctx,
            );
            await returnRentalReservation(
                reservation,
                {
                    odometerKm: booking.returnKm!,
                    fuelLevel: booking.returnFuel!,
                    damageNoted: Boolean(booking.damage),
                    notes: booking.damage
                        ? `Damage on the ${booking.damage.area}, photos taken.`
                        : undefined,
                    extraCharges: booking.extraCharges,
                    by,
                    now: at(booking.returnDate, booking.time, -15),
                    silent: true,
                },
                ctx,
            );
            await pay(
                booking.paidShare,
                at(booking.returnDate, booking.time, -10),
            );
            return;
        case "in_progress":
            await handOverRentalReservation(
                reservation,
                {
                    odometerKm: booking.handoverKm!,
                    fuelLevel: "full",
                    by,
                    now: at(booking.pickupDate, booking.time, 15),
                    silent: true,
                },
                ctx,
            );
            await pay(
                booking.paidShare,
                at(booking.pickupDate, booking.time, 20),
            );
            return;
        case "no_show":
            await markRentalNoShow(
                reservation,
                {by, now: at(booking.pickupDate, booking.time, 90)},
                ctx,
            );
            return;
        case "expired":
            await expireRentalHold(
                reservation,
                ctx,
                new Date(reservation.holdExpiresAt!.getTime() + MINUTE_MS),
            );
            return;
        case "cancelled": {
            // Written directly: cancelRentalReservation emails the customer, and these were never paid, so nothing is refunded.
            const cancelledAt = new Date(
                Math.min(
                    Date.now(),
                    at(booking.pickupDate, booking.time).getTime() - 2 * DAY_MS,
                ),
            );
            reservation.status = "cancelled";
            reservation.cancelledAt = cancelledAt;
            reservation.cancelledBy =
                booking.contact % 2 === 0 ? "customer" : "staff";
            reservation.cancellationReason =
                booking.contact % 2 === 0
                    ? "Change of travel plans"
                    : "Customer called to cancel";
            reservation.manageTokenVersion += 1;
            reservation.timeline.push({
                event: "cancelled",
                at: cancelledAt,
                note: reservation.cancellationReason,
            });
            await reservation.save({session: ctx.session});
            return;
        }
        case "held":
        case "confirmed":
            return;
    }
}

/** A car's policies, documents, service log, damages and workshop block. */
async function seedVehicleHistory(
    vehicle: DemoVehicle,
    vehicleId: ObjectId,
    history: DemoHistory,
    plan: DemoBooking[],
    {
        owned,
        today,
    }: {owned: {company: ObjectId; createdBy: ObjectId}; today: string},
): Promise<void> {
    const base = {...owned, vehicle: vehicleId};
    for (const policy of history.policies) {
        await VehicleInsurance.create({
            ...base,
            ...policy,
            validFrom: day(policy.validFrom),
            expiresAt: day(policy.expiresAt),
        });
    }
    for (const document of history.documents) {
        await VehicleDocument.create({
            ...base,
            ...document,
            issuedAt: day(document.issuedAt),
            expiresAt: document.expiresAt ? day(document.expiresAt) : undefined,
        });
    }
    for (const service of history.services) {
        await VehicleMaintenance.create({
            ...base,
            ...service,
            serviceDate: day(service.serviceDate),
            nextDueAt: service.nextDueAt ? day(service.nextDueAt) : undefined,
        });
    }

    const damaged = plan.filter(
        (booking) => booking.vehicleIndex === vehicle.index && booking.damage,
    );
    for (const [n, booking] of damaged.entries()) {
        const reservation = await RentalReservation.findOne({
            company: owned.company,
            idempotencyKey: booking.key,
        }).select("_id returnInfo");
        if (!reservation?.returnInfo) continue;
        // Older damage is fixed by now; the latest is still open or in the workshop.
        const repaired = booking.returnDate < addLocalDays(today, -20);
        await VehicleDamage.create({
            ...base,
            reservation: reservation._id,
            reportedAt: reservation.returnInfo.at,
            area: booking.damage!.area,
            severity: booking.damage!.severity,
            description: `Found at return: ${booking.damage!.severity} damage on the ${booking.damage!.area}.`,
            estimatedCost: booking.damage!.estimatedCost,
            status: repaired ? "repaired" : n % 2 === 0 ? "open" : "in_repair",
            ...(repaired && {
                repairCost: booking.damage!.estimatedCost + 20,
                repairedAt: day(addLocalDays(booking.returnDate, 7)),
            }),
        });
    }
    if (history.inspectionDamage) {
        const {reportedAt, ...damage} = history.inspectionDamage;
        await VehicleDamage.create({
            ...base,
            ...damage,
            reportedAt: at(reportedAt, "08:30"),
        });
    }
    if (history.block) {
        await upsert(
            VehicleBlock,
            {
                company: owned.company,
                vehicle: vehicleId,
                note: history.block.note,
            },
            {
                ...owned,
                reason: "maintenance",
                startAt: at(history.block.startDate, "08:00"),
                endAt: at(history.block.endDate, "18:00"),
            },
        );
    }
}

const DEMO_FINES = [
    {
        reference: "DEMO-FINE-1",
        type: "speeding",
        authority: "Policia Rrugore",
        amount: 50,
        place: "Tirana–Durrës",
    },
    {
        reference: "DEMO-FINE-2",
        type: "parking",
        authority: "Bashkia Tiranë",
        amount: 20,
        place: "Blloku",
    },
    {
        reference: "DEMO-FINE-3",
        type: "toll",
        authority: "Autostrada",
        amount: 5,
        place: "Rinas toll",
    },
    {
        reference: "DEMO-FINE-4",
        type: "red_light",
        authority: "Policia Rrugore",
        amount: 40,
        place: "Rruga e Kavajës",
    },
] as const;

const DEMO_TRANSFER_NOTES = ["Demo night transfer 1", "Demo night transfer 2"];

/**
 * The lists that are not part of the fleet or the booking plan: fees are on the
 * config, and these rows are keyed so a second run writes the same documents.
 */
async function seedCounterRecords(input: {
    companyId: ObjectId;
    owned: {company: ObjectId; createdBy: ObjectId};
    today: string;
    logger: serverLogger;
    categories: Map<string, IVehicleCategory>;
}): Promise<void> {
    const {companyId, owned, today, logger, categories} = input;
    await VehicleCategory.updateOne(
        {company: companyId, slug: "mini"},
        {$set: {crossBorderAllowed: false}},
    );
    await VehicleCategory.updateOne(
        {company: companyId, slug: "suv-4x4"},
        {$set: {crossBorderAllowed: true, crossBorderFee: 15}},
    );

    for (const promo of [
        {
            code: "SUMMER10",
            type: "percent" as const,
            value: 10,
            description: "Ten percent off the rental base.",
        },
        {
            code: "WEEKEND15",
            type: "fixed" as const,
            value: 15,
            description: "15 off a weekend booking.",
        },
        {
            code: "WELCOME",
            type: "percent" as const,
            value: 8,
            description: "A first booking with us.",
        },
    ]) {
        await upsert(
            RentalPromoCode,
            {company: companyId, code: promo.code},
            {...owned, ...promo, isActive: true},
            {usageCount: 0},
        );
    }

    const tours = await upsert(
        RentalBusinessAccount,
        {company: companyId, vatNumber: "ALDEMO100"},
        {
            ...owned,
            name: "Adriatik Tours",
            billingEmail: "accounts@adriatik-tours.demo",
            discountPercent: 10,
            isActive: true,
        },
    );
    await upsert(
        RentalBusinessAccount,
        {company: companyId, vatNumber: "ALDEMO200"},
        {
            ...owned,
            name: "Tirana Hotels",
            billingEmail: "accounts@tirana-hotels.demo",
            discountPercent: 5,
            isActive: true,
        },
    );

    await upsert(
        RentalDenyEntry,
        {company: companyId, email: "blocked@rental.demo"},
        {
            ...owned,
            reason: "Unpaid damage on a previous rental",
            isActive: true,
        },
    );
    await upsert(
        RentalDenyEntry,
        {company: companyId, licenseNumber: "AL-DENY-0001"},
        {
            ...owned,
            reason: "Licence reported lost",
            isActive: true,
        },
    );

    const city = await RentalLocation.findOne({
        company: companyId,
        name: "Tirana City Center",
    }).select("_id");
    const airport = await RentalLocation.findOne({
        company: companyId,
        name: "Tirana Airport (TIA)",
    }).select("_id");
    if (!city || !airport) throw new Error("Demo locations are missing");
    const mini = categories.get("mini");
    const suv = categories.get("suv-4x4");
    if (!mini || !suv) throw new Error("Demo categories are missing");

    await upsert(
        RentalSubscription,
        {company: companyId, email: "weekly@fleet.demo"},
        {
            ...owned,
            contactName: "Blerina Hoxha",
            phone: "+355 69 100 2201",
            category: mini._id,
            pickupLocation: city._id,
            businessAccount: tours._id,
            period: "week",
            price: 160,
            status: "active",
            nextRunAt: at(addLocalDays(today, 7), "09:00"),
        },
    );
    await upsert(
        RentalSubscription,
        {company: companyId, email: "monthly@fleet.demo"},
        {
            ...owned,
            contactName: "Arben Kola",
            phone: "+355 69 100 2202",
            category: suv._id,
            pickupLocation: airport._id,
            period: "month",
            price: 520,
            status: "paused",
            nextRunAt: at(addLocalDays(today, 30), "09:00"),
        },
    );

    const reportedAt = at(today, "08:00");
    const spots = [
        {lastLatitude: 41.3275, lastLongitude: 19.8187},
        {lastLatitude: 41.4147, lastLongitude: 19.7206},
        {lastLatitude: 41.3167, lastLongitude: 19.445},
        {lastLatitude: 40.451, lastLongitude: 19.489},
    ];
    const tracked = await Vehicle.find({company: companyId, status: "active"})
        .sort({plate: 1})
        .limit(spots.length)
        .select("plate");
    for (const [index, car] of tracked.entries()) {
        await Vehicle.updateOne(
            {_id: car._id},
            {
                $set: {
                    trackerId: `TRK-${car.plate}`,
                    ...spots[index],
                    lastReportedAt: reportedAt,
                },
            },
        );
    }

    const completed = await RentalReservation.find({
        company: companyId,
        status: "completed",
        "handover.at": {$exists: true},
        "returnInfo.at": {$exists: true},
    })
        .sort({idempotencyKey: 1})
        .limit(DEMO_FINES.length + 2);

    for (const [index, reservation] of completed.slice(0, 2).entries()) {
        await upsert(
            RentalReview,
            {company: companyId, reservation: reservation._id},
            {
                ...owned,
                rating: index === 0 ? 5 : 4,
                authorName:
                    `${reservation.contact.firstName} ${reservation.contact.lastName}`.trim(),
                comment:
                    index === 0
                        ? "Clean car and the pickup was on time."
                        : "The car was fine; the pickup took a while.",
                isPublished: index === 0,
            },
        );
    }

    for (const [index, fine] of DEMO_FINES.entries()) {
        if (
            await VehicleFine.exists({
                company: companyId,
                reference: fine.reference,
            })
        )
            continue;
        const reservation = completed[index];
        if (!reservation?.handover || !reservation.returnInfo)
            throw new Error(`No completed booking for ${fine.reference}`);
        const vehicleId = nestedEntityToRef(reservation.vehicle);
        if (!vehicleId)
            throw new Error(
                `Completed booking ${reservation.idempotencyKey} has no vehicle`,
            );
        const offenceAt = new Date(
            (reservation.handover.at.getTime() +
                reservation.returnInfo.at.getTime()) /
                2,
        );
        const booking = await bookingAtOffence(
            {companyId, vehicleId, offenceAt},
            null,
        );
        if (!booking)
            throw new Error(`Demo fine ${fine.reference} matched no booking`);
        await VehicleFine.create({
            ...owned,
            ...fine,
            vehicle: vehicleId,
            offenceAt,
            reservation: booking._id,
            driverName: mainDriverName(booking),
            status: "driver_identified",
        });
    }

    await runInTransaction(logger, async (session) => {
        const open = await RentalReservation.find({
            company: companyId,
            status: "in_progress",
        }).session(session);
        for (const reservation of open) {
            if (reservation.deposit && reservation.deposit.status !== "failed")
                continue;
            await takeDeposit(
                reservation,
                {choice: "cash", now: reservation.handover?.at ?? new Date()},
                {
                    session,
                    logger,
                    languageCode: LANGUAGE,
                    auditUserId: owned.createdBy,
                },
            );
        }
    });

    const departAt = at(addLocalDays(today, 70), "23:00");
    const arriveAt = at(addLocalDays(today, 71), "01:00");
    const busy = await RentalReservation.distinct("vehicle", {
        company: companyId,
        pickupAt: {$lt: arriveAt},
        blockedUntil: {$gt: departAt},
        ...blockingReservationFilter(new Date()),
    });
    const blocked = await VehicleBlock.distinct("vehicle", {
        company: companyId,
        startAt: {$lt: arriveAt},
        endAt: {$gt: departAt},
        deletedAt: null,
    });
    const candidates = await Vehicle.find({
        company: companyId,
        status: "active",
        _id: {$nin: [...busy, ...blocked]},
    })
        .sort({plate: 1})
        .select("homeLocation")
        .limit(8);

    let cursor = 0;
    for (const notes of DEMO_TRANSFER_NOTES) {
        if (await VehicleTransfer.exists({company: companyId, notes})) continue;
        const vehicle = candidates[cursor++];
        if (!vehicle) throw new Error(`No free car for ${notes}`);
        const homeId = nestedEntityToRef(vehicle.homeLocation);
        const fromLocation = homeId ?? city._id;
        const toLocation =
            String(fromLocation) === String(city._id) ? airport._id : city._id;
        await runInTransaction(logger, async (session) => {
            await assertNoBookingClash(
                vehicle._id,
                {start: departAt, end: arriveAt},
                {companyId, session, languageCode: LANGUAGE},
            );
            const [block] = await VehicleBlock.create(
                [
                    {
                        ...owned,
                        vehicle: vehicle._id,
                        startAt: departAt,
                        endAt: arriveAt,
                        reason: "transfer",
                        note: notes,
                    },
                ],
                {session},
            );
            await VehicleTransfer.create(
                [
                    {
                        ...owned,
                        vehicle: vehicle._id,
                        fromLocation,
                        toLocation,
                        departAt,
                        arriveAt,
                        status: "planned",
                        notes,
                        block: block._id,
                    },
                ],
                {session},
            );
        });
    }
}
