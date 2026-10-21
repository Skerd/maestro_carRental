import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleMaintenance} from "@carRentalModule/database/schemas/vehicleMaintenance/vehicleMaintenance";

export function vehicleMaintenancesToSelect(records: IVehicleMaintenance[]): ApiSelectDatum[] {
    return records.map((record) => ({value: record._id.toString(), label: `${record.type} · ${record.serviceDate.toISOString().slice(0, 10)}`}));
}
