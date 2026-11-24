import {emailEventType, publishEvent} from "@coreModule/kafka/kafkaProducer";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {CAR_RENTAL_KAFKA} from "@carRentalModule/environment";
import type {RentalCustomerEmailKind} from "@carRentalModule/utilities/emails/sendRentalCustomerMail";
import type {RentalCustomerEmailEvent} from "./types";

/** Each customer email kind's own topic (D188). */
export const RENTAL_EMAIL_TOPIC_BY_KIND: Record<RentalCustomerEmailKind, keyof typeof CAR_RENTAL_KAFKA.TOPICS> = {
    confirmed: "RENTAL_CONFIRMED_EMAIL",
    cancelled: "RENTAL_CANCELLED_EMAIL",
    reminder: "RENTAL_REMINDER_EMAIL",
    handedOver: "RENTAL_HANDED_OVER_EMAIL",
    returned: "RENTAL_RETURNED_EMAIL",
    charged: "RENTAL_CHARGED_EMAIL",
};

/** The `eventType` a kind's topic carries. */
export function rentalEmailEventType(kind: RentalCustomerEmailKind): string {
    return emailEventType(RENTAL_EMAIL_TOPIC_BY_KIND[kind]);
}

/**
 * Publishes a customer email on its kind's topic, keyed by the booking so its emails keep their order.
 * @returns false when not published (see core `publishEvent`); the caller then sends it directly
 */
export function publishRentalCustomerEmail(event: RentalCustomerEmailEvent, log?: serverLogger): Promise<boolean> {
    return publishEvent(CAR_RENTAL_KAFKA.TOPICS[RENTAL_EMAIL_TOPIC_BY_KIND[event.kind]], event.rentalReservationId, event, log);
}
