import type {IRentalReservation} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import type {RentalReservation} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.dto";
import type {PublicRentalReservation} from "armonia/src/modules/carRental/api/carRental/public/rentalStorefront/rentalStorefront.response.types";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {SimpleBlankUser} from "armonia/src/modules/core/dto/user.dto";
import type {VehicleCategorySimple} from "armonia/src/modules/carRental/dto/vehicleCategory.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import type {RentalLocationSimple} from "armonia/src/modules/carRental/dto/rentalLocation.dto";
import type {RentalExtraSimple} from "armonia/src/modules/carRental/dto/rentalExtra.dto";
import {dateToISOString, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {CurrencySimpleSnippet} from "@coreModule/database/schemas/currency/currency.snippets";
import {SimpleBlankUserSnippet} from "@coreModule/database/schemas/user/user.snippets";
import {VehicleCategorySimpleSnippet} from "@carRentalModule/database/schemas/vehicleCategory/vehicleCategory.snippets";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import {RentalLocationSimpleSnippet} from "@carRentalModule/database/schemas/rentalLocation/rentalLocation.snippets";
import {RentalExtraSimpleSnippet} from "@carRentalModule/database/schemas/rentalExtra/rentalExtra.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";
import {freeCancellationUntil} from "@carRentalModule/utilities/services/rentalLifecycle";

const optionalIso = (date: Date | undefined) => (date ? dateToISOString(date) : undefined);

// Subdocuments are copied field by field: spreading one would copy Mongoose's internal state.
function contactToDTO({firstName, lastName, email, phone}: IRentalReservation["contact"]) {
    return {firstName, lastName, email, phone};
}

function snapshotToDTO(snapshot: IRentalReservation["snapshot"]) {
    const {categoryName, vehicleLabel, pickupLocationName, pickupAddress, returnLocationName, returnAddress, timezone, mileagePolicy, includedKmPerDay, extraKmPrice} = snapshot;
    return {categoryName, vehicleLabel, pickupLocationName, pickupAddress, returnLocationName, returnAddress, timezone, mileagePolicy, includedKmPerDay, extraKmPrice};
}

function vehicleCheck(check: IRentalReservation["handover"]) {
    if (!check) return undefined;
    return {
        at: dateToISOString(check.at),
        by: mapSnippet<SimpleBlankUser>()(check.by, SimpleBlankUserSnippet),
        odometerKm: check.odometerKm,
        fuelLevel: check.fuelLevel,
        notes: check.notes,
    };
}

function pricingToDTO(reservation: IRentalReservation) {
    const {pricing} = reservation;
    return {
        rentalDays: pricing.rentalDays,
        currency: mapSnippet<CurrencySimple>()(pricing.currency, CurrencySimpleSnippet),
        lines: pricing.lines.map(({label, kind, quantity, unitPrice, total}) => ({label, kind, quantity, unitPrice, total})),
        subtotal: pricing.subtotal,
        vatRate: pricing.vatRate,
        vatAmount: pricing.vatAmount,
        pricesIncludeVat: pricing.pricesIncludeVat,
        grandTotal: pricing.grandTotal,
        depositAmount: pricing.depositAmount,
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
        pickupLocation: mapSnippet<RentalLocationSimple>()(reservation.pickupLocation, RentalLocationSimpleSnippet),
        returnLocation: mapSnippet<RentalLocationSimple>()(reservation.returnLocation, RentalLocationSimpleSnippet),
        pickupAt: dateToISOString(reservation.pickupAt),
        returnAt: dateToISOString(reservation.returnAt),
        holdExpiresAt: optionalIso(reservation.holdExpiresAt),
        customer: mapSnippet<SimpleBlankUser>()(reservation.customer, SimpleBlankUserSnippet),
        contact: contactToDTO(reservation.contact),
        extras: (reservation.extras ?? []).map((line) => ({
            extra: mapSnippet<RentalExtraSimple>()(line.extra, RentalExtraSimpleSnippet),
            name: line.name,
            pricing: line.pricing,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            total: line.total,
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
        amountPaid: reservation.amountPaid,
        notes: reservation.notes,
        handover: vehicleCheck(reservation.handover),
        returnInfo: reservation.returnInfo ? {...vehicleCheck(reservation.returnInfo)!, damageNoted: reservation.returnInfo.damageNoted} : undefined,
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
export function rentalReservationToPublic(reservation: IRentalReservation, now = new Date()): PublicRentalReservation {
    return {
        _id: reservation._id.toString(),
        number: reservation.number,
        status: reservation.status,
        categoryName: reservation.snapshot.categoryName,
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
        extras: reservation.extras.map(({name, quantity, total}) => ({name, quantity, total})),
        paymentChoice: reservation.paymentChoice,
        paymentStatus: reservation.paymentStatus,
        amountPaid: reservation.amountPaid,
        freeCancellationUntil: dateToISOString(freeCancellationUntil(reservation)),
        cancellationFeePercent: reservation.policy.cancellationFeePercent,
        canCancel: (reservation.status === "held" || reservation.status === "confirmed") && reservation.pickupAt > now,
    };
}
