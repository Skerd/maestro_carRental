import * as path from "path";
import {PDFDocument} from "pdf-lib";
import type {Readable} from "stream";
import {loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";
import {getGridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";
import {PDF_COLORS, PDF_PAGE, PdfWriter, embedStandardFonts, pdfMoney} from "@coreModule/utilities/pdf/pdfWriter";
import {decimalToNumber, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {MoneyInput} from "armonia/src/modules/core/helpers/money";
import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

import {companyService} from "@coreModule/database/schemas/company/company.service";
import {currencyService} from "@coreModule/database/schemas/currency/currency.service";
import {carRentalConfigService} from "@carRentalModule/database/schemas/carRentalConfig/carRentalConfig.service";
import {vehicleDamageService} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage.service";
import {rentalExtraService} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.service";
import {mediaService} from "@coreModule/database/schemas/media/media.service";
const LOCALES_ROOT = path.join(__dirname, "static", "locales");
const SIGNATURE_BOX = {width: 220, height: 80};

async function readAll(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

function formatLocal(date: Date, timeZone: string, languageCode: string): string {
    return new Intl.DateTimeFormat(languageCode, {timeZone, dateStyle: "medium", timeStyle: "short"}).format(date);
}

/**
 * The rental agreement, built from the booking as it stands: parties, drivers, car,
 * dates, the car's condition at handover, prices, protection, terms and the
 * customer's signature. Generated on request, so it always matches the booking.
 */
export async function generateRentalAgreementPdf(reservation: IRentalReservation, languageCode: string): Promise<Buffer> {
    const loc = loadEmailStrings(["rentalAgreement"], languageCode, LOCALES_ROOT) as Record<string, string>;
    const companyId = nestedEntityToRef(reservation.company);
    const signatureId = reservation.agreement?.signature ? nestedEntityToRef(reservation.agreement.signature) : undefined;
    const [company, currency, config, damages, protection, signatureMedia] = await Promise.all([
        companyService.findById(companyId, {}, undefined, "name"),
        currencyService.findById(nestedEntityToRef(reservation.pricing.currency), {}, undefined, "abbreviation"),
        carRentalConfigService.findOne({company: companyId, deletedAt: null}, {}, undefined, "termsText"),
        vehicleDamageService.find({_id: {$in: reservation.handover?.acknowledgedDamages ?? []}}, {}, undefined, "area severity description"),
        rentalExtraService.findOne({_id: {$in: reservation.extras.map((line) => nestedEntityToRef(line.extra))}, kind: "protection"}, {}, undefined, "name excessAmount"),
        signatureId ? mediaService.findOne({_id: signatureId, company: companyId}, {}, undefined, "fileId mimeType") : null,
    ]);
    const money = (amount: MoneyInput) => pdfMoney(decimalToNumber(amount) ?? 0, currency?.abbreviation);
    const {timezone} = reservation.snapshot;
    const doc = await PDFDocument.create();
    const w = new PdfWriter(doc, await embedStandardFonts(doc));

    const heading = (text: string) => {
        w.gap(8);
        w.ensure(30);
        w.text(text, {size: 11, bold: true, color: PDF_COLORS.primary});
        w.gap(14);
    };
    const row = (label: string, value: string | undefined) => {
        if (!value) return;
        w.ensure(14);
        w.text(label, {size: 9, color: PDF_COLORS.muted});
        w.text(value, {x: PDF_PAGE.margin + 140, size: 9});
        w.gap(13);
    };

    w.text(company?.name ?? "", {size: 18, bold: true, color: PDF_COLORS.primary});
    w.gap(20);
    w.text(`${loc.title} ${reservation.number}`, {size: 12, bold: true});
    w.gap(16);

    heading(loc.renter);
    const {contact} = reservation;
    row(loc.name, `${contact.firstName} ${contact.lastName}`);
    row(loc.email, contact.email);
    row(loc.phone, contact.phone);

    heading(loc.drivers);
    for (const driver of reservation.drivers ?? []) {
        row(loc[`role.${driver.role}`], `${driver.firstName} ${driver.lastName} · ${loc.born} ${driver.birthDate}`);
        if (driver.licenseNumber) {
            row("", [driver.licenseNumber, driver.licenseCountry, driver.licenseExpiresAt ? `${loc.validUntil} ${driver.licenseExpiresAt}` : ""].filter(Boolean).join(" · "));
        }
    }

    heading(loc.vehicle);
    row(loc.category, reservation.snapshot.categoryName);
    row(loc.car, reservation.snapshot.vehicleLabel);
    row(loc.pickup, `${reservation.snapshot.pickupLocationName} · ${formatLocal(reservation.pickupAt, timezone, languageCode)}`);
    row(loc.return, `${reservation.snapshot.returnLocationName} · ${formatLocal(reservation.returnAt, timezone, languageCode)}`);
    if (reservation.handover) {
        row(loc.odometer, `${reservation.handover.odometerKm.toLocaleString(languageCode)} km`);
        row(loc.fuel, loc[`fuel.${reservation.handover.fuelLevel}`]);
    }
    row(loc.mileage, reservation.snapshot.mileagePolicy === "limited" && reservation.snapshot.includedKmPerDay
        ? loc.mileageLimited.replace("{km}", String(reservation.snapshot.includedKmPerDay)).replace("{price}", money(reservation.snapshot.extraKmPrice ?? 0))
        : loc.mileageUnlimited);

    heading(loc.existingDamage);
    if (!damages.length) w.paragraph(loc.noExistingDamage);
    for (const damage of damages) w.paragraph(`• ${loc[`area.${damage.area}`]} (${loc[`severity.${damage.severity}`]}): ${damage.description}`, 9, PDF_COLORS.text);

    heading(loc.charges);
    for (const line of reservation.pricing.lines) {
        w.ensure(14);
        w.text(line.quantity > 1 ? `${line.label} × ${line.quantity}` : line.label, {size: 9});
        w.text(money(line.total), {x: PDF_PAGE.width - PDF_PAGE.margin - 90, size: 9});
        w.gap(13);
    }
    w.rule();
    w.gap(12);
    w.text(loc.total, {size: 10, bold: true});
    w.text(money(reservation.pricing.grandTotal), {x: PDF_PAGE.width - PDF_PAGE.margin - 90, size: 10, bold: true});
    w.gap(14);
    if (reservation.pricing.vatRate > 0) row(`${loc.vat} (${reservation.pricing.vatRate}%)`, money(reservation.pricing.vatAmount));
    if ((decimalToNumber(reservation.pricing.depositAmount) ?? 0) > 0) row(loc.deposit, money(reservation.pricing.depositAmount));
    row(loc.protection, protection
        ? `${protection.name}${protection.excessAmount !== undefined ? ` · ${loc.excess} ${money(protection.excessAmount)}` : ""}`
        : loc.basicCover);

    if (config?.termsText) {
        heading(`${loc.terms}${reservation.agreement?.termsVersion ? ` (${reservation.agreement.termsVersion})` : ""}`);
        w.paragraph(config.termsText, 8);
    }

    heading(loc.signature);
    const signature = reservation.agreement?.signedAt && signatureMedia?.fileId
        ? await readAll(getGridFSStorage(languageCode, "media").downloadFile(String(signatureMedia.fileId)))
        : null;
    if (signature) {
        const image = signatureMedia!.mimeType === "image/jpeg" ? await doc.embedJpg(signature) : await doc.embedPng(signature);
        const scale = Math.min(SIGNATURE_BOX.width / image.width, SIGNATURE_BOX.height / image.height, 1);
        w.ensure(image.height * scale + 30);
        w.page.drawImage(image, {x: PDF_PAGE.margin, y: w.y - image.height * scale, width: image.width * scale, height: image.height * scale});
        w.gap(image.height * scale + 12);
        w.text(loc.signedBy.replace("{name}", reservation.agreement!.signerName ?? `${contact.firstName} ${contact.lastName}`)
            .replace("{date}", formatLocal(reservation.agreement!.signedAt!, timezone, languageCode)), {size: 9, color: PDF_COLORS.muted});
        w.gap(13);
    } else {
        w.paragraph(loc.notSigned);
    }

    return Buffer.from(await doc.save());
}
