import {KAFKA} from "@coreModule/environment";
import {emailTopicSpec, startKafkaTopicConsumers} from "@coreModule/kafka/kafkaConsumer";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";
import {CAR_RENTAL_KAFKA} from "@carRentalModule/environment";
import {sendRentalCustomerEmailEvent} from "@carRentalModule/utilities/emails/rentalCustomerEmailDispatch";
import {RENTAL_EMAIL_TOPIC_BY_KIND} from "./kafkaProducer";
import type {RentalCustomerEmailEvent} from "./types";

/** One consumer per customer email kind (D188), each on its own topic; the kafkaServer starts them. */
export async function startCarRentalKafkaConsumers(parentLogger?: serverLogger): Promise<void> {
    const log = getLogger("carRental_kafka_consumers", parentLogger);
    if (!KAFKA.ENABLED) {
        log.warn("Kafka is disabled; skipping car rental consumers.");
        return;
    }
    log.start("Starting car rental Kafka consumers");
    const specs = Object.values(RENTAL_EMAIL_TOPIC_BY_KIND).map((topicKey) =>
        emailTopicSpec(CAR_RENTAL_KAFKA, topicKey, (event) => sendRentalCustomerEmailEvent(event as RentalCustomerEmailEvent)));
    await startKafkaTopicConsumers(parentLogger, log, specs);
    log.finish("Car rental Kafka consumers startup pass complete");
}
