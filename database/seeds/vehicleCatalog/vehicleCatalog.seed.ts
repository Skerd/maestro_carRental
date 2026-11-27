import * as fs from "fs";
import * as path from "path";
import {ObjectId} from "mongodb";
import {getLogger} from "@coreModule/loggers/serverLog";
import type {PlatformListsContext} from "@coreModule/utilities/modules/moduleCompanyDefaults";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {LIST_NAME_LANGUAGES, listSearchText, type ListNames} from "@coreModule/utilities/helpers/listNames";
import {VEHICLE_CATALOG_YEAR, type VehicleBodyStyle} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/vehicleCatalog.schema-def";
import VehicleCatalogEntry from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog";

type Locale = "en-US" | "de-CH" | "fr-FR" | "it-IT" | "sq-AL";

/** `vehicleCatalog.json`, built from Wikidata (CC0) with a few models added by hand. */
export type VehicleCatalogFile = {
    source: string;
    retrieved: string;
    types: {key: string; names: Record<Locale, string>}[];
    makes: {key: string; name: string; wikidata?: string}[];
    models: {
        key: string;
        make: string;
        type: string;
        name: string;
        from?: number | null;
        to?: number | null;
        bodyStyle?: VehicleBodyStyle;
        seats?: number;
        doors?: number;
        fuel?: "petrol" | "diesel" | "hybrid" | "electric" | "other";
        transmission?: "manual" | "automatic";
    }[];
};

const DATA_FILE = path.join(__dirname, "vehicleCatalog.json");

/** The vehicle catalog data file, or null when it is missing. */
export function loadVehicleCatalogFile(): VehicleCatalogFile | null {
    return fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as VehicleCatalogFile : null;
}

/** One tree row: a type (`car`), a make under a type (`car/mercedes-benz`) or a model under a make. */
type CatalogRow = {
    id: string;
    parent: string | null;
    level: "type" | "make" | "model";
    order: number;
    name: string;
    names: ListNames;
    specs: Record<string, number | string>;
};

const plausibleYear = (year: number) => year >= VEHICLE_CATALOG_YEAR.min && year <= VEHICLE_CATALOG_YEAR.max;

/** The file as tree rows, parents first: every make appears under each type it has models of. */
export function vehicleCatalogRows(data: VehicleCatalogFile): CatalogRow[] {
    const rows: CatalogRow[] = [];
    const makeName = new Map(data.makes.map((make) => [make.key, make.name]));
    const same = (name: string): ListNames => ({en: name});
    data.types.forEach((type, order) => rows.push({
        id: type.key,
        parent: null,
        level: "type",
        order,
        name: type.names["en-US"],
        names: {en: type.names["en-US"], de: type.names["de-CH"], fr: type.names["fr-FR"], it: type.names["it-IT"], sq: type.names["sq-AL"]},
        specs: {},
    }));
    const makeRows = new Map<string, CatalogRow>();
    const modelRows: CatalogRow[] = [];
    for (const model of data.models) {
        const name = makeName.get(model.make);
        if (!name) continue;
        const makeId = `${model.type}/${model.make}`;
        if (!makeRows.has(makeId)) makeRows.set(makeId, {id: makeId, parent: model.type, level: "make", order: 0, name, names: same(name), specs: {}});
        const specs: Record<string, number | string> = {};
        if (model.bodyStyle) specs.bodyStyle = model.bodyStyle;
        if (model.seats) specs.seats = model.seats;
        if (model.doors !== undefined) specs.doors = model.doors;
        if (model.fuel) specs.fuelType = model.fuel;
        if (model.transmission) specs.transmission = model.transmission;
        // A year outside the catalog's range is a data slip, left out rather than failing the setup.
        if (model.from && plausibleYear(model.from)) specs.yearFrom = model.from;
        if (model.to && plausibleYear(model.to)) specs.yearTo = model.to;
        modelRows.push({id: `${makeId}/${model.key}`, parent: makeId, level: "model", order: 0, name: model.name, names: same(model.name), specs});
    }
    return [...rows, ...[...makeRows.values()].sort((a, b) => a.name.localeCompare(b.name)), ...modelRows.sort((a, b) => a.name.localeCompare(b.name))];
}

const SPEC_FIELDS = ["bodyStyle", "seats", "doors", "fuelType", "transmission", "yearFrom", "yearTo"] as const;

/**
 * Seeds the platform's vehicle catalog (D199) from the data file: the `platformLists` hook of the car rental module's
 * bootstrap, run at every database setup. Rows are matched by their catalog id, so a newer data file adds the new
 * entries, updates the changed ones and hides (soft-deletes) the ones that left it; a hidden row keeps every car that
 * points at it. Entries companies requested (no catalog id) are never touched.
 */
export async function seedVehicleCatalog(
    {platformCompany, logger: parentLogger}: PlatformListsContext,
    data: VehicleCatalogFile | null = loadVehicleCatalogFile(),
): Promise<void> {
    const logger = getLogger("mongoDbInitialization-vehicleCatalog", parentLogger);
    if (!data) {
        logger.warn("No vehicle catalog data file; the vehicle catalog is not seeded.");
        return;
    }
    const rows = vehicleCatalogRows(data);
    logger.start(`Seeding ${rows.length} vehicle catalog entries (${data.source}, ${data.retrieved})...`);
    const platformId = platformCompany._id as ObjectId;
    const existing = await VehicleCatalogEntry.collection.find({company: platformId, catalogId: {$type: "string"}}).toArray();
    const byId = new Map(existing.map((row) => [row.catalogId as string, row]));
    const idOf = new Map<string, ObjectId>(existing.map((row) => [row.catalogId as string, row._id]));
    for (const row of rows) if (!idOf.has(row.id)) idOf.set(row.id, new ObjectId());
    const nameOf = new Map(rows.map((row) => [row.id, row]));

    // The search text names the make too, so "mercedes e-class" finds the model (see the schema's `searchTextOf`).
    const searchOf = (row: CatalogRow) => {
        const parent = row.level === "model" && row.parent ? nameOf.get(row.parent) : undefined;
        return [parent ? listSearchText(parent.name, parent.names) : "", listSearchText(row.name, row.names)].filter(Boolean).join(" ");
    };

    const now = new Date();
    const inserts: InstanceType<typeof VehicleCatalogEntry>[] = [];
    const updates: {updateOne: {filter: object; update: object}}[] = [];
    for (const row of rows) {
        const parent = row.parent ? idOf.get(row.parent) : undefined;
        const current = byId.get(row.id);
        const fields = {
            name: row.name,
            names: row.names,
            level: row.level,
            order: row.order,
            searchText: searchOf(row),
            ...row.specs,
        };
        if (!current) {
            inserts.push(new VehicleCatalogEntry({
                _id: idOf.get(row.id),
                company: platformId,
                createdBy: platformCompany.createdBy,
                parentEntry: parent,
                catalogId: row.id,
                requestStatus: "approved",
                ...fields,
            }));
            continue;
        }
        const unchanged = current.name === row.name && current.order === row.order && current.searchText === fields.searchText
            && String(nestedEntityToRef(current.parentEntry) ?? "") === String(parent ?? "") && !current.deletedAt
            && SPEC_FIELDS.every((field) => current[field] === row.specs[field])
            && LIST_NAME_LANGUAGES.every((language) => (current.names?.[language] ?? undefined) === row.names[language]);
        if (unchanged) continue;
        const unset = Object.fromEntries(SPEC_FIELDS.filter((field) => row.specs[field] === undefined && current[field] !== undefined).map((field) => [field, ""]));
        updates.push({updateOne: {
            filter: {_id: current._id},
            update: {$set: {...fields, parentEntry: parent ?? null, deletedAt: null, updatedAt: now}, ...(Object.keys(unset).length ? {$unset: unset} : {})},
        }});
    }
    const inFile = new Set(rows.map((row) => row.id));
    const gone = existing.filter((row) => !inFile.has(row.catalogId as string) && !row.deletedAt).map((row) => row._id);

    if (inserts.length > 0) await VehicleCatalogEntry.bulkSave(inserts);
    if (updates.length > 0) await VehicleCatalogEntry.bulkWrite(updates);
    if (gone.length > 0) await VehicleCatalogEntry.updateMany({_id: {$in: gone}}, {$set: {deletedAt: now}});
    logger.finish(`Vehicle catalog: ${inserts.length} added, ${updates.length} updated, ${gone.length} hidden.`);
}
