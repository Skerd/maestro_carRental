import {ObjectId} from "mongodb";
import {type NotificationEvent, notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";
import {NotificationImportance} from "@coreModule/database/schemas/notification/notification";
import {NotificationCategory} from "armonia/src/modules/core/api/user/private/notifications/notifications.enum";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

type RentalCode = (typeof NotificationEventCodes)[keyof typeof NotificationEventCodes];

type Alert = {description: string; content: Record<string, unknown>; importance: NotificationImportance};

const reservationAlert = (description: string, p: Record<string, unknown>): Alert => ({
    description,
    content: {reservationId: p.reservationId, number: p.number},
    importance: NotificationImportance.HIGH,
});
const vehicleAlert = (description: string, p: Record<string, unknown>): Alert => ({
    description,
    content: {vehicleId: p.vehicleId, plate: p.plate, recordId: p.recordId},
    importance: NotificationImportance.MEDIUM,
});

const ALERTS: Record<RentalCode, (payload: Record<string, unknown>) => Alert> = {
    [NotificationEventCodes.RENTAL_RESERVATION_NEW]: (p) => reservationAlert(`New rental booking ${p.number ?? ""} (${p.categoryName ?? ""})`, p),
    [NotificationEventCodes.RENTAL_RESERVATION_CANCELLED]: (p) => reservationAlert(`Rental booking ${p.number ?? ""} was cancelled by the customer`, p),
    [NotificationEventCodes.VEHICLE_INSURANCE_EXPIRING]: (p) =>
        vehicleAlert(`Insurance ${p.policyNumber ?? ""} (${p.insurer ?? ""}) of ${p.plate ?? ""} expires on ${p.expiresOn ?? ""}`, p),
    [NotificationEventCodes.VEHICLE_DOCUMENT_EXPIRING]: (p) => vehicleAlert(`${p.documentType ?? "Document"} of ${p.plate ?? ""} expires on ${p.expiresOn ?? ""}`, p),
    [NotificationEventCodes.VEHICLE_SERVICE_DUE]: (p) =>
        vehicleAlert(`${p.plate ?? ""} is due for service${p.dueOn ? ` by ${p.dueOn}` : ""}${p.dueKm ? ` or at ${p.dueKm} km` : ""}`, p),
};

function bindHandler(code: RentalCode): void {
    notificationEventBus.on(code, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        const {description, content, importance} = ALERTS[code](payload);
        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code,
                        description,
                        content,
                        importance,
                        category: NotificationCategory.SYSTEM,
                    },
                    {languageCode: (payload.languageCode as string) ?? "en-US"},
                );
            } catch (error) {
                console.error(`Failed to create ${code} notification for ${receiverId}:`, error);
            }
        }
    });
}

export function registerCarRentalNotificationHandlers(): void {
    for (const code of Object.values(NotificationEventCodes)) {
        bindHandler(code);
    }
}
