import {Router, type Request, type Response} from "express";
import {ObjectId} from "mongodb";
import authMW, {
    type NotAuthenticatedMWType,
} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {
    transactionHandler,
    type TransactionRequiredParams,
} from "@coreModule/utilities/middlewares/transactionUtils";
import publicChatCustomerMW, {
    type PublicChatCustomerMWType,
} from "@coreModule/utilities/middlewares/publicChatCustomerMW";
import {
    publicCustomerFor,
    requirePortalAccount,
} from "@coreModule/domain/publicChat/publicChatCustomer";
import {companyIdsWithModule} from "@coreModule/utilities/modules/companyModules";
import {portalCompanyRefs} from "@coreModule/utilities/marketing/portalCompanies";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {resolveCompanyByOrigin} from "@coreModule/utilities/marketing/resolveCompanyByOrigin";
import {asCrossTenant, withTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {isPortalApexOrigin} from "@coreModule/utilities/marketing/portalOrigin";
import {
    publicMediaUrl,
    publicMediaUrls,
} from "@coreModule/utilities/media/publicMediaUrl";
import {
    generateRecordAccessToken,
    validateRecordAccessToken,
} from "@coreModule/utilities/security/recordAccessToken";
import {decimalToNumber, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {PAYMENTS} from "@financeModule/environment";
import {
    bookRentalFormSchema,
    categoryReviewsFormSchema,
    type CategoryReviewsFormType,
    manageDriverFormSchema,
    manageExtendFormSchema,
    manageExtrasFormSchema,
    manageInvoiceFormSchema,
    manageRentalFormSchema,
    manageReviewFormSchema,
    quoteRentalFormSchema,
    searchRentalFormSchema,
} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.form.validators";
import type {RentalCategoryReviewsResponse} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.response.types";
import type {
    BookRentalFormType,
    ManageDriverFormType,
    ManageExtendFormType,
    ManageExtrasFormType,
    ManageInvoiceFormType,
    ManageRentalFormType,
    ManageReviewFormType,
    QuoteRentalFormType,
    SearchRentalFormType,
} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.forms";
import type {
    PublicRentalChangeResponse,
    PublicRentalReservationResponse,
    RentalMyReservationsResponse,
    RentalBookingResponse,
    RentalQuoteResponse,
    RentalSearchResponse,
    RentalStorefrontCategory,
    RentalStorefrontConfigResponse,
} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.response.types";
import {RENTAL_RESERVATION_LINK_PURPOSE} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {ICompany} from "@coreModule/database/schemas/company/company";
import type {ICarRentalConfig} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {
    type IVehicleCategory,
} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import {
    type IRentalReservation,
} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";
import {rentalReservationToPublic} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {localDateOf} from "@coreModule/utilities/time/timeWindows";
import {mediaUploadMW} from "@coreModule/utilities/middlewares/mediaUploadMW";
import {generateInvoicePdf} from "@financeModule/utilities/pdf/invoicePdf";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {formatPostalAddress} from "@coreModule/utilities/helpers/postalAddress";
import {
    busyUntil,
    freeVehiclesInCategory,
} from "@carRentalModule/utilities/services/rentalAvailability";
import {
    createRentalReservation,
    effectivePaymentPolicy,
    loadApplicablePromo,
    loadBookableCategory,
    loadSelectedExtras,
    quoteTrip,
    resolvePaymentChoice,
} from "@carRentalModule/workflows/rentalReservationService";
import {
    onlinePaymentAvailable,
    startBalancePayment,
    startOnlinePayment,
} from "@carRentalModule/utilities/services/rentalPayments";
import {
    addRentalExtras,
    cancelRentalReservation,
    extendRentalReservation,
    failRentalPayment,
    settleRentalPayment,
} from "@carRentalModule/workflows/rentalLifecycle";
import {generateRentalAgreementPdf} from "@carRentalModule/utilities/pdf/rentalAgreementPdf";
import {
    notifyRentalCustomer,
    notifyRentalStaff,
} from "@carRentalModule/utilities/services/rentalNotify";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {registerPaymentSourceHandler} from "@financeModule/utilities/services/payment/paymentSourceHandlers";
import {markDepositHeld} from "@carRentalModule/utilities/services/rentalDeposit";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {vehicleCategoryService} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.service";
import {invoiceService} from "@financeModule/database/schemas/invoice/invoice.service";
import {rentalLocationService} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.service";
import {rentalExtraService} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.service";
import {mediaService} from "@coreModule/database/schemas/media/media.service";
import {rentalSearchStatService} from "@carRentalModule/database/schemas/rentalSearchStat/rentalSearchStat.service";
import {publicPersonName} from "@coreModule/utilities/helpers/publicName";
export const basePath = "/api/carRental/rentalStorefront";

const MY_RESERVATIONS_MAX = 50;
export const router = Router();

/**
 * Settles rental payments once finance's Stripe webhook has recorded them. Runs
 * in its own transaction (the webhook has none) and re-reads the reservation
 * inside it, so a concurrent cancel or expiry is seen.
 */
registerPaymentSourceHandler(["rentalReservation"], {
    async succeeded(intent, {logger, languageCode}) {
        await runInTransaction(logger, async (session) => {
            const reservation = await rentalReservationService.findOne({
                $or: [
                    {stripePaymentIntentId: intent.id},
                    {balanceIntentIds: intent.id},
                ],
            }, {session: session});
            if (reservation)
                await settleRentalPayment(reservation, intent, {
                    session,
                    logger,
                    languageCode,
                });
        });
    },
    async failed(intent, {logger, languageCode}) {
        await runInTransaction(logger, async (session) => {
            const reservation = await rentalReservationService.findOne({
                $or: [
                    {stripePaymentIntentId: intent.id},
                    {balanceIntentIds: intent.id},
                ],
            }, {session: session});
            if (reservation)
                await failRentalPayment(reservation, intent, {
                    session,
                    logger,
                    languageCode,
                });
        });
    },
    async authorized(intent, {logger, languageCode}) {
        await runInTransaction(logger, async (session) => {
            const reservation = await rentalReservationService.findOne({
                "deposit.intentId": intent.id,
            }, {session: session});
            if (reservation)
                await markDepositHeld(
                    reservation,
                    {},
                    {session, logger, languageCode},
                );
        });
    },
    async setupSucceeded(setup, {logger, languageCode}) {
        await runInTransaction(logger, async (session) => {
            const reservation = await rentalReservationService.findOne({
                "deposit.setupIntentId": setup.id,
            }, {session: session});
            if (reservation)
                await markDepositHeld(
                    reservation,
                    {
                        paymentMethodId: setup.paymentMethodId,
                        customerId: setup.customerId,
                    },
                    {session, logger, languageCode},
                );
        });
    },
});

type PublicParams<F> = NotAuthenticatedMWType & F;

/**
 * The tenant behind the site and its rental settings; 404 until public booking is switched
 * on, and on the portal apex until the company opts in to being listed there.
 */
async function storefrontContext(
    origin: string,
    languageCode: string,
): Promise<{company: ICompany; config: ICarRentalConfig}> {
    const company = await resolveCompanyByOrigin(origin, languageCode);
    const config = await carRentalConfigService.findForCompany(company._id, {
        languageCode,
    });
    if (!config?.publicBookingEnabled) {
        throw apiValidationException(
            "car_rental_not_configured",
            "",
            null,
            languageCode,
        );
    }
    if (isPortalApexOrigin(origin) && !config.listedOnPortal) {
        throw apiValidationException(
            "portal_company_not_listed",
            "",
            null,
            languageCode,
        );
    }
    return {company, config};
}

/** The rental currency (kept here for the storefront's callers; the settings service owns it). */
export function currencyOf(config: ICarRentalConfig, languageCode: string): Promise<CurrencySimple> {
    return carRentalConfigService.currencyOf(config, languageCode);
}

export function categoryToStorefront(
    category: IVehicleCategory,
): RentalStorefrontCategory {
    return {
        _id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        description: category.description,
        images: publicMediaUrls(category.images),
        videos: publicMediaUrls(category.videos),
        seats: category.seats,
        doors: category.doors,
        luggage: category.luggage,
        transmission: category.transmission,
        fuelType: category.fuelType,
        features: category.features ?? [],
        dailyRate: category.dailyRate,
        depositAmount: category.depositAmount ?? 0,
        mileagePolicy: category.mileagePolicy,
        includedKmPerDay: category.includedKmPerDay,
        extraKmPrice: category.extraKmPrice,
        minDriverAge: category.minDriverAge,
        crossBorderAllowed: category.crossBorderAllowed !== false,
        crossBorderFee: category.crossBorderFee,
    };
}

export async function publicCategories(
    companyId: ObjectId,
): Promise<IVehicleCategory[]> {
    return vehicleCategoryService.find({
        company: companyId,
        isPublic: true,
        deletedAt: null,
    }, {}, undefined, undefined, {sortOrder: 1, name: 1});
}

/** A reservation for its customer, with the currency populated for display and its invoices listed. */
async function publicReservation(reservation: IRentalReservation) {
    await reservation.populate({
        path: "pricing.currency",
        select: "name symbol abbreviation",
    });
    const invoices = await invoiceService.find({
        company: nestedEntityToRef(reservation.company),
        sourceType: "rentalReservation",
        sourceId: reservation._id,
        deletedAt: null,
    }, {}, undefined, "number total", {issuedAt: 1});
    return {
        ...rentalReservationToPublic(reservation),
        invoices: invoices.map((invoice) => ({
            id: invoice._id.toString(),
            number: invoice.number,
            total: decimalToNumber(invoice.total) ?? 0,
        })),
    };
}

/** The reservation a guest link opens, if the link is still the current one. */
async function reservationFromLink(
    token: string,
    company: ICompany,
    languageCode: string,
    session?: TransactionRequiredParams["session"],
): Promise<IRentalReservation> {
    const payload = validateRecordAccessToken(
        token,
        RENTAL_RESERVATION_LINK_PURPOSE,
        languageCode,
    );
    if (payload.companyId !== company._id.toString()) {
        throw apiValidationException(
            "link_no_longer_valid",
            "",
            null,
            languageCode,
        );
    }
    const reservation = await rentalReservationService.findOne({
        _id: new ObjectId(payload.recordId),
        company: company._id,
        deletedAt: null,
    }, {session: session ?? undefined});
    if (!reservation || reservation.manageTokenVersion !== payload.version) {
        throw apiValidationException(
            "link_no_longer_valid",
            "",
            null,
            languageCode,
        );
    }
    return reservation;
}

router.post(
    "/config",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    asyncHandler(
        async ({
            origin,
            languageCode,
        }: NotAuthenticatedMWType): Promise<RentalStorefrontConfigResponse> => {
            const {company, config} = await storefrontContext(
                origin,
                languageCode,
            );
            const [locations, categories, extras, currency] = await Promise.all(
                [
                    rentalLocationService.find({
                        company: company._id,
                        isActive: true,
                        deletedAt: null,
                    }, {}, [
                            {path: "address.city", select: "name"},
                            {path: "address.country", select: "name"},
                        ], undefined, {name: 1}),
                    publicCategories(company._id),
                    rentalExtraService.find({
                        company: company._id,
                        isActive: true,
                        deletedAt: null,
                    }, {}, undefined, undefined, {sortOrder: 1, name: 1}),
                    currencyOf(config, languageCode),
                ],
            );
            const online = onlinePaymentAvailable();
            return {
                data: {
                    company: {
                        name: company.name,
                        logo: publicMediaUrl(company.logo),
                        email: company.email,
                        phoneNumber: company.phoneNumber,
                        website: company.website,
                    },
                    currency,
                    paymentPolicy: effectivePaymentPolicy(config),
                    onlinePaymentAvailable: online,
                    stripePublishableKey: online
                        ? PAYMENTS.STRIPE_PUBLISHABLE_KEY || undefined
                        : undefined,
                    guestBookingAllowed: config.guestBookingAllowed,
                    minRentalHours: config.minRentalHours,
                    maxRentalDays: config.maxRentalDays,
                    minLeadTimeHours: config.minLeadTimeHours,
                    maxAdvanceDays: config.maxAdvanceDays,
                    freeCancellationHours: config.freeCancellationHours,
                    cancellationFeePercent: config.cancellationFeePercent,
                    vatRate: config.vatRate,
                    pricesIncludeVat: config.pricesIncludeVat,
                    termsVersion: config.termsVersion,
                    termsText: config.termsText,
                    locations: locations.map((location) => ({
                        _id: location._id.toString(),
                        name: location.name,
                        address: formatPostalAddress(location.address),
                        phone: location.phone,
                        email: location.email,
                        timezone: location.timezone,
                        openingHours: location.openingHours.map(
                            ({dayOfWeek, startTime, endTime}) => ({
                                dayOfWeek,
                                startTime,
                                endTime,
                            }),
                        ),
                        closures: location.closures.map(
                            (closure) => closure.date,
                        ),
                        pickupAllowed: location.pickupAllowed,
                        returnAllowed: location.returnAllowed,
                    })),
                    categories: categories.map(categoryToStorefront),
                    extras: extras.map((extra) => ({
                        _id: extra._id.toString(),
                        name: extra.name,
                        kind: extra.kind,
                        description: extra.description,
                        pricing: extra.pricing,
                        price: extra.price,
                        maxQuantity: extra.maxQuantity,
                        excessAmount: extra.excessAmount,
                        depositAmount: extra.depositAmount,
                    })),
                },
            };
        },
    ),
);

/** Every public category with whether a car is free for the trip, and its price. Advisory: booking re-checks. */
/**
 * POST /api/carRental/rentalStorefront/reviews
 *
 * A car class's published reviews on the rental site (D178): the average, how many, and the latest ones. Reviews are
 * written from the emailed manage link after a completed rental and shown once staff publish them.
 */
router.post(
    "/reviews",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(categoryReviewsFormSchema),
    asyncHandler(
        async ({origin, languageCode, category, limit}: NotAuthenticatedMWType & CategoryReviewsFormType): Promise<RentalCategoryReviewsResponse> => {
            const {company} = await storefrontContext(origin, languageCode);
            const found = await rentalReviewService.publishedForCategory(company._id, new ObjectId(category), limit ?? 10);
            return {
                data: {
                    average: found.average,
                    count: found.count,
                    reviews: found.reviews.map((review) => ({
                        rating: review.rating,
                        ...(review.comment ? {comment: review.comment} : {}),
                        ...(review.authorName ? {authorName: review.authorName} : {}),
                        createdAt: review.createdAt.toISOString(),
                    })),
                },
            };
        },
    ),
);

router.post(
    "/search",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(searchRentalFormSchema),
    asyncHandler(
        async (
            params: PublicParams<SearchRentalFormType>,
        ): Promise<RentalSearchResponse> => {
            const {origin, languageCode} = params;
            const {company, config} = await storefrontContext(
                origin,
                languageCode,
            );
            const trip = await resolveRentalTrip(params, config, {
                companyId: company._id,
                languageCode,
                online: true,
            });
            const [categories, currency] = await Promise.all([
                publicCategories(company._id),
                currencyOf(config, languageCode),
            ]);
            const end = busyUntil(
                trip.returnAt,
                config.turnaroundBufferMinutes,
            );
            const now = new Date();

            const results = await Promise.all(
                categories.map(async (category) => {
                    const free = await freeVehiclesInCategory({
                        companyId: company._id,
                        categoryId: category._id,
                        start: trip.pickupAt,
                        end,
                        now,
                    });
                    const quote = quoteTrip(config, category, [], trip, {
                        languageCode,
                    });
                    return {category, available: free.length > 0, quote};
                }),
            );
            const day = localDateOf(
                trip.pickupAt,
                trip.pickupLocation.timezone,
            );
            if (results.length) {
                await rentalSearchStatService.recordSearches(
                    {company: company._id, day, location: trip.pickupLocation._id},
                    results.map((row) => ({category: row.category._id, available: row.available})),
                );
            }
            return {
                data: {
                    pickupAt: trip.pickupAt.toISOString(),
                    returnAt: trip.returnAt.toISOString(),
                    results: results.map((row) => ({
                        category: categoryToStorefront(row.category),
                        available: row.available,
                        quote: {...row.quote, currency},
                    })),
                },
            };
        },
    ),
);

router.post(
    "/quote",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(quoteRentalFormSchema),
    asyncHandler(
        async (
            params: PublicParams<QuoteRentalFormType>,
        ): Promise<RentalQuoteResponse> => {
            const {origin, languageCode} = params;
            const {company, config} = await storefrontContext(
                origin,
                languageCode,
            );
            const trip = await resolveRentalTrip(params, config, {
                companyId: company._id,
                languageCode,
                online: true,
            });
            const category = await loadBookableCategory(
                company._id,
                params.category,
                {languageCode, online: true},
            );
            const extras = await loadSelectedExtras(
                company._id,
                params.extras ?? [],
                {languageCode},
            );
            const promo = await loadApplicablePromo(
                company._id,
                params.promoCode,
                {config, category, trip},
                {languageCode},
            );
            const drivers = params.driverBirthDate
                ? [
                      {
                          role: "primary" as const,
                          firstName: "",
                          lastName: "",
                          birthDate: params.driverBirthDate,
                      },
                  ]
                : [];
            return {
                data: {
                    ...quoteTrip(config, category, extras, trip, {
                        languageCode,
                        drivers,
                        promo,
                        crossBorder: params.crossBorder,
                    }),
                    currency: await currencyOf(config, languageCode),
                },
            };
        },
    ),
);

/**
 * Online booking. A signed-in customer (login token on the request) is linked to
 * the reservation; guests need the company to allow guest booking. Online
 * payment answers with the client secret the site confirms with.
 */
router.post(
    "/book",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    transactionHandler(),
    validateFormZod(bookRentalFormSchema),
    publicChatCustomerMW(),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<BookRentalFormType> &
                PublicChatCustomerMWType,
        ): Promise<RentalBookingResponse> => {
            const {origin, languageCode, session, logger} = params;
            const {company, config} = await storefrontContext(
                origin,
                languageCode,
            );
            const customer = await publicCustomerFor(
                params.customer,
                company,
                origin,
            );
            if (!customer && !config.guestBookingAllowed) {
                throw apiValidationException(
                    "rental_guest_booking_disabled",
                    "",
                    null,
                    languageCode,
                );
            }
            if (!params.acceptTerms) {
                throw apiValidationException(
                    "rental_terms_not_accepted",
                    "",
                    null,
                    languageCode,
                );
            }
            if (params.paymentChoice === "on_account") {
                throw apiValidationException(
                    "rental_on_account_needs_account",
                    "",
                    null,
                    languageCode,
                );
            }

            const ctx = {
                session,
                logger,
                languageCode,
                auditUserId: customer?._id,
            };
            const trip = await resolveRentalTrip(params, config, {
                companyId: company._id,
                languageCode,
                online: true,
                session,
            });
            const category = await loadBookableCategory(
                company._id,
                params.category,
                {languageCode, online: true, session},
            );
            const extras = await loadSelectedExtras(
                company._id,
                params.extras ?? [],
                {languageCode, session},
            );
            const promo = await loadApplicablePromo(
                company._id,
                params.promoCode,
                {config, category, trip, email: params.contact.email},
                {languageCode, session},
            );
            // The customer is the main driver; licence details follow at the counter or on the manage page.
            const drivers = [
                {
                    role: "primary" as const,
                    firstName: params.contact.firstName,
                    lastName: params.contact.lastName,
                    birthDate: params.driverBirthDate,
                },
            ];
            const paymentChoice = resolvePaymentChoice(
                config,
                params.paymentChoice,
                {
                    onlinePaymentAvailable: onlinePaymentAvailable(),
                    grandTotal: quoteTrip(config, category, extras, trip, {
                        languageCode,
                        drivers,
                        promo,
                        crossBorder: params.crossBorder,
                    }).grandTotal,
                    languageCode,
                },
            );

            const {reservation, created} = await createRentalReservation(
                {
                    companyId: company._id,
                    config,
                    category,
                    trip,
                    extras,
                    contact: params.contact,
                    drivers,
                    promo,
                    customerId: customer?._id,
                    idempotencyKey: params.idempotencyKey,
                    source: "online",
                    paymentChoice,
                    crossBorder: params.crossBorder,
                    expectedTotal: params.expectedTotal,
                },
                ctx,
            );

            if (created && reservation.status === "confirmed") {
                await notifyRentalCustomer("confirmed", reservation, ctx);
                await notifyRentalStaff(
                    NotificationEventCodes.RENTAL_RESERVATION_NEW,
                    reservation,
                    ctx,
                );
            }

            let payment: RentalBookingResponse["data"]["payment"];
            if (
                reservation.status === "held" &&
                reservation.paymentChoice === "online"
            ) {
                const {clientSecret} = await startOnlinePayment(
                    reservation,
                    ctx,
                );
                payment = {
                    clientSecret,
                    publishableKey: PAYMENTS.STRIPE_PUBLISHABLE_KEY,
                };
            }

            return {
                data: {
                    reservation: await publicReservation(reservation),
                    manageToken: generateRecordAccessToken({
                        purpose: RENTAL_RESERVATION_LINK_PURPOSE,
                        companyId: company._id,
                        recordId: reservation._id,
                        version: reservation.manageTokenVersion,
                        languageCode,
                    }),
                    payment,
                },
            };
        },
    ),
);

/**
 * A portal account's reservations at every rental company that still has the module, newest
 * pickup first. Each comes with the company's portal slug and a fresh manage token, so the
 * existing manage/cancel endpoints serve it under `x-site-company`.
 */
router.post(
    "/mine",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 30}),
    publicChatCustomerMW(),
    asyncHandler(
        async (
            params: NotAuthenticatedMWType & PublicChatCustomerMWType,
        ): Promise<RentalMyReservationsResponse> => {
            const {origin, languageCode} = params;
            const user = await requirePortalAccount(
                params.customer,
                origin,
                languageCode,
            );
            const rentalCompanies = await companyIdsWithModule("carRental");
            const reservations = await asCrossTenant("a portal customer's own bookings at every rental company", () =>
                rentalReservationService.find({customer: user._id, deletedAt: null, company: {$in: rentalCompanies}}, {}, undefined, undefined, {pickupAt: -1}, MY_RESERVATIONS_MAX));
            const companies = await portalCompanyRefs(
                reservations.map(
                    (reservation) => nestedEntityToRef(reservation.company)!,
                ),
            );
            const data = await Promise.all(
                reservations.map(async (reservation) => ({
                    // Each booking's details are read as its own company's data.
                    reservation: await withTenant(nestedEntityToRef(reservation.company)!, () => publicReservation(reservation), "carRental"),
                    company: companies.get(
                        String(nestedEntityToRef(reservation.company)),
                    ) ?? {name: "", slug: ""},
                    manageToken: generateRecordAccessToken({
                        purpose: RENTAL_RESERVATION_LINK_PURPOSE,
                        companyId: nestedEntityToRef(reservation.company)!,
                        recordId: reservation._id,
                        version: reservation.manageTokenVersion,
                        languageCode,
                    }),
                })),
            );
            return {data};
        },
    ),
);

/** The guest "manage your booking" page. */
router.post(
    "/manage",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 30, failClosed: true}),
    validateFormZod(manageRentalFormSchema),
    asyncHandler(
        async (
            params: PublicParams<ManageRentalFormType>,
        ): Promise<PublicRentalReservationResponse> => {
            const {origin, languageCode, token} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            return {
                data: await publicReservation(
                    await reservationFromLink(token, company, languageCode),
                ),
            };
        },
    ),
);

/** Guest cancellation, with the fee from the policy they booked under. The link stops working afterwards. */
router.post(
    "/manage/cancel",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageRentalFormSchema),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<ManageRentalFormType>,
        ): Promise<PublicRentalReservationResponse> => {
            const {origin, languageCode, token, session, logger} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
                session,
            );
            if (reservation.pickupAt <= new Date()) {
                throw apiValidationException(
                    "rental_reservation_invalid_status",
                    "",
                    null,
                    languageCode,
                );
            }
            await cancelRentalReservation(
                reservation,
                {
                    by: "customer",
                    reason: "cancelled_by_customer",
                    applyFee: true,
                },
                {session, logger, languageCode},
            );
            return {data: await publicReservation(reservation)};
        },
    ),
);

const documentUpload = mediaUploadMW({
    fields: {files: 4},
    fieldMimeTypes: {
        files: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    },
    maxFileSize: 8 * 1024 * 1024,
});

/** The upload is stored against the company that owns the booking the link opens. */
const asLinkUploader =
    () =>
    async (req: Request, _res: Response, next: (error?: unknown) => void) => {
        try {
            const token = String(req.query.token ?? "");
            const languageCode = String(req.body.languageCode ?? "en-US");
            const company = await resolveCompanyByOrigin(
                req.body.origin,
                languageCode,
            );
            await reservationFromLink(token, company, languageCode);
            req.body.userInfo = {_id: nestedEntityToRef(company.createdBy)};
            req.body.user = {company: {_id: company._id}};
            next();
        } catch (error) {
            next(error);
        }
    };

router.post(
    "/manage/documents",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    asLinkUploader(),
    documentUpload,
    asyncHandler(
        async (
            params: PublicParams<{files?: string[]}> & {token?: string},
            query: {token?: string},
        ): Promise<PublicRentalReservationResponse> => {
            const {origin, languageCode} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                String(query.token ?? ""),
                company,
                languageCode,
            );
            const driver =
                reservation.drivers.find((row) => row.role === "primary") ??
                reservation.drivers[0];
            if (
                !driver ||
                !(
                    reservation.status === "held" ||
                    reservation.status === "confirmed"
                )
            ) {
                throw apiValidationException(
                    "rental_extend_not_open",
                    "",
                    null,
                    languageCode,
                );
            }
            const ids = (params.files ?? [])
                .filter((id) => ObjectId.isValid(id))
                .map((id) => new ObjectId(id));
            const media = await mediaService.find({
                _id: {$in: ids},
                company: company._id,
            }, {}, undefined, "_id");
            driver.documents = [
                ...(driver.documents ?? []),
                ...media.map((file) => file._id),
            ];
            reservation.markModified("drivers");
            await reservation.save();
            return {data: await publicReservation(reservation)};
        },
    ),
);

router.post(
    "/manage/driver",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 20, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageDriverFormSchema),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<ManageDriverFormType>,
        ): Promise<PublicRentalReservationResponse> => {
            const {origin, languageCode, token, session} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
                session,
            );
            const driver =
                reservation.drivers.find((row) => row.role === "primary") ??
                reservation.drivers[0];
            if (
                !driver ||
                !(
                    reservation.status === "held" ||
                    reservation.status === "confirmed"
                )
            ) {
                throw apiValidationException(
                    "rental_extend_not_open",
                    "",
                    null,
                    languageCode,
                );
            }
            driver.licenseNumber = params.licenseNumber;
            driver.licenseCountry = params.licenseCountry;
            driver.licenseIssuedAt = params.licenseIssuedAt;
            driver.licenseExpiresAt = params.licenseExpiresAt;
            driver.idDocumentType = params.idDocumentType;
            driver.idDocumentNumber = params.idDocumentNumber;
            reservation.markModified("drivers");
            await reservation.save({session});
            return {data: await publicReservation(reservation)};
        },
    ),
);

router.post(
    "/manage/extend",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageExtendFormSchema),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<ManageExtendFormType>,
        ): Promise<PublicRentalChangeResponse> => {
            const {origin, languageCode, token, session, logger} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
                session,
            );
            const ctx = {session, logger, languageCode};
            await extendRentalReservation(
                reservation,
                {returnDate: params.returnDate, returnTime: params.returnTime},
                ctx,
            );
            const payment = params.pay
                ? await startBalancePayment(reservation, ctx)
                : undefined;
            return {
                data: await publicReservation(reservation),
                ...(payment
                    ? {
                          payment: {
                              clientSecret: payment.clientSecret,
                              publishableKey: PAYMENTS.STRIPE_PUBLISHABLE_KEY,
                          },
                      }
                    : {}),
            };
        },
    ),
);

router.post(
    "/manage/extras",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageExtrasFormSchema),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<ManageExtrasFormType>,
        ): Promise<PublicRentalReservationResponse> => {
            const {origin, languageCode, token, session, logger} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
                session,
            );
            await addRentalExtras(reservation, params.extras, {
                session,
                logger,
                languageCode,
            });
            return {data: await publicReservation(reservation)};
        },
    ),
);

router.post(
    "/manage/pay",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageRentalFormSchema),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<ManageRentalFormType>,
        ): Promise<PublicRentalChangeResponse> => {
            const {origin, languageCode, token, session, logger} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
                session,
            );
            const payment = await startBalancePayment(reservation, {
                session,
                logger,
                languageCode,
            });
            return {
                data: await publicReservation(reservation),
                payment: {
                    clientSecret: payment.clientSecret,
                    publishableKey: PAYMENTS.STRIPE_PUBLISHABLE_KEY,
                },
            };
        },
    ),
);

router.post(
    "/manage/review",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 5, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageReviewFormSchema),
    asyncHandler(
        async (
            params: TransactionRequiredParams &
                PublicParams<ManageReviewFormType>,
        ): Promise<{data: {saved: true}}> => {
            const {origin, languageCode, token, session, logger} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
                session,
            );
            if (reservation.status !== "completed")
                throw apiValidationException(
                    "rental_review_not_open",
                    "",
                    null,
                    languageCode,
                );
            const existing = await rentalReviewService.findOne({
                company: company._id,
                reservation: reservation._id,
                deletedAt: null,
            }, {session: session});
            if (existing)
                throw apiValidationException(
                    "rentalReview_already_exists",
                    "",
                    null,
                    languageCode,
                );
            await rentalReviewService.create(
                {
                    company: company._id,
                    reservation: reservation._id,
                    rating: params.rating,
                    comment: params.comment,
                    // Shown in public: the first name and the last name's initial, as dental reviews (TD-B265).
                    authorName: publicPersonName(reservation.contact.firstName, reservation.contact.lastName),
                    isPublished: false,
                },
                {
                    session,
                    logger,
                    languageCode,
                    auditUserId: nestedEntityToRef(company.createdBy),
                },
            );
            return {data: {saved: true}};
        },
    ),
);

router.post(
    "/manage/agreement",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 20, failClosed: true}),
    validateFormZod(manageRentalFormSchema),
    asyncHandler(
        async (
            params: PublicParams<ManageRentalFormType>,
            _query: object,
            _req: Request,
            res: Response,
        ) => {
            const {origin, languageCode, token} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
            );
            if (!reservation.handover)
                throw apiValidationException(
                    "rental_reservation_not_found",
                    "",
                    null,
                    languageCode,
                );
            const buffer = await generateRentalAgreementPdf(
                reservation,
                languageCode,
            );
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${encodeURIComponent(`${reservation.number}.pdf`)}"`,
            );
            res.setHeader("Content-Length", buffer.length);
            res.send(buffer);
        },
    ),
);

router.post(
    "/manage/invoice",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 20, failClosed: true}),
    validateFormZod(manageInvoiceFormSchema),
    asyncHandler(
        async (
            params: PublicParams<ManageInvoiceFormType>,
            _query: object,
            _req: Request,
            res: Response,
        ) => {
            const {origin, languageCode, token} = params;
            const company = await resolveCompanyByOrigin(origin, languageCode);
            const reservation = await reservationFromLink(
                token,
                company,
                languageCode,
            );
            const invoice = await invoiceService.findOne({
                _id: new ObjectId(params.invoiceId),
                company: company._id,
                sourceType: "rentalReservation",
                sourceId: reservation._id,
                deletedAt: null,
            }, {});
            if (!invoice)
                throw apiValidationException(
                    "rental_reservation_not_found",
                    "",
                    null,
                    languageCode,
                );
            const buffer = await generateInvoicePdf(invoice, languageCode);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${encodeURIComponent(`${invoice.number}.pdf`)}"`,
            );
            res.setHeader("Content-Length", buffer.length);
            res.send(buffer);
        },
    ),
);
