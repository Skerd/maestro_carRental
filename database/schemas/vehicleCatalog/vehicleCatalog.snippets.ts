import type {VehicleCatalogEntrySimpleSource} from "armonia/src/modules/carRental/dto/vehicleCatalog.dto";
import type {IVehicleCatalogEntry} from "./vehicleCatalog";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

/** Reads `names` too, so a reference is named in the reader's language; only `name` is sent (D199). */
export const VehicleCatalogEntrySimpleSnippet = defineSnippet<IVehicleCatalogEntry, VehicleCatalogEntrySimpleSource>()({
    keys: {
        _id: {},
        name: {},
        names: {},
    },
});
