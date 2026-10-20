import {ObjectId} from "mongodb";
import {type NotificationEvent, notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";
import {NotificationImportance} from "@coreModule/database/schemas/notification/notification";
import {NotificationCategory} from "armonia/src/modules/core/api/user/private/notifications/notifications.enum";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

type RentalCode = (typeof NotificationEventCodes)[keyof typeof NotificationEventCodes];

const DESCRIPTIONS: Record<RentalCode, (payload: Record<string, unknown>) => string> = {
    [NotificationEventCodes.RENTAL_RESERVATION_NEW]: (p) => `New rental booking ${p.number ?? ""} (${p.categoryName ?? ""})`,
    [NotificationEventCodes.RENTAL_RESERVATION_CANCELLED]: (p) => `Rental booking ${p.number ?? ""} was cancelled by the customer`,
};

function bindHandler(code: RentalCode): void {
    notificationEventBus.on(code, async (event: NotificationEvent) => {
        const {receiverIds, payload} = event;
        for (const receiverId of receiverIds) {
            try {
                await createAndPushNotification(
                    {
                        receiver: new ObjectId(receiverId),
                        company: new ObjectId(payload.companyId as string),
                        code,
                        description: DESCRIPTIONS[code](payload),
                        content: {reservationId: payload.reservationId, number: payload.number},
                        importance: NotificationImportance.HIGH,
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
    bindHandler(NotificationEventCodes.RENTAL_RESERVATION_NEW);
    bindHandler(NotificationEventCodes.RENTAL_RESERVATION_CANCELLED);
}
