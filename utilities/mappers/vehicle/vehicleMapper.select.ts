import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";

export function vehiclesToSelect(vehicles: IVehicle[]): ApiSelectDatum[] {
    return vehicles.map((vehicle) => ({value: vehicle._id.toString(), label: `${vehicle.plate} · ${vehicle.make} ${vehicle.model}`}));
}
