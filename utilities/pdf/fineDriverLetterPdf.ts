import * as path from "path";
import {PDFDocument} from "pdf-lib";
import {loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {PDF_COLORS, PDF_PAGE, PdfWriter, embedStandardFonts} from "@coreModule/utilities/pdf/pdfWriter";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {IVehicleFine} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";

import {companyService} from "@coreModule/database/schemas/company/company.service";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
const LOCALES_ROOT = path.join(__dirname, "static", "locales");

function formatLocal(date: Date, timeZone: string, languageCode: string): string {
    return new Intl.DateTimeFormat(languageCode, {timeZone, dateStyle: "medium", timeStyle: "short"}).format(date);
}

/**
 * The letter that names the driver to the authority that issued a fine: who had
 * the car at the time of the offence, with their licence, and the rental period.
 */
export async function generateFineDriverLetterPdf(fine: IVehicleFine, languageCode: string): Promise<Buffer> {
    const loc = loadEmailStrings(["fineDriverLetter"], languageCode, LOCALES_ROOT) as Record<string, string>;
    const companyId = nestedEntityToRef(fine.company);
    const [company, vehicle, reservation] = await Promise.all([
        companyService.findById(companyId, {}, undefined, "name"),
        vehicleService.findById(nestedEntityToRef(fine.vehicle), {}, undefined, "plate make model"),
        fine.reservation ? rentalReservationService.findOne({_id: nestedEntityToRef(fine.reservation), company: companyId}, {}) : null,
    ]);
    const timeZone = reservation?.snapshot.timezone ?? "UTC";
    const doc = await PDFDocument.create();
    const w = new PdfWriter(doc, await embedStandardFonts(doc));
    const row = (label: string, value: string | undefined) => {
        if (!value) return;
        w.ensure(14);
        w.text(label, {size: 9, color: PDF_COLORS.muted});
        w.text(value, {x: PDF_PAGE.margin + 150, size: 9});
        w.gap(13);
    };

    w.text(company?.name ?? "", {size: 16, bold: true, color: PDF_COLORS.primary});
    w.gap(28);
    w.text(fine.authority, {size: 10});
    w.gap(24);
    w.text(loc.subject.replace("{reference}", fine.reference), {size: 12, bold: true});
    w.gap(20);
    w.paragraph(loc.intro, 10, PDF_COLORS.text);
    w.gap(8);

    row(loc.reference, fine.reference);
    row(loc.offenceAt, formatLocal(fine.offenceAt, timeZone, languageCode));
    row(loc.place, fine.place);
    row(loc.vehicle, vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` : undefined);
    w.gap(10);

    const driver = reservation?.drivers?.find((entry) => entry.role === "primary");
    if (reservation) {
        w.text(loc.driverTitle, {size: 11, bold: true, color: PDF_COLORS.primary});
        w.gap(16);
        const name = driver ? `${driver.firstName} ${driver.lastName}` : `${reservation.contact.firstName} ${reservation.contact.lastName}`;
        row(loc.name, name);
        row(loc.birthDate, driver?.birthDate);
        row(loc.licence, driver?.licenseNumber ? [driver.licenseNumber, driver.licenseCountry].filter(Boolean).join(" · ") : undefined);
        row(loc.email, reservation.contact.email);
        row(loc.phone, reservation.contact.phone);
        row(loc.booking, reservation.number);
        row(loc.period, `${formatLocal(reservation.handover?.at ?? reservation.pickupAt, timeZone, languageCode)} – ${formatLocal(reservation.returnInfo?.at ?? reservation.returnAt, timeZone, languageCode)}`);
    } else {
        w.paragraph(loc.noBooking, 10, PDF_COLORS.text);
    }
    w.gap(16);
    w.paragraph(loc.declaration, 10, PDF_COLORS.text);
    w.gap(30);
    w.text(`${loc.date}: ${new Intl.DateTimeFormat(languageCode, {dateStyle: "long"}).format(new Date())}`, {size: 9});
    w.gap(36);
    w.text(company?.name ?? "", {size: 9, bold: true});

    return Buffer.from(await doc.save());
}
