/**
 * The car's sheet as a hub (UX-03): its bookings, damages, services, papers, insurance, fines and blocks, newest
 * first. Each list is read the way its own list route reads it: only when the caller's role can read that model,
 * with the caller's field grants (SEC-09).
 */

import type {ObjectId} from "mongodb";
import {readableListFetch} from "@coreModule/database/security/readableListFetch";
import type {UserContext} from "@coreModule/utilities/types/types";
import type {CurrencySimple} from "armonia/src/modules/core/dto/currency.dto";
import type {Vehicle} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.dto";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {rentalReservationService} from "@carRentalModule/database/schemas/rentalReservation/rentalReservation.service";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import {vehicleBlockService} from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock.service";
import VehicleDamage from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";
import {vehicleDamageService} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage.service";
import VehicleDocument from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import {vehicleDocumentService} from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument.service";
import VehicleFine from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";
import {vehicleFineService} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine.service";
import VehicleInsurance from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance";
import {vehicleInsuranceService} from "@carRentalModule/database/schemas/vehicleInsurance/vehicleInsurance.service";
import VehicleMaintenance from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";
import {vehicleMaintenanceService} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance.service";
import {rentalReservationsToDTO} from "@carRentalModule/utilities/mappers/rentalReservation/rentalReservationMapper.dto";
import {vehicleBlocksToDTO} from "@carRentalModule/utilities/mappers/vehicleBlock/vehicleBlockMapper.dto";
import {vehicleDamagesToDTO} from "@carRentalModule/utilities/mappers/vehicleDamage/vehicleDamageMapper.dto";
import {vehicleDocumentsToDTO} from "@carRentalModule/utilities/mappers/vehicleDocument/vehicleDocumentMapper.dto";
import {vehicleFinesToDTO} from "@carRentalModule/utilities/mappers/vehicleFine/vehicleFineMapper.dto";
import {vehicleInsurancesToDTO} from "@carRentalModule/utilities/mappers/vehicleInsurance/vehicleInsuranceMapper.dto";
import {vehicleMaintenancesToDTO} from "@carRentalModule/utilities/mappers/vehicleMaintenance/vehicleMaintenanceMapper.dto";

/** The newest records of each kind; the full history stays on each list page (the car's records menu). */
const HUB_LIMIT = 20;

type HubCtx = {companyId: ObjectId; actionUserCtx: UserContext; languageCode: string; currency?: CurrencySimple};
export type VehicleHub = Pick<Vehicle, "reservations" | "damages" | "maintenance" | "documents" | "insurances" | "fines" | "blocks">;

export async function vehicleHub(vehicleId: ObjectId, ctx: HubCtx): Promise<VehicleHub> {
    const filter = {company: ctx.companyId, deletedAt: null, vehicle: vehicleId};
    const reservationsFetch = readableListFetch(RentalReservation, ctx);
    const damagesFetch = readableListFetch(VehicleDamage, ctx);
    const maintenanceFetch = readableListFetch(VehicleMaintenance, ctx);
    const documentsFetch = readableListFetch(VehicleDocument, ctx);
    const insurancesFetch = readableListFetch(VehicleInsurance, ctx);
    const finesFetch = readableListFetch(VehicleFine, ctx);
    const blocksFetch = readableListFetch(VehicleBlock, ctx);

    const [reservations, damages, maintenance, documents, insurances, fines, blocks] = await Promise.all([
        reservationsFetch ? rentalReservationService.find(filter, {}, reservationsFetch.populate, reservationsFetch.select, {pickupAt: -1}, HUB_LIMIT) : null,
        damagesFetch ? vehicleDamageService.find(filter, {}, damagesFetch.populate, damagesFetch.select, {reportedAt: -1}, HUB_LIMIT) : null,
        maintenanceFetch ? vehicleMaintenanceService.find(filter, {}, maintenanceFetch.populate, maintenanceFetch.select, {serviceDate: -1}, HUB_LIMIT) : null,
        documentsFetch ? vehicleDocumentService.find(filter, {}, documentsFetch.populate, documentsFetch.select, {expiresAt: -1}, HUB_LIMIT) : null,
        insurancesFetch ? vehicleInsuranceService.find(filter, {}, insurancesFetch.populate, insurancesFetch.select, {expiresAt: -1}, HUB_LIMIT) : null,
        finesFetch ? vehicleFineService.find(filter, {}, finesFetch.populate, finesFetch.select, {offenceAt: -1}, HUB_LIMIT) : null,
        blocksFetch ? vehicleBlockService.find(filter, {}, blocksFetch.populate, blocksFetch.select, {startAt: -1}, HUB_LIMIT) : null,
    ]);

    // Damage, service, insurance and fine amounts are in the one rental currency, like on their own pages (UX-07).
    const priced = <T extends object>(rows: T[]) => (ctx.currency ? rows.map((row) => ({...row, currency: ctx.currency})) : rows);
    const hub: VehicleHub = {};
    if (reservations) hub.reservations = rentalReservationsToDTO(reservations);
    if (damages) hub.damages = priced(vehicleDamagesToDTO(damages));
    if (maintenance) hub.maintenance = priced(vehicleMaintenancesToDTO(maintenance));
    if (documents) hub.documents = vehicleDocumentsToDTO(documents);
    if (insurances) hub.insurances = priced(vehicleInsurancesToDTO(insurances));
    if (fines) hub.fines = priced(vehicleFinesToDTO(fines));
    if (blocks) hub.blocks = vehicleBlocksToDTO(blocks);
    return hub;
}
