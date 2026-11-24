import {kafkaTopicErrors, type ModuleEnvironmentContext, type ValidationError} from "@coreModule/environment/validator";
import {CAR_RENTAL_KAFKA} from "@carRentalModule/environment";

/** carRental's boot checks (D67): the customer-email Kafka topics, while Kafka is on (D188). */
export function validateEnvironment(ctx: ModuleEnvironmentContext): ValidationError[] {
    return kafkaTopicErrors(ctx, CAR_RENTAL_KAFKA);
}
