import type {IVehicleCatalogEntry} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog";
import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {listDisplayName} from "@coreModule/utilities/helpers/listNames";

/** Picker options in the reader's language; a model names its make ("Mercedes-Benz › E-Class"), a make its type. */
export function vehicleCatalogEntriesToSelect(entries: IVehicleCatalogEntry[]): ApiSelectDatum[] {
    return entries.map((entry) => {
        const parent = entry.parentEntry && typeof entry.parentEntry === "object" && "name" in entry.parentEntry
            ? listDisplayName(entry.parentEntry)
            : "";
        const name = listDisplayName(entry);
        return {value: entry._id.toString(), label: parent ? `${parent} › ${name}` : name};
    });
}
