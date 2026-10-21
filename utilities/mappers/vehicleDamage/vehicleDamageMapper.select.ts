import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleDamage} from "@carRentalModule/database/schemas/vehicleDamage/vehicleDamage";

export function vehicleDamagesToSelect(damages: IVehicleDamage[]): ApiSelectDatum[] {
    return damages.map((damage) => ({value: damage._id.toString(), label: `${damage.area} · ${damage.severity} · ${damage.reportedAt.toISOString().slice(0, 10)}`}));
}
