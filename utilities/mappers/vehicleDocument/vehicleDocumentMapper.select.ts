import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleDocument} from "@carRentalModule/database/schemas/vehicleDocument/vehicleDocument";

export function vehicleDocumentsToSelect(documents: IVehicleDocument[]): ApiSelectDatum[] {
    return documents.map((document) => ({value: document._id.toString(), label: [document.type, document.documentNumber].filter(Boolean).join(" · ")}));
}
