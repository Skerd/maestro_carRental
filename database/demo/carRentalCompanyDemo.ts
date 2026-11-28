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
import {multiplyMoney, subtractMoney} from "armonia/src/modules/core/helpers/money";
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
import Vehicle, {type IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
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
} from "@carRentalModule/workflows/rentalReservationService";
import {
    addReservationCharges,
    expireRentalHold,
    handOverRentalReservation,
    markRentalNoShow,
    returnRentalReservation,
} from "@carRentalModule/workflows/rentalLifecycle";
import {recordCounterPayment} from "@carRentalModule/utilities/services/rentalPayments";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {syncVehicleServiceDue} from "@carRentalModule/utilities/services/vehicleRecords";
import {linkVehiclesToCatalog} from "@carRentalModule/utilities/services/vehicleCatalogLink";
import {
    CAR_BY_CAR_CATEGORIES,
    DEMO_CATEGORIES,
    DEMO_CONTACTS,
    DEMO_EXTRAS,
    demoDriver,
    demoListing,
    DEMO_LOCATIONS,
    DEMO_MODELS,
    DEMO_TIMEZONE,
    DEMO_WORKSHOPS,
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
import Currency from "@coreModule/database/schemas/currency/currency";
import {publicPersonName} from "@coreModule/utilities/helpers/publicName";

const LANGUAGE = "en-US";

/** The City row with this name, from the platform list (D160). */
async function demoCityId(name: string) {
    return (await City.findOne({name}).select("_id"))?._id;
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
        await existing.save();
        return existing;
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
        // The demo prices are euros, as Albanian rental desks quote them; a new config takes the platform's first currency.
        const euro = await Currency.findOne({abbreviation: "EUR"}).select("_id");
        await CarRentalConfig.updateOne(
            {_id: config._id},
            {
                // The company's owner gets the staff alerts (new bookings, expiring paperwork, service due).
                $set: {
                    ...(euro && {currency: euro._id}),
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
                            city: await demoCityId(cityName),
                        },
                        timezone: DEMO_TIMEZONE,
                        closures: [],
                        isActive: true,
                        ...(oneWayFee !== undefined ? {oneWayFee} : {}),
                    },
                )),
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
                    // Some categories only head their cars rented on their own (D198).
                    soldAsClass: !CAR_BY_CAR_CATEGORIES.includes(category.slug),
                },
            );
            categoryBySlug.set(category.slug, doc);
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
        for (const model of DEMO_MODELS) {
            const modelKey = `${model.make} ${model.model}`;
            const {galleryIds} = await resolveDemoImagesFromUnsplash(
                modelPhotos(model.category, modelKey),
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
        const listedByIndex = new Map<number, IVehicle>();
        for (const vehicle of fleet) {
            const history = histories.get(vehicle.index)!;
            const category = categoryBySlug.get(vehicle.category)!;
            const listing = demoListing(vehicle, category, year);
            const photos = photosByModel.get(vehicle.modelKey) ?? [];
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
                    images: photos,
                    videos: clips(VEHICLE_VIDEOS[vehicle.category]),
                    status: "active",
                    // A re-run may give a plate another model: drop the last run's catalog link (relinked below) and own prices.
                    catalogMake: undefined,
                    catalogModel: undefined,
                    listingTitle: undefined,
                    listingDescription: undefined,
                    dailyRate: undefined,
                    weekendDailyRate: undefined,
                    depositAmount: undefined,
                    // Rented on its own (D198): its public photos are the stock photos of its model, which show no plate of ours.
                    ...listing,
                    listingImages: listing.listedAlone ? photos : [],
                },
                {
                    // Only on insert: a re-run keeps the readings the bookings left.
                    odometerKm: vehicle.baseKm,
                    acquiredAt: day(history.acquiredAt),
                    purchasePrice: history.purchasePrice,
                },
            );
            vehicleIdByIndex.set(vehicle.index, doc._id as ObjectId);
            if (listing.listedAlone) listedByIndex.set(vehicle.index, doc);
            if (
                !(await VehicleInsurance.exists({
                    company: company._id,
                    vehicle: doc._id,
                }))
            )
                await seedVehiclePapers(doc._id as ObjectId, history, owned);
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
                            // A car rented on its own is booked as that exact car, at its own prices (D198).
                            exactVehicle: listedByIndex.get(booking.vehicleIndex),
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

        // Every demo car points at its model in the platform's vehicle catalog, when the catalog has it (D199).
        const catalogLink = await linkVehiclesToCatalog({companyId: company._id, apply: true});
        if (catalogLink.unmatched.length) logger.info(`Demo cars not in the vehicle catalog: ${catalogLink.unmatched.map((car) => `${car.make} ${car.model}`).join(", ")}`);

        // A demo booking was made `bookedDaysBefore` its pickup, as its `created` timeline entry says: its createdAt
        // says so too, so lists and reports read a real booking history (TD-B290). Raw writes: createdAt is immutable.
        for (const reservation of await RentalReservation.find({
            company: company._id,
            idempotencyKey: {$in: plan.map((b) => b.key)},
        }).select("createdAt timeline")) {
            const created = reservation.timeline.find((entry) => entry.event === "created")?.at;
            if (created && created.getTime() !== reservation.createdAt.getTime()) {
                await RentalReservation.collection.updateOne({_id: reservation._id}, {$set: {createdAt: created}});
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
        const amount = subtractMoney(
            multiplyMoney(reservation.pricing.grandTotal, share),
            reservation.amountPaid,
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
                    ? "Ndryshim i planeve të udhëtimit"
                    : "Klienti telefonoi për ta anuluar";
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

/**
 * A car's insurance policies and documents, oldest first so each renewal names the
 * one it renews. Seeded before the bookings: a car is only handed over with its papers.
 */
async function seedVehiclePapers(
    vehicleId: ObjectId,
    history: DemoHistory,
    owned: {company: ObjectId; createdBy: ObjectId},
): Promise<void> {
    const base = {...owned, vehicle: vehicleId};
    const policyChain = new Map<string, ObjectId>();
    const policies = [...history.policies].sort((a, b) =>
        a.validFrom.localeCompare(b.validFrom),
    );
    for (const policy of policies) {
        const previous = policyChain.get(policy.coverage);
        const created = await VehicleInsurance.create({
            ...base,
            ...policy,
            validFrom: day(policy.validFrom),
            expiresAt: day(policy.expiresAt),
            supersedes: previous,
        });
        if (previous)
            await VehicleInsurance.updateOne(
                {_id: previous},
                {$set: {supersededBy: created._id}},
            );
        policyChain.set(policy.coverage, created._id);
    }
    const documentChain = new Map<string, ObjectId>();
    const documents = [...history.documents].sort((a, b) =>
        a.issuedAt.localeCompare(b.issuedAt),
    );
    for (const document of documents) {
        const previous = documentChain.get(document.type);
        const created = await VehicleDocument.create({
            ...base,
            ...document,
            issuedAt: day(document.issuedAt),
            expiresAt: document.expiresAt ? day(document.expiresAt) : undefined,
            supersedes: previous,
        });
        if (previous)
            await VehicleDocument.updateOne(
                {_id: previous},
                {$set: {supersededBy: created._id}},
            );
        documentChain.set(document.type, created._id);
    }
}

/** A car's service log, damages and workshop block. */
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
    for (const service of history.services) {
        await VehicleMaintenance.create({
            ...base,
            ...service,
            serviceDate: day(service.serviceDate),
            nextDueAt: service.nextDueAt ? day(service.nextDueAt) : undefined,
        });
    }
    const casco = await VehicleInsurance.findOne({
        company: owned.company,
        vehicle: vehicleId,
        coverage: "full_casco",
    })
        .sort({validFrom: -1})
        .select("_id");
    // A damage in the workshop or fixed has its repair record, which holds the cost.
    const repairFor = async (
        damage: {_id: ObjectId; description: string},
        input: {status: "scheduled" | "completed"; serviceDate: string; cost: number},
    ) => {
        const repair = await VehicleMaintenance.create({
            ...base,
            type: "repair",
            status: input.status,
            serviceDate: day(input.serviceDate),
            provider: DEMO_WORKSHOPS[vehicle.index % DEMO_WORKSHOPS.length],
            cost: input.cost,
            description: damage.description,
            damages: [damage._id],
        });
        await VehicleDamage.updateOne(
            {_id: damage._id},
            {
                $set: {
                    repair: repair._id,
                    ...(input.status === "completed" && {
                        repairedAt: day(input.serviceDate),
                    }),
                },
            },
        );
    };

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
        const status = repaired ? "repaired" : n % 2 === 0 ? "open" : "in_repair";
        const damage = await VehicleDamage.create({
            ...base,
            reservation: reservation._id,
            reportedAt: reservation.returnInfo.at,
            area: booking.damage!.area,
            severity: booking.damage!.severity,
            description: `Found at return: ${booking.damage!.severity} damage on the ${booking.damage!.area}.`,
            estimatedCost: booking.damage!.estimatedCost,
            status,
            // Every other fixed damage on a casco car was claimed from the insurer.
            ...(repaired &&
                n % 2 === 0 &&
                casco && {
                    insurance: casco._id,
                    claimNumber: `CLM-${vehicle.index}-${n + 1}`,
                    insurerPaidAmount: booking.damage!.estimatedCost,
                }),
        });
        if (status === "repaired")
            await repairFor(damage, {
                status: "completed",
                serviceDate: addLocalDays(booking.returnDate, 7),
                cost: booking.damage!.estimatedCost + 20,
            });
        if (status === "in_repair")
            await repairFor(damage, {
                status: "scheduled",
                serviceDate: addLocalDays(today, 2),
                cost: booking.damage!.estimatedCost,
            });
    }
    if (history.inspectionDamage) {
        const {reportedAt, ...input} = history.inspectionDamage;
        const damage = await VehicleDamage.create({
            ...base,
            ...input,
            reportedAt: at(reportedAt, "08:30"),
        });
        if (input.status === "in_repair")
            await repairFor(damage, {
                status: "scheduled",
                serviceDate: addLocalDays(today, 2),
                cost: input.estimatedCost,
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

/**
 * One fine in each state the fines list filters on: matched to a driver (twice, one already paid and still to
 * recharge), named to the authority, contested, just received, recharged to the booking, paid and kept by the
 * company, and annulled.
 */
const DEMO_FINES = [
    {reference: "DEMO-FINE-1", type: "speeding", authority: "Policia Rrugore", amount: 50, place: "Tirana–Durrës", outcome: "driver_identified"},
    {reference: "DEMO-FINE-2", type: "parking", authority: "Bashkia Tiranë", amount: 20, place: "Blloku", outcome: "transferred"},
    {reference: "DEMO-FINE-3", type: "toll", authority: "Autostrada", amount: 5, place: "Pika e pagesës Rinas", outcome: "paid_to_recharge"},
    {reference: "DEMO-FINE-4", type: "red_light", authority: "Policia Rrugore", amount: 40, place: "Rruga e Kavajës", outcome: "disputed"},
    {reference: "DEMO-FINE-5", type: "parking", authority: "Bashkia Durrës", amount: 15, place: "Shëtitorja e Durrësit", outcome: "received"},
    {reference: "DEMO-FINE-6", type: "speeding", authority: "Policia Rrugore", amount: 35, place: "Rruga e Rinasit", outcome: "charged"},
    {reference: "DEMO-FINE-7", type: "toll", authority: "Autostrada", amount: 5, place: "Pika e pagesës Milot", outcome: "paid_by_company"},
    {reference: "DEMO-FINE-8", type: "parking", authority: "Bashkia Tiranë", amount: 20, place: "Sheshi Skënderbej", outcome: "cancelled"},
] as const;

/** One transfer in each state: two night moves ahead, one on the road now, one done yesterday, one called off. */
const DEMO_TRANSFERS = [
    {notes: "Transferim nate demo 1", status: "planned", depart: {days: 70, time: "23:00"}, hours: 2},
    {notes: "Transferim nate demo 2", status: "planned", depart: {days: 70, time: "23:00"}, hours: 2},
    {notes: "Transferim demo në rrugë", status: "in_transit", depart: {hoursFromNow: -1}, hours: 3},
    {notes: "Transferim demo i kryer dje", status: "done", depart: {days: -1, time: "20:00"}, hours: 2},
    {notes: "Transferim demo i anuluar", status: "cancelled", depart: {days: 21, time: "22:00"}, hours: 2},
] as const;

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
            description: "Dhjetë për qind zbritje nga çmimi bazë i qirasë.",
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
            reason: "Dëm i papaguar nga një qira e mëparshme",
            isActive: true,
        },
    );
    await upsert(
        RentalDenyEntry,
        {company: companyId, licenseNumber: "AL-DENY-0001"},
        {
            ...owned,
            reason: "Patenta u deklarua e humbur",
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
                authorName: publicPersonName(reservation.contact.firstName, reservation.contact.lastName),
                comment:
                    index === 0
                        ? "Makinë e pastër dhe marrja ishte në kohë."
                        : "Makina ishte në rregull; marrja zgjati pak.",
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
        const {outcome, ...details} = fine;
        const paid = {paidAt: new Date(offenceAt.getTime() + 3 * DAY_MS), paidAmount: fine.amount, paymentReference: `PAY-${fine.reference}`};
        // Received and kept-by-the-company fines were never matched to the booking that had the car.
        const matched = outcome !== "received" && outcome !== "paid_by_company";
        const state = {
            driver_identified: {status: "driver_identified"},
            transferred: {status: "transferred"},
            paid_to_recharge: {status: "driver_identified", ...paid},
            disputed: {status: "disputed"},
            received: {status: "received"},
            charged: {status: "driver_identified"},
            paid_by_company: {status: "paid_by_company", ...paid},
            cancelled: {status: "cancelled", notes: "Autoriteti e anuloi gjobën: makina ishte parkuar rregullisht."},
        }[outcome];
        await runInTransaction(logger, async (session) => {
            const [created] = await VehicleFine.create(
                [{
                    ...owned,
                    ...details,
                    ...state,
                    vehicle: vehicleId,
                    offenceAt,
                    ...(matched ? {reservation: booking._id, driverName: mainDriverName(booking)} : {}),
                }],
                {session},
            );
            if (outcome !== "charged") return;
            // Recharged the way the "Charge customer" action does it: a booking line the fine keeps, to take back if annulled.
            const charges = [{code: "fine" as const, label: rentalPricingLabel(LANGUAGE, "fine", {reference: fine.reference}), amount: fine.amount}];
            const held = await RentalReservation.findById(booking._id).session(session);
            if (!held) throw new Error(`Booking for ${fine.reference} vanished`);
            // Silent like the handover and return: the demo customers are made up.
            await addReservationCharges(held, charges, {by: owned.createdBy, silent: true}, {session, logger, languageCode: LANGUAGE, auditUserId: owned.createdBy});
            created.chargedAmount = fine.amount;
            created.charges = charges.map(({label, amount}) => ({label, amount}));
            created.status = "charged";
            await created.save({session});
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

    // A car is free for a transfer when no live or finished booking and no block shares the window.
    const freeCars = async (start: Date, end: Date) => {
        const [busy, blocked] = await Promise.all([
            RentalReservation.distinct("vehicle", {
                company: companyId,
                pickupAt: {$lt: end},
                blockedUntil: {$gt: start},
                status: {$in: ["held", "confirmed", "in_progress", "completed"]},
            }),
            VehicleBlock.distinct("vehicle", {company: companyId, startAt: {$lt: end}, endAt: {$gt: start}, deletedAt: null}),
        ]);
        return Vehicle.find({company: companyId, status: "active", _id: {$nin: [...busy, ...blocked]}})
            .sort({plate: 1})
            .select("homeLocation")
            .limit(8);
    };

    const taken = new Set<string>();
    for (const transfer of DEMO_TRANSFERS) {
        if (await VehicleTransfer.exists({company: companyId, notes: transfer.notes})) continue;
        const departAt = "hoursFromNow" in transfer.depart
            ? new Date(Date.now() + transfer.depart.hoursFromNow * 3600 * 1000)
            : at(addLocalDays(today, transfer.depart.days), transfer.depart.time);
        const arriveAt = new Date(departAt.getTime() + transfer.hours * 3600 * 1000);
        const vehicle = (await freeCars(departAt, arriveAt)).find((car) => !taken.has(String(car._id)));
        if (!vehicle) throw new Error(`No free car for ${transfer.notes}`);
        taken.add(String(vehicle._id));
        const homeId = nestedEntityToRef(vehicle.homeLocation);
        const fromLocation = homeId ?? city._id;
        const toLocation = String(fromLocation) === String(city._id) ? airport._id : city._id;
        await runInTransaction(logger, async (session) => {
            await assertNoBookingClash(vehicle._id, {start: departAt, end: arriveAt}, {companyId, session, languageCode: LANGUAGE});
            // A called-off transfer no longer keeps the car out of bookings, so it has no block (the cancel action removes it).
            const [block] = transfer.status === "cancelled"
                ? [undefined]
                : await VehicleBlock.create(
                    [{...owned, vehicle: vehicle._id, startAt: departAt, endAt: arriveAt, reason: "transfer", source: "transfer", note: transfer.notes}],
                    {session},
                );
            await VehicleTransfer.create(
                [{
                    ...owned,
                    vehicle: vehicle._id,
                    fromLocation,
                    toLocation,
                    departAt,
                    arriveAt,
                    status: transfer.status,
                    notes: transfer.notes,
                    ...(block ? {block: block._id} : {}),
                }],
                {session},
            );
            // Arrived: the car counts at the new location from then on, as the "Complete" action sets it.
            if (transfer.status === "done") {
                await Vehicle.updateOne({_id: vehicle._id}, {$set: {currentLocation: toLocation}}, {session});
            }
        });
    }
}
