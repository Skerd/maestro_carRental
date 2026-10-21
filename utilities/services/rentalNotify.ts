import type {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import Company from "@coreModule/database/schemas/company/company";
import Currency from "@coreModule/database/schemas/currency/currency";
import {emitNotificationEvent} from "@coreModule/domain/notifications/notificationEventBus";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {runAfterCommit} from "@coreModule/utilities/middlewares/transactionUtils";
import {generateRecordAccessToken} from "@coreModule/utilities/security/recordAccessToken";
import {RENTAL_RESERVATION_LINK_PURPOSE} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";
import {sendRentalCustomerMail, type RentalCustomerEmailKind} from "@carRentalModule/utilities/emails/sendRentalCustomerMail";

function formatLocal(date: Date, timeZone: string, languageCode: string): string {
    return new Intl.DateTimeFormat(languageCode, {timeZone, dateStyle: "medium", timeStyle: "short"}).format(date);
}

async function formatTotal(reservation: IRentalReservation, languageCode: string): Promise<string> {
    const currency = await Currency.findById(nestedEntityToRef(reservation.pricing.currency)).select("abbreviation");
    try {
        return new Intl.NumberFormat(languageCode, {style: "currency", currency: currency?.abbreviation ?? "EUR"}).format(reservation.pricing.grandTotal);
    } catch {
        return `${reservation.pricing.grandTotal} ${currency?.abbreviation ?? ""}`.trim();
    }
}

/**
 * Emails the customer about their booking once the caller's transaction has
 * committed (right away without one). Uses the booking's contact email, which
 * a guest gave and a signed-in customer confirmed, with a fresh manage link.
 */
export async function notifyRentalCustomer(
    kind: RentalCustomerEmailKind,
    reservation: IRentalReservation,
    ctx: {session?: ClientSession | null; languageCode: string},
): Promise<void> {
    await runAfterCommit(ctx.session, async () => {
        const companyId = nestedEntityToRef(reservation.company);
        const company = await Company.findById(companyId).select("name");
        const {snapshot, contact} = reservation;
        await sendRentalCustomerMail({
            kind,
            companyId: String(companyId),
            companyName: company?.name ?? "",
            languageCode: ctx.languageCode,
            email: contact.email,
            fullName: `${contact.firstName} ${contact.lastName}`.trim(),
            number: reservation.number,
            categoryName: snapshot.categoryName,
            pickupAt: formatLocal(reservation.pickupAt, snapshot.timezone, ctx.languageCode),
            pickupLocation: [snapshot.pickupLocationName, snapshot.pickupAddress].filter(Boolean).join(", "),
            returnAt: formatLocal(reservation.returnAt, snapshot.timezone, ctx.languageCode),
            returnLocation: [snapshot.returnLocationName, snapshot.returnAddress].filter(Boolean).join(", "),
            total: await formatTotal(reservation, ctx.languageCode),
            manageToken: generateRecordAccessToken({
                purpose: RENTAL_RESERVATION_LINK_PURPOSE,
                companyId: companyId,
                recordId: reservation._id,
                version: reservation.manageTokenVersion,
            }),
        });
    });
}

type RentalNotificationCode = (typeof NotificationEventCodes)[keyof typeof NotificationEventCodes];

/** The staff listed in the rental settings to alert. */
async function staffReceiverIds(companyId: ObjectId, languageCode: string): Promise<string[]> {
    const config = await carRentalConfigService.findForCompany(companyId, {languageCode});
    return (config?.notifyUsers ?? []).map((user) => String(nestedEntityToRef(user)));
}

/** In-app alert to the staff listed in the rental settings. */
export async function notifyRentalStaff(
    code: RentalNotificationCode,
    reservation: IRentalReservation,
    ctx: {session?: ClientSession | null; languageCode: string},
): Promise<void> {
    const companyId = nestedEntityToRef(reservation.company);
    const receiverIds = await staffReceiverIds(companyId, ctx.languageCode);
    if (!receiverIds.length) return;
    await runAfterCommit(ctx.session, async () => {
        emitNotificationEvent(code, {
            receiverIds,
            payload: {
                companyId: String(companyId),
                languageCode: ctx.languageCode,
                reservationId: reservation._id.toString(),
                number: reservation.number,
                categoryName: reservation.snapshot.categoryName,
            },
        });
    });
}

/** In-app alert about a vehicle (expiring paperwork, service due) to the rental staff. Emits right away. */
export async function notifyFleetStaff(
    code: RentalNotificationCode,
    companyId: ObjectId,
    payload: Record<string, unknown>,
    languageCode: string,
): Promise<void> {
    const receiverIds = await staffReceiverIds(companyId, languageCode);
    if (!receiverIds.length) return;
    emitNotificationEvent(code, {receiverIds, payload: {companyId: String(companyId), languageCode, ...payload}});
}
