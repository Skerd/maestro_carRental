import type {RentalCustomerEmail} from "@carRentalModule/utilities/emails/sendRentalCustomerMail";

/**
 * A customer email about a rental, on its kind's own topic (D188). Everything is already formatted for the email;
 * attachments travel as ids and are built only when the email is sent.
 */
export interface RentalCustomerEmailEvent extends Omit<RentalCustomerEmail, "attachments"> {
    eventType: string;
    timestamp: number;
    rentalReservationId: string;
    /** Attach the rental agreement PDF (hand-over). */
    withAgreement?: boolean;
    /** Attach this invoice's PDF (return, later charges). */
    invoiceId?: string;
}
