import {ObjectId} from "mongodb";
import {type NotificationEvent, notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";
import {NotificationImportance} from "@coreModule/database/schemas/notification/notification";
import {NotificationCategory} from "armonia/src/modules/core/api/user/private/notifications/notifications.enum";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";
import {getLogger} from "@coreModule/loggers/serverLog";

const logger = getLogger("carRental_notifications");

type RentalCode = (typeof NotificationEventCodes)[keyof typeof NotificationEventCodes];

/**
 * `params` fill the code's translated message (`notificationTypes.json`, D117); `variant` picks a message variant.
 * `description` stays the English fallback.
 */
type Alert = {description: string; params: Record<string, string | number>; content: Record<string, unknown>; importance: NotificationImportance};
type Params = Record<string, string | number>;

const text = (value: unknown): string => (value == null ? "" : String(value));

const reservationAlert = (description: string, p: Record<string, unknown>, params: Params): Alert => ({
    description,
    params,
    content: {reservationId: p.reservationId, number: p.number},
    importance: NotificationImportance.HIGH,
});
const vehicleAlert = (description: string, p: Record<string, unknown>, params: Params): Alert => ({
    description,
    params: {plate: text(p.plate), ...params},
    content: {vehicleId: p.vehicleId, plate: p.plate, recordId: p.recordId},
    importance: NotificationImportance.MEDIUM,
});

/** Service due by a date, a mileage or both. */
function serviceVariant(p: Record<string, unknown>): string | undefined {
    if (p.dueOn && p.dueKm) return "dateAndKm";
    if (p.dueOn) return "date";
    return p.dueKm ? "km" : undefined;
}

const withVariant = (params: Params, variant: unknown): Params => (variant ? {...params, variant: String(variant)} : params);

const ALERTS: Record<RentalCode, (payload: Record<string, unknown>) => Alert> = {
    [NotificationEventCodes.RENTAL_RESERVATION_NEW]: (p) =>
        reservationAlert(`New rental booking ${p.number ?? ""} (${p.categoryName ?? ""})`, p, {number: text(p.number), category: text(p.categoryName)}),
    [NotificationEventCodes.RENTAL_RESERVATION_CANCELLED]: (p) =>
        reservationAlert(`Rental booking ${p.number ?? ""} was cancelled by the customer`, p, {number: text(p.number)}),
    [NotificationEventCodes.VEHICLE_INSURANCE_EXPIRING]: (p) =>
        vehicleAlert(`Insurance ${p.policyNumber ?? ""} (${p.insurer ?? ""}) of ${p.plate ?? ""} expires on ${p.expiresOn ?? ""}`, p, {
            policy: text(p.policyNumber), insurer: text(p.insurer), expiresOn: text(p.expiresOn),
        }),
    // The document type picks the variant; `other` has none and reads "A document of …".
    [NotificationEventCodes.VEHICLE_DOCUMENT_EXPIRING]: (p) =>
        vehicleAlert(`${p.documentType ?? "Document"} of ${p.plate ?? ""} expires on ${p.expiresOn ?? ""}`, p, withVariant({expiresOn: text(p.expiresOn)}, p.documentType)),
    [NotificationEventCodes.VEHICLE_SERVICE_DUE]: (p) =>
        vehicleAlert(`${p.plate ?? ""} is due for service${p.dueOn ? ` by ${p.dueOn}` : ""}${p.dueKm ? ` or at ${p.dueKm} km` : ""}`, p,
            withVariant({dueOn: text(p.dueOn), dueKm: text(p.dueKm)}, serviceVariant(p))),
    [NotificationEventCodes.VEHICLE_INSURANCE_EXPIRED]: (p) =>
        vehicleAlert(`Insurance ${p.policyNumber ?? ""} of ${p.plate ?? ""} has expired with no renewal: the car cannot be handed over`, p, {policy: text(p.policyNumber)}),
    [NotificationEventCodes.VEHICLE_DOCUMENT_EXPIRED]: (p) =>
        vehicleAlert(`${p.documentType ?? "Document"} of ${p.plate ?? ""} has expired with no renewal`, p, withVariant({}, p.documentType)),
    [NotificationEventCodes.VEHICLE_DAMAGE_REPORTED]: (p) =>
        vehicleAlert(`New ${p.severity ?? ""} damage (${p.area ?? ""}) reported on ${p.plate ?? ""}`, p, withVariant({}, p.severity)),
    [NotificationEventCodes.VEHICLE_FINE_DUE]: (p) =>
        vehicleAlert(`Fine ${p.reference ?? ""} (${p.authority ?? ""}) of ${p.plate ?? ""} is due on ${p.dueOn ?? ""} and not paid`, p, {
            reference: text(p.reference), authority: text(p.authority), dueOn: text(p.dueOn),
        }),
};

function bindHandler(code: RentalCode): void {
    notificationEventBus.on(code, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const {description, params, content, importance} = ALERTS[code](payload);
        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code,
                        description,
                        params,
                        content,
                        importance,
                        category: NotificationCategory.SYSTEM,
                    },
                    {languageCode: (payload.languageCode as string) ?? "en-US"},
                );
            } catch (error) {
                logger.err(`Failed to create ${code} notification for ${receiverId}:`, error);
            }
        }
    });
}

export function registerCarRentalNotificationHandlers(): void {
    for (const code of Object.values(NotificationEventCodes)) {
        bindHandler(code);
    }
}
