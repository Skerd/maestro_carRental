import type {IVehicleCatalogEntry} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog";
import type {VehicleCatalogEntry} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/vehicleCatalog.dto";
import type {VehicleCatalogEntrySimple, VehicleCatalogEntrySimpleSource} from "armonia/src/modules/carRental/dto/vehicleCatalog.dto";
import {VehicleCatalogEntrySimpleSnippet} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog.snippets";
import {mapSnippet} from "@coreModule/utilities/mappers/common.mapper";
import {listDisplayName} from "@coreModule/utilities/helpers/listNames";
import {
    mapLifeCycleToDTO,
    mapOwnershipToDTO,
    mapRequestableToDTO,
    mapSoftDeleteToDTO,
} from "@coreModule/utilities/mappers/plugin/pluginMappers.dto";

export function vehicleCatalogEntryToDTO(entry: IVehicleCatalogEntry): VehicleCatalogEntry {
    return {
        _id: entry._id.toString(),
        name: listDisplayName(entry),
        level: entry.level,
        parentEntry: vehicleCatalogEntrySimpleToDTO(entry.parentEntry),
        order: entry.order,
        bodyStyle: entry.bodyStyle,
        seats: entry.seats,
        doors: entry.doors,
        fuelType: entry.fuelType,
        transmission: entry.transmission,
        yearFrom: entry.yearFrom,
        yearTo: entry.yearTo,
        ...mapSoftDeleteToDTO(entry),
        ...mapOwnershipToDTO(entry),
        ...mapLifeCycleToDTO(entry),
        ...mapRequestableToDTO(entry),
    };
}

/** The single read the edit form loads: also every language's name, which the platform edits (D199). */
export function vehicleCatalogEntryEditToDTO(entry: IVehicleCatalogEntry): VehicleCatalogEntry {
    const names = entry.names;
    return {...vehicleCatalogEntryToDTO(entry), ...(names ? {names: {en: names.en, sq: names.sq, de: names.de, fr: names.fr, it: names.it}} : {})};
}

export function vehicleCatalogEntriesToDTO(entries: IVehicleCatalogEntry[]): VehicleCatalogEntry[] {
    return entries.map(vehicleCatalogEntryToDTO);
}

/** A populated entry reference, named in the reader's language; undefined for an unpopulated id. */
export function vehicleCatalogEntrySimpleToDTO(entry: unknown): VehicleCatalogEntrySimple | undefined {
    if (!entry || typeof entry !== "object" || !("_id" in entry)) return undefined;
    const source = mapSnippet<VehicleCatalogEntrySimpleSource>()(entry, VehicleCatalogEntrySimpleSnippet);
    return source ? {_id: source._id, name: listDisplayName(source)} : undefined;
}
