import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import type {IVehicleBlock} from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";

export function vehicleBlocksToSelect(blocks: IVehicleBlock[]): ApiSelectDatum[] {
    return blocks.map((block) => ({value: block._id.toString(), label: `${block.reason} · ${block.startAt.toISOString().slice(0, 16)}`}));
}
