import type {IVehicleDocument} from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";
import type {VehicleDocument} from "armonia/src/modules/carRental/api/carRental/private/vehicleDocument/vehicleDocument.dto";
import type {VehicleSimple} from "armonia/src/modules/carRental/dto/vehicle.dto";
import {dateToISOString, mapMedia, mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {VehicleSimpleSnippet} from "@carRentalModule/database/schemas/vehicle/vehicle.snippets";
import {mapLifeCycleToDTO, mapOwnershipToDTO, mapSoftDeleteToDTO} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleDocumentToDTO(document: IVehicleDocument): VehicleDocument {
    return {
        _id: document._id.toString(),
        vehicle: mapSnippet<VehicleSimple>()(document.vehicle, VehicleSimpleSnippet),
        type: document.type,
        documentNumber: document.documentNumber,
        issuer: document.issuer,
        issuedAt: document.issuedAt ? dateToISOString(document.issuedAt) : undefined,
        expiresAt: document.expiresAt ? dateToISOString(document.expiresAt) : undefined,
        status: document.status,
        attachments: document.attachments?.length ? document.attachments.map(mapMedia).filter((media) => media !== undefined) : undefined,
        notes: document.notes,
        ...mapSoftDeleteToDTO(document),
        ...mapOwnershipToDTO(document),
        ...mapLifeCycleToDTO(document),
    };
}

export function vehicleDocumentsToDTO(documents: IVehicleDocument[]): VehicleDocument[] {
    return documents.map(vehicleDocumentToDTO);
}
