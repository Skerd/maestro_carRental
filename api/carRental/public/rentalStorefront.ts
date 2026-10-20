import {Router} from "express";
import {ObjectId} from "mongodb";
import authMW, {type NotAuthenticatedMWType} from "@coreModule/utilities/middlewares/authMW";
import {asyncHandler} from "@coreModule/utilities/middlewares/asyncHandler";
import {rateLimiter} from "@coreModule/utilities/middlewares/rateLimiter";
import {validateFormZod} from "@coreModule/utilities/middlewares/validateFormZod";
import {transactionHandler, type TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import publicChatCustomerMW, {type PublicChatCustomerMWType} from "@coreModule/utilities/middlewares/publicChatCustomerMW";
import {resolveCompanyByOrigin} from "@coreModule/utilities/marketing/resolveCompanyByOrigin";
import {publicMediaUrl, publicMediaUrls} from "@coreModule/utilities/media/publicMediaUrl";
import {generateRecordAccessToken, validateRecordAccessToken} from "@coreModule/utilities/security/recordAccessToken";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import Currency from "@coreModule/database/schemas/currency/currency";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {PAYMENTS} from "@financeModule/environment";
import {getPaymentAdapter} from "@financeModule/utilities/services/payment/paymentService";
import {
    bookRentalFormSchema,
    manageRentalFormSchema,
    quoteRentalFormSchema,
    searchRentalFormSchema,
} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.form.validators";
import type {
    BookRentalFormType,
    ManageRentalFormType,
    QuoteRentalFormType,
    SearchRentalFormType,
} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.forms";
import type {
    PublicRentalReservationResponse,
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
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleCategory, {type IVehicleCategory} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory";
import RentalExtra from "@carRentalModule/database/schemas/rentalExtra/rentalExtra";
import RentalReservation, {type IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReservationToPublic} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {resolveRentalTrip} from "@carRentalModule/utilities/services/rentalTrip";
import {formatPostalAddress} from "@coreModule/utilities/helpers/postalAddress";
import {busyUntil, freeVehiclesInCategory} from "@carRentalModule/utilities/services/rentalAvailability";
import {
    createRentalReservation,
    loadBookableCategory,
    loadSelectedExtras,
    quoteTrip,
    resolvePaymentChoice,
} from "@carRentalModule/utilities/services/rentalReservationService";
import {startOnlinePayment} from "@carRentalModule/utilities/services/rentalPayments";
import {cancelRentalReservation, failRentalPayment, settleRentalPayment} from "@carRentalModule/utilities/services/rentalLifecycle";
import {notifyRentalCustomer, notifyRentalStaff} from "@carRentalModule/utilities/services/rentalNotify";
import {runInTransaction} from "@coreModule/utilities/middlewares/runInTransaction";
import {registerPaymentSourceHandler} from "@financeModule/utilities/services/payment/paymentSourceHandlers";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

export const basePath = "/api/carRental/rentalStorefront";
export const router = Router();

/**
 * Settles rental payments once finance's Stripe webhook has recorded them. Runs
 * in its own transaction (the webhook has none) and re-reads the reservation
 * inside it, so a concurrent cancel or expiry is seen.
 */
registerPaymentSourceHandler(["rentalReservation"], {
    async succeeded(intent, {logger, languageCode}) {
        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findOne({stripePaymentIntentId: intent.id}).session(session);
            if (reservation) await settleRentalPayment(reservation, intent, {session, logger, languageCode});
        });
    },
    async failed(intent, {logger, languageCode}) {
        await runInTransaction(logger, async (session) => {
            const reservation = await RentalReservation.findOne({stripePaymentIntentId: intent.id}).session(session);
            if (reservation) await failRentalPayment(reservation, intent, {session, logger, languageCode});
        });
    },
});

type PublicParams<F> = NotAuthenticatedMWType & F;

/** The tenant behind the site and its rental settings; 404 until public booking is switched on. */
async function storefrontContext(origin: string, languageCode: string): Promise<{company: ICompany; config: ICarRentalConfig}> {
    const company = await resolveCompanyByOrigin(origin, languageCode);
    const config = await carRentalConfigService.findForCompany(company._id, {languageCode});
    if (!config?.publicBookingEnabled) {
        throw apiValidationException("car_rental_not_configured", "", null, languageCode);
    }
    return {company, config};
}

async function currencyOf(config: ICarRentalConfig, languageCode: string): Promise<CurrencySimple> {
    const currency = mapSnippet<CurrencySimple>()(await Currency.findById(config.currency).select("name symbol abbreviation"), CurrencySimpleSnippet);
    if (!currency) throw apiValidationException("rental_currency_not_configured", "", null, languageCode);
    return currency;
}

function onlinePaymentAvailable(): boolean {
    return Boolean(PAYMENTS.STRIPE_ENABLED && getPaymentAdapter("stripe")?.isEnabled());
}

function categoryToStorefront(category: IVehicleCategory): RentalStorefrontCategory {
    return {
        _id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        description: category.description,
        images: publicMediaUrls(category.images),
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
    };
}

async function publicCategories(companyId: ObjectId): Promise<IVehicleCategory[]> {
    return VehicleCategory.find({company: companyId, isPublic: true, deletedAt: null}).sort({sortOrder: 1, name: 1});
}

/** A reservation for its customer, with the currency populated for display. */
async function publicReservation(reservation: IRentalReservation) {
    await reservation.populate({path: "pricing.currency", select: "name symbol abbreviation"});
    return rentalReservationToPublic(reservation);
}

/** The reservation a guest link opens, if the link is still the current one. */
async function reservationFromLink(token: string, company: ICompany, languageCode: string, session?: TransactionRequiredParams["session"]): Promise<IRentalReservation> {
    const payload = validateRecordAccessToken(token, RENTAL_RESERVATION_LINK_PURPOSE, languageCode);
    if (payload.companyId !== company._id.toString()) {
        throw apiValidationException("token_verification_failed", "", null, languageCode);
    }
    const reservation = await RentalReservation.findOne({_id: new ObjectId(payload.recordId), company: company._id, deletedAt: null}).session(session ?? null);
    if (!reservation || reservation.manageTokenVersion !== payload.version) {
        throw apiValidationException("token_verification_failed", "", null, languageCode);
    }
    return reservation;
}

router.post(
    "/config",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    asyncHandler(async ({origin, languageCode}: NotAuthenticatedMWType): Promise<RentalStorefrontConfigResponse> => {
        const {company, config} = await storefrontContext(origin, languageCode);
        const [locations, categories, extras, currency] = await Promise.all([
            RentalLocation.find({company: company._id, isActive: true, deletedAt: null})
                .populate([{path: "address.city", select: "name"}, {path: "address.country", select: "name"}])
                .sort({name: 1}),
            publicCategories(company._id),
            RentalExtra.find({company: company._id, isActive: true, deletedAt: null}).sort({sortOrder: 1, name: 1}),
            currencyOf(config, languageCode),
        ]);
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
                paymentPolicy: config.paymentPolicy,
                onlinePaymentAvailable: online,
                stripePublishableKey: online ? PAYMENTS.STRIPE_PUBLISHABLE_KEY || undefined : undefined,
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
                    openingHours: location.openingHours.map(({dayOfWeek, startTime, endTime}) => ({dayOfWeek, startTime, endTime})),
                    closures: location.closures.map((closure) => closure.date),
                    pickupAllowed: location.pickupAllowed,
                    returnAllowed: location.returnAllowed,
                })),
                categories: categories.map(categoryToStorefront),
                extras: extras.map((extra) => ({
                    _id: extra._id.toString(),
                    name: extra.name,
                    description: extra.description,
                    pricing: extra.pricing,
                    price: extra.price,
                    maxQuantity: extra.maxQuantity,
                })),
            },
        };
    }),
);

/** Every public category with whether a car is free for the trip, and its price. Advisory: booking re-checks. */
router.post(
    "/search",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(searchRentalFormSchema),
    asyncHandler(async (params: PublicParams<SearchRentalFormType>): Promise<RentalSearchResponse> => {
        const {origin, languageCode} = params;
        const {company, config} = await storefrontContext(origin, languageCode);
        const trip = await resolveRentalTrip(params, config, {companyId: company._id, languageCode, online: true});
        const [categories, currency] = await Promise.all([publicCategories(company._id), currencyOf(config, languageCode)]);
        const end = busyUntil(trip.returnAt, config.turnaroundBufferMinutes);
        const now = new Date();

        const results = await Promise.all(categories.map(async (category) => {
            const free = await freeVehiclesInCategory({companyId: company._id, categoryId: category._id, start: trip.pickupAt, end, now});
            const quote = quoteTrip(config, category, [], trip);
            return {category: categoryToStorefront(category), available: free.length > 0, quote: {...quote, currency}};
        }));
        return {data: {pickupAt: trip.pickupAt.toISOString(), returnAt: trip.returnAt.toISOString(), results}};
    }),
);

router.post(
    "/quote",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 60}),
    validateFormZod(quoteRentalFormSchema),
    asyncHandler(async (params: PublicParams<QuoteRentalFormType>): Promise<RentalQuoteResponse> => {
        const {origin, languageCode} = params;
        const {company, config} = await storefrontContext(origin, languageCode);
        const trip = await resolveRentalTrip(params, config, {companyId: company._id, languageCode, online: true});
        const category = await loadBookableCategory(company._id, params.category, {languageCode, online: true});
        const extras = await loadSelectedExtras(company._id, params.extras ?? [], {languageCode});
        return {data: {...quoteTrip(config, category, extras, trip), currency: await currencyOf(config, languageCode)}};
    }),
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
    asyncHandler(async (params: TransactionRequiredParams & PublicParams<BookRentalFormType> & PublicChatCustomerMWType): Promise<RentalBookingResponse> => {
        const {origin, languageCode, session, logger} = params;
        const {company, config} = await storefrontContext(origin, languageCode);
        const customer = params.customer && params.customer.companyId.equals(company._id) ? params.customer.user : undefined;
        if (!customer && !config.guestBookingAllowed) {
            throw apiValidationException("rental_guest_booking_disabled", "", null, languageCode);
        }
        if (!params.acceptTerms) {
            throw apiValidationException("rental_terms_not_accepted", "", null, languageCode);
        }

        const ctx = {session, logger, languageCode, auditUserId: customer?._id};
        const trip = await resolveRentalTrip(params, config, {companyId: company._id, languageCode, online: true, session});
        const category = await loadBookableCategory(company._id, params.category, {languageCode, online: true, session});
        const extras = await loadSelectedExtras(company._id, params.extras ?? [], {languageCode, session});
        const paymentChoice = resolvePaymentChoice(config, params.paymentChoice, {
            onlinePaymentAvailable: onlinePaymentAvailable(),
            grandTotal: quoteTrip(config, category, extras, trip).grandTotal,
            languageCode,
        });

        const {reservation, created} = await createRentalReservation(
            {
                companyId: company._id,
                config,
                category,
                trip,
                extras,
                contact: params.contact,
                customerId: customer?._id,
                idempotencyKey: params.idempotencyKey,
                source: "online",
                paymentChoice,
                expectedTotal: params.expectedTotal,
            },
            ctx,
        );

        if (created && reservation.status === "confirmed") {
            await notifyRentalCustomer("confirmed", reservation, ctx);
            await notifyRentalStaff(NotificationEventCodes.RENTAL_RESERVATION_NEW, reservation, ctx);
        }

        let payment: RentalBookingResponse["data"]["payment"];
        if (reservation.status === "held" && reservation.paymentChoice === "online") {
            const {clientSecret} = await startOnlinePayment(reservation, ctx);
            payment = {clientSecret, publishableKey: PAYMENTS.STRIPE_PUBLISHABLE_KEY};
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
    }),
);

/** The guest "manage your booking" page. */
router.post(
    "/manage",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 30, failClosed: true}),
    validateFormZod(manageRentalFormSchema),
    asyncHandler(async (params: PublicParams<ManageRentalFormType>): Promise<PublicRentalReservationResponse> => {
        const {origin, languageCode, token} = params;
        const company = await resolveCompanyByOrigin(origin, languageCode);
        return {data: await publicReservation(await reservationFromLink(token, company, languageCode))};
    }),
);

/** Guest cancellation, with the fee from the policy they booked under. The link stops working afterwards. */
router.post(
    "/manage/cancel",
    authMW("public"),
    rateLimiter({windowMs: 60000, max: 10, failClosed: true}),
    transactionHandler(),
    validateFormZod(manageRentalFormSchema),
    asyncHandler(async (params: TransactionRequiredParams & PublicParams<ManageRentalFormType>): Promise<PublicRentalReservationResponse> => {
        const {origin, languageCode, token, session, logger} = params;
        const company = await resolveCompanyByOrigin(origin, languageCode);
        const reservation = await reservationFromLink(token, company, languageCode, session);
        if (reservation.pickupAt <= new Date()) {
            throw apiValidationException("rental_reservation_invalid_status", "", null, languageCode);
        }
        await cancelRentalReservation(reservation, {by: "customer", reason: "cancelled_by_customer", applyFee: true}, {session, logger, languageCode});
        return {data: await publicReservation(reservation)};
    }),
);
