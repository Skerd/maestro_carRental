import type {IRentalReservation, IRentalVehicleCheck} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import type {RentalReservation} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.dto";
import type {PublicRentalReservation} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.response.types";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import type {RentalExtraSimple} from "armonia/src/modules/carRental/dto/rentalExtra.dto";
import {dateToISOString, decimalToNumber, mapMedia, mapSnippet, nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {amountDue, onlinePaymentAvailable} from "@carRentalModule/utilities/services/rentalPayments";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {VehicleCategorySimpleSnippet} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.snippets";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import {RentalLocationSimpleSnippet} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.snippets";
import {RentalExtraSimpleSnippet} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {freeCancellationUntil} from "@carRentalModule/workflows/rentalLifecycle";

const optionalIso = (date: Date | undefined) => (date ? dateToISOString(date) : undefined);

// Subdocuments are copied field by field: spreading one would copy Mongoose's internal state.
function contactToDTO({firstName, lastName, email, phone}: IRentalReservation["contact"]) {
    return {firstName, lastName, email, phone};
}

function driversToDTO(drivers: IRentalReservation["drivers"]) {
    return (drivers ?? []).map(({role, firstName, lastName, birthDate, licenseNumber, licenseCountry, licenseIssuedAt, licenseExpiresAt, idDocumentType, idDocumentNumber}) => (
        {role, firstName, lastName, birthDate, licenseNumber, licenseCountry, licenseIssuedAt, licenseExpiresAt, idDocumentType, idDocumentNumber}
    ));
}

function snapshotToDTO(snapshot: IRentalReservation["snapshot"]) {
    const {categoryName, vehicleTitle, vehicleLabel, pickupLocationName, pickupAddress, returnLocationName, returnAddress, timezone, mileagePolicy, includedKmPerDay, extraKmPrice} = snapshot;
    return {categoryName, vehicleTitle, vehicleLabel, pickupLocationName, pickupAddress, returnLocationName, returnAddress, timezone, mileagePolicy, includedKmPerDay, extraKmPrice};
}

function vehicleCheck(check: IRentalVehicleCheck | undefined) {
    if (!check) return undefined;
    return {
        at: dateToISOString(check.at),
        by: mapSnippet<SimpleBlankUser>()(check.by, SimpleBlankUserSnippet),
        odometerKm: check.odometerKm,
        fuelLevel: check.fuelLevel,
        notes: check.notes,
        photos: check.photos?.length ? check.photos.map(mapMedia).filter((media) => media !== undefined) : undefined,
    };
}

function agreementToDTO(agreement: IRentalReservation["agreement"]) {
    if (!agreement) return undefined;
    return {
        signedAt: agreement.signedAt ? dateToISOString(agreement.signedAt) : undefined,
        signerName: agreement.signerName,
        signature: agreement.signature ? mapMedia(agreement.signature) : undefined,
        termsVersion: agreement.termsVersion,
    };
}

function pricingToDTO(reservation: IRentalReservation) {
    const {pricing} = reservation;
    const currency = mapSnippet<CurrencySimple>()(pricing.currency, CurrencySimpleSnippet);
    return {
        rentalDays: pricing.rentalDays,
        currency,
        lines: pricing.lines.map(({label, kind, code, quantity, unitPrice, total}) => ({
            label,
            kind,
            code,
            quantity,
            unitPrice: decimalToNumber(unitPrice) ?? 0,
            total: decimalToNumber(total) ?? 0,
            // Each line names the booking's currency so the sheet shows "€ 45.00", not "45" (UX-07).
            currency,
        })),
        subtotal: decimalToNumber(pricing.subtotal) ?? 0,
        vatRate: pricing.vatRate,
        vatAmount: decimalToNumber(pricing.vatAmount) ?? 0,
        pricesIncludeVat: pricing.pricesIncludeVat,
        grandTotal: decimalToNumber(pricing.grandTotal) ?? 0,
        depositAmount: decimalToNumber(pricing.depositAmount) ?? 0,
    };
}

export function rentalReservationToDTO(reservation: IRentalReservation): RentalReservation {
    return {
        _id: reservation._id.toString(),
        number: reservation.number,
        status: reservation.status,
        source: reservation.source,
        category: mapSnippet<VehicleCategorySimple>()(reservation.category, VehicleCategorySimpleSnippet),
        vehicle: mapSnippet<VehicleSimple>()(reservation.vehicle, VehicleSimpleSnippet),
        exactVehicle: reservation.exactVehicle === true,
        pickupLocation: mapSnippet<RentalLocationSimple>()(reservation.pickupLocation, RentalLocationSimpleSnippet),
        returnLocation: mapSnippet<RentalLocationSimple>()(reservation.returnLocation, RentalLocationSimpleSnippet),
        pickupAt: dateToISOString(reservation.pickupAt),
        returnAt: dateToISOString(reservation.returnAt),
        holdExpiresAt: optionalIso(reservation.holdExpiresAt),
        customer: mapSnippet<SimpleBlankUser>()(reservation.customer, SimpleBlankUserSnippet),
        contact: contactToDTO(reservation.contact),
        drivers: driversToDTO(reservation.drivers),
        promoCode: reservation.promoCode ? {code: reservation.promoCode.code} : undefined,
        extras: (reservation.extras ?? []).map((line) => ({
            extra: mapSnippet<RentalExtraSimple>()(line.extra, RentalExtraSimpleSnippet),
            name: line.name,
            pricing: line.pricing,
            unitPrice: decimalToNumber(line.unitPrice) ?? 0,
            quantity: line.quantity,
            total: decimalToNumber(line.total) ?? 0,
        })),
        pricing: pricingToDTO(reservation),
        snapshot: snapshotToDTO(reservation.snapshot),
        policy: {
            freeCancellationHours: reservation.policy.freeCancellationHours,
            cancellationFeePercent: reservation.policy.cancellationFeePercent,
            termsVersion: reservation.policy.termsVersion,
        },
        paymentChoice: reservation.paymentChoice,
        paymentStatus: reservation.paymentStatus,
        amountPaid: decimalToNumber(reservation.amountPaid) ?? 0,
        notes: reservation.notes,
        handover: reservation.handover
            ? {...vehicleCheck(reservation.handover)!, acknowledgedDamages: (reservation.handover.acknowledgedDamages ?? []).map(String)}
            : undefined,
        returnInfo: reservation.returnInfo ? {...vehicleCheck(reservation.returnInfo)!, damageNoted: reservation.returnInfo.damageNoted} : undefined,
        agreement: agreementToDTO(reservation.agreement),
        needsTransfer: reservation.needsTransfer ?? false,
        deposit: reservation.deposit
            ? {
                method: reservation.deposit.method,
                status: reservation.deposit.status,
                amount: decimalToNumber(reservation.deposit.amount) ?? 0,
                capturedAmount: decimalToNumber(reservation.deposit.capturedAmount) ?? 0,
                hasSavedCard: !!reservation.deposit.paymentMethodId,
                heldAt: optionalIso(reservation.deposit.heldAt),
                settledAt: optionalIso(reservation.deposit.settledAt),
            }
            : undefined,
        timeline: (reservation.timeline ?? []).map(({event, at, note}) => ({event, at: dateToISOString(at), note})),
        cancelledAt: optionalIso(reservation.cancelledAt),
        cancelledBy: reservation.cancelledBy,
        cancellationReason: reservation.cancellationReason,
        ...mapSoftDeleteToDTO(reservation),
        ...mapOwnershipToDTO(reservation),
        ...mapLifeCycleToDTO(reservation),
    };
}

export function rentalReservationsToDTO(reservations: IRentalReservation[]): RentalReservation[] {
    return reservations.map(rentalReservationToDTO);
}

/**
 * What the customer sees: their own booking without staff data (vehicle id,
 * internal notes, timeline, who did what). `pricing.currency` must be populated.
 */
function primaryDriver(reservation: IRentalReservation): PublicRentalReservation["driver"] {
    const driver = reservation.drivers.find((row) => row.role === "primary") ?? reservation.drivers[0];
    if (!driver) return undefined;
    return {
        licenseNumber: driver.licenseNumber,
        licenseCountry: driver.licenseCountry,
        licenseIssuedAt: driver.licenseIssuedAt,
        licenseExpiresAt: driver.licenseExpiresAt,
        idDocumentType: driver.idDocumentType,
        idDocumentNumber: driver.idDocumentNumber,
        documents: driver.documents?.length ?? 0,
    };
}

export function rentalReservationToPublic(reservation: IRentalReservation, now = new Date()): PublicRentalReservation {
    return {
        _id: reservation._id.toString(),
        number: reservation.number,
        status: reservation.status,
        categoryName: reservation.snapshot.categoryName,
        exactVehicle: reservation.exactVehicle === true,
        vehicleTitle: reservation.snapshot.vehicleTitle,
        vehicleLabel: reservation.snapshot.vehicleLabel,
        pickupLocationName: reservation.snapshot.pickupLocationName,
        pickupAddress: reservation.snapshot.pickupAddress,
        returnLocationName: reservation.snapshot.returnLocationName,
        returnAddress: reservation.snapshot.returnAddress,
        timezone: reservation.snapshot.timezone,
        pickupAt: dateToISOString(reservation.pickupAt),
        returnAt: dateToISOString(reservation.returnAt),
        holdExpiresAt: optionalIso(reservation.holdExpiresAt),
        contact: contactToDTO(reservation.contact),
        pricing: pricingToDTO(reservation),
        extras: reservation.extras.map(({extra, name, quantity, total}) => ({extraId: String(nestedEntityToRef(extra)), name, quantity, total: decimalToNumber(total) ?? 0})),
        paymentChoice: reservation.paymentChoice,
        paymentStatus: reservation.paymentStatus,
        amountPaid: decimalToNumber(reservation.amountPaid) ?? 0,
        amountDue: amountDue(reservation),
        freeCancellationUntil: dateToISOString(freeCancellationUntil(reservation)),
        cancellationFeePercent: reservation.policy.cancellationFeePercent,
        canCancel: (reservation.status === "held" || reservation.status === "confirmed") && reservation.pickupAt > now,
        canExtend: reservation.status === "confirmed" || reservation.status === "in_progress",
        canAddExtras: (reservation.status === "held" || reservation.status === "confirmed") && reservation.pickupAt > now,
        // Only by card online; while card payments are coming soon (D190) what is due is paid at the desk.
        canPayBalance: onlinePaymentAvailable() && amountDue(reservation) > 0 && reservation.status !== "cancelled" && reservation.status !== "expired",
        canUploadDocuments: reservation.status === "held" || reservation.status === "confirmed",
        canReview: reservation.status === "completed",
        hasAgreement: Boolean(reservation.handover),
        crossBorder: reservation.crossBorder === true,
        driver: primaryDriver(reservation),
        invoices: [],
    };
}
