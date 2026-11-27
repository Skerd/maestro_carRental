import {Document, model, Schema, SchemaTypes} from "mongoose";
import {normalizeSchemaPermissions} from "@coreModule/database/utilities";
import ownershipPlugin from "@coreModule/database/plugins/ownershipPlugin";
import requestablePlugin, {type IRequestablePluginFields} from "@coreModule/database/plugins/requestablePlugin";
import auditPlugin from "@coreModule/database/plugins/auditPlugin";
import softDeletePlugin from "@coreModule/database/plugins/softDeletePlugin";
import lifeCyclePlugin from "@coreModule/database/plugins/lifeCyclePlugin";
import {IOwnershipPluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields} from "@coreModule/database/types/plugin-fields";
import type {ICompany} from "@coreModule/database/schemas/company/company";
import {addModelData} from "@coreModule/database/collections";
import {validateSchemaDefAgainstMongoose} from "@coreModule/database/utilities/validateSchemaDefAgainstMongoose";
import {LIST_NAME_LANGUAGES, listSearchText, type ListNames} from "@coreModule/utilities/helpers/listNames";
import {
    VEHICLE_BODY_STYLES,
    VEHICLE_CATALOG_LEVELS,
    VEHICLE_CATALOG_NAME_MAX,
    VEHICLE_CATALOG_YEAR,
    VehicleCatalogSchemaDef,
    type VehicleBodyStyle,
    type VehicleCatalogLevel,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/vehicleCatalog.schema-def";
import {
    VEHICLE_DOORS,
    VEHICLE_FUEL_TYPES,
    VEHICLE_SEATS,
    VEHICLE_TRANSMISSIONS,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";
import {VehicleCatalogEntrySimpleSnippet} from "./vehicleCatalog.snippets";
import {applyVehicleCatalogIndexes} from "./vehicleCatalog.indexes";
import {vehicleCatalogViews} from "./vehicleCatalog.views";

/**
 * The platform's vehicle catalog (D199): one tree of vehicle types, makes and models owned by the platform company and
 * read by every company, built like the product and service categories (D195, D196). Seeded from Wikidata
 * (`catalogId`); a company requests a missing make or model.
 */
export interface IVehicleCatalogEntry extends Document, IOwnershipPluginFields, IRequestablePluginFields, ISoftDeletePluginFields, ILifeCyclePluginFields {
    company: ICompany;
    /** The English name; `names` holds every panel language (types are translated, makes and models are brand names). */
    name: string;
    names?: ListNames;
    level: VehicleCatalogLevel;
    parentEntry?: IVehicleCatalogEntry;
    order: number;
    bodyStyle?: VehicleBodyStyle;
    seats?: number;
    doors?: number;
    fuelType?: (typeof VEHICLE_FUEL_TYPES)[number];
    transmission?: (typeof VEHICLE_TRANSMISSIONS)[number];
    yearFrom?: number;
    yearTo?: number;
    /** The data file's key the row was seeded from (`car/mercedes-benz/e-class`); a later file updates the same row. */
    catalogId?: string;
    /** Every name and the parents' names, lower-cased, so "mercedes e-class" finds the model in any language. */
    searchText?: string;
}

const SERVER_WRITTEN = {self: {write: "no-permission"}, others: {write: "no-permission"}} as const;

const VehicleCatalogSchema = new Schema<IVehicleCatalogEntry>(
    {
        name: {type: SchemaTypes.String, required: true, trim: true, maxlength: VEHICLE_CATALOG_NAME_MAX},
        names: {
            type: new Schema(Object.fromEntries(LIST_NAME_LANGUAGES.map((language) => [language, {
                type: SchemaTypes.String, trim: true, maxlength: VEHICLE_CATALOG_NAME_MAX,
            }])), {_id: false}),
            required: false,
            dynamicTableConfiguration: {hideColumn: true},
        },
        level: {
            type: SchemaTypes.String,
            enum: VEHICLE_CATALOG_LEVELS,
            required: true,
            dynamicTableConfiguration: {enumTones: {type: "info", make: "neutral", model: "neutral"}},
        },
        parentEntry: {
            type: SchemaTypes.ObjectId,
            ref: "VehicleCatalogEntry",
            refAllowlist: VehicleCatalogEntrySimpleSnippet,
            dynamicTableConfiguration: {refDisplayKey: ["name"]},
        },
        order: {type: SchemaTypes.Number, default: 0, dynamicTableConfiguration: {hideColumn: true}},
        bodyStyle: {type: SchemaTypes.String, enum: VEHICLE_BODY_STYLES},
        seats: {type: SchemaTypes.Number, ...VEHICLE_SEATS},
        doors: {type: SchemaTypes.Number, ...VEHICLE_DOORS, dynamicTableConfiguration: {visible: false}},
        fuelType: {type: SchemaTypes.String, enum: VEHICLE_FUEL_TYPES},
        transmission: {type: SchemaTypes.String, enum: VEHICLE_TRANSMISSIONS, dynamicTableConfiguration: {visible: false}},
        yearFrom: {type: SchemaTypes.Number, ...VEHICLE_CATALOG_YEAR, dynamicTableConfiguration: {visible: false}},
        yearTo: {type: SchemaTypes.Number, ...VEHICLE_CATALOG_YEAR, dynamicTableConfiguration: {visible: false}},
        catalogId: {type: SchemaTypes.String, required: false, permissions: SERVER_WRITTEN, dynamicTableConfiguration: {hideColumn: true}},
        searchText: {type: SchemaTypes.String, required: false, permissions: SERVER_WRITTEN, dynamicTableConfiguration: {hideColumn: true}},
    },
    {accessMode: "loose", collection: "vehiclecatalogentries"},
);

/** The search text of an entry: its names and its parents' (a model is found by "mercedes e-class"). */
async function searchTextOf(name: string, names: ListNames | undefined, parentId: unknown): Promise<string> {
    const parts = [listSearchText(name, names)];
    let current = parentId;
    for (let depth = 0; current && depth < 2; depth += 1) {
        const parent = await VehicleCatalogEntry.findById(current).select("name names parentEntry").lean();
        if (!parent) break;
        // The type ("car") is not a word people search a model by; the make is.
        if (parent.level !== "type") parts.unshift(listSearchText(parent.name, parent.names));
        current = parent.parentEntry;
    }
    return parts.join(" ");
}

VehicleCatalogSchema.pre("save", async function () {
    // The seed writes each row's search text itself: a parent in the same batch is not stored yet.
    if ((this.isNew && !this.searchText) || (!this.isNew && (this.isModified("name") || this.isModified("names") || this.isModified("parentEntry")))) {
        this.searchText = await searchTextOf(this.name, this.names, this.parentEntry);
    }
});

// CRUD edit uses updateOne($set), which skips pre("save").
VehicleCatalogSchema.pre(["updateOne", "findOneAndUpdate"], async function () {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return;
    const {$set} = update;
    if (!$set) return;
    const namesChanged = Object.keys($set).some((key) => key === "names" || key.startsWith("names."));
    if ($set.name === undefined && !namesChanged && $set.parentEntry === undefined) return;
    const existing = await this.model.findOne(this.getQuery()).select("name names parentEntry").session(this.getOptions()?.session ?? null).lean<{name: string; names?: ListNames; parentEntry?: unknown}>();
    if (!existing) return;
    const names: ListNames = {...(existing.names ?? {}), ...($set.names ?? {})};
    for (const language of LIST_NAME_LANGUAGES) if ($set[`names.${language}`] !== undefined) names[language] = $set[`names.${language}`];
    $set.searchText = await searchTextOf($set.name ?? existing.name, names, $set.parentEntry ?? existing.parentEntry);
});

// A platform list (D160, D199): the platform company owns the rows and every company reads them; another company's
// create is a request the platform approves.
ownershipPlugin(VehicleCatalogSchema, {tenantScoped: false});
requestablePlugin(VehicleCatalogSchema);
auditPlugin(VehicleCatalogSchema);
softDeletePlugin(VehicleCatalogSchema);
lifeCyclePlugin(VehicleCatalogSchema);
applyVehicleCatalogIndexes(VehicleCatalogSchema);
const VehicleCatalogEntry = model<IVehicleCatalogEntry>("VehicleCatalogEntry", VehicleCatalogSchema);
normalizeSchemaPermissions(VehicleCatalogEntry);
export default VehicleCatalogEntry;

addModelData(VehicleCatalogEntry, vehicleCatalogViews);
/** Server-written paths: the seeded catalog id and the search text. */
validateSchemaDefAgainstMongoose(VehicleCatalogSchema, VehicleCatalogSchemaDef, "VehicleCatalogEntry", ["catalogId", "searchText"]);
