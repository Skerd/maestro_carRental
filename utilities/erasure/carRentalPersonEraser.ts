import {
    ERASED_EMAIL,
    ERASED_FIRST_NAME,
    ERASED_LAST_NAME,
    ERASED_NAME,
    ERASED_PHONE,
    objectIds as ids,
    registerPersonEraser,
    type ErasureContext,
    type ErasureCount,
} from "@coreModule/utilities/erasure/personErasure";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import {rentalReviewService} from "@carRentalModule/database/schemas/rentalReview/rentalReview.service";
import {vehicleFineService} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine.service";


/**
 * A rental company's records of one person (D57): reservations stay for their amounts and payments, anonymised;
 * drivers' licences, IDs and scans and the signature are deleted for good, and the saved card can no longer be
 * charged. Reviews keep their rating under an erased name; fines lose the driver's name. The deny list is the
 * company's own protection and is left as it is.
 */
async function eraseCarRentalPerson(ctx: ErasureContext): Promise<ErasureCount[]> {
    const {companyId, subject, preview, session} = ctx;
    const found = {session, withDeleted: true};

    const reservations = await rentalReservationService.find({
        company: companyId,
        $or: [{customer: {$in: subject.accountIds}}, {"contact.email": {$in: subject.emails}}],
    }, found); // whole documents: code reading them is not a person opening the licences (no READ audit)
    const reservationIds = ids(reservations);
    const reviews = reservationIds.length > 0 ? await rentalReviewService.find({company: companyId, reservation: {$in: reservationIds}}, found, undefined, "_id") : [];
    const fines = reservationIds.length > 0 ? await vehicleFineService.find({company: companyId, reservation: {$in: reservationIds}, driverName: {$exists: true}}, found, undefined, "_id") : [];

    ctx.deleteMedia([
        ...reservations.flatMap((reservation) => (reservation.drivers ?? []).flatMap((driver) => ids(driver.documents))),
        ...reservations.flatMap((reservation) => ids([reservation.agreement?.signature])),
    ]);
    const counts: ErasureCount[] = [
        {collection: "rentalreservations", anonymised: reservations.length, deleted: 0},
        {collection: "rentalreviews", anonymised: reviews.length, deleted: 0},
        {collection: "vehiclefines", anonymised: fines.length, deleted: 0},
    ];
    if (preview || reservationIds.length === 0) return counts;

    const scope = {company: companyId, _id: {$in: reservationIds}};
    await rentalReservationService.eraseFields(scope, {
        $set: {"contact.firstName": ERASED_FIRST_NAME, "contact.lastName": ERASED_LAST_NAME, "contact.email": ERASED_EMAIL, "contact.phone": ERASED_PHONE},
        $unset: {drivers: "", customer: "", notes: "", "agreement.signature": "", "deposit.stripeCustomerId": "", "deposit.paymentMethodId": ""},
    }, {session});
    await rentalReservationService.eraseFields({...scope, "agreement.signerName": {$exists: true}}, {$set: {"agreement.signerName": ERASED_NAME}}, {session});
    ctx.scrubAudit("rentalreservations", reservationIds, ["contact", "drivers", "customer", "notes", "agreement", "deposit"]);

    if (reviews.length > 0) {
        await rentalReviewService.eraseFields({company: companyId, _id: {$in: ids(reviews)}}, {$set: {authorName: ERASED_NAME}}, {session});
        ctx.scrubAudit("rentalreviews", ids(reviews), ["authorName"]);
    }
    if (fines.length > 0) {
        await vehicleFineService.eraseFields({company: companyId, _id: {$in: ids(fines)}}, {$unset: {driverName: ""}}, {session});
        ctx.scrubAudit("vehiclefines", ids(fines), ["driverName"]);
    }
    return counts;
}

export function registerCarRentalPersonErasers(): void {
    registerPersonEraser({module: "carRental", erase: eraseCarRentalPerson});
}
