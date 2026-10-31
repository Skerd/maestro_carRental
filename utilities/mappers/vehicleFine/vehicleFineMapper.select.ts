import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleFine} from "@carRentalModule/database/schemas/vehicleFine/vehicleFine";

export function vehicleFinesToSelect(records: IVehicleFine[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: `${record.reference} · ${record.authority}`}));
}
