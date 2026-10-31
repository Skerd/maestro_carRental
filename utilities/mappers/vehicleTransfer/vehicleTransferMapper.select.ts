import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleTransfer} from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";

export function vehicleTransfersToSelect(records: IVehicleTransfer[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: String(record._id)}));
}
