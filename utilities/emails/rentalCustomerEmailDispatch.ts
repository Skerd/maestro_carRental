import {ObjectId} from "mongodb";
import type {serverLogger} from "@coreModule/loggers/serverLog";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {generateRentalAgreementPdf} from "@carRentalModule/utilities/pdf/rentalAgreementPdf";
import {invoiceAttachment} from "@carRentalModule/utilities/services/rentalInvoices";
import {sendRentalCustomerMail, type RentalCustomerEmail} from "@carRentalModule/utilities/emails/sendRentalCustomerMail";
import {publishRentalCustomerEmail} from "@carRentalModule/kafka/kafkaProducer";
import type {RentalCustomerEmailEvent} from "@carRentalModule/kafka/types";

/** The PDFs an email carries, built from the ids in its event when it is really sent. */
function attachmentsOf(event: RentalCustomerEmailEvent): RentalCustomerEmail["attachments"] {
    if (event.invoiceId) return invoiceAttachment(new ObjectId(event.invoiceId), event.languageCode);
    if (!event.withAgreement) return undefined;
    return async () => {
        const reservation = await rentalReservationService.findById(new ObjectId(event.rentalReservationId), {});
        return reservation ? [{filename: `${reservation.number}.pdf`, content: await generateRentalAgreementPdf(reservation, event.languageCode)}] : [];
    };
}

/** Sends a customer email from its event: what the consumer runs, and the fallback when it is not published. */
export async function sendRentalCustomerEmailEvent(event: RentalCustomerEmailEvent): Promise<void> {
    await sendRentalCustomerMail({...event, attachments: attachmentsOf(event)});
}

/**
 * Hands a customer email to its kind's Kafka topic, so it survives a restart and is retried (D188); sends it directly
 * when Kafka is off or the publish fails.
 */
export async function dispatchRentalCustomerEmail(event: RentalCustomerEmailEvent, log?: serverLogger): Promise<void> {
    if (!(await publishRentalCustomerEmail(event, log))) await sendRentalCustomerEmailEvent(event);
}
