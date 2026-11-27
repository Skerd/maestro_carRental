import {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {addPlatformListTreeRoute, platformListRouteOptions, withoutForeignRequest} from "@coreModule/api/platformListRoute";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {
    VehicleCatalogSchemaDef,
    type CreateVehicleCatalogFormType,
    type EditVehicleCatalogFormType,
    type VehicleCatalogLevel,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/vehicleCatalog.schema-def";
import {createVehicleCatalogFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/createVehicleCatalog.form.validator";
import {editVehicleCatalogFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/editVehicleCatalog.form.validator";
import {vehicleCatalogSelectFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/vehicleCatalogSelect.form.validator";
import VehicleCatalogEntry, {type IVehicleCatalogEntry} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog";
import {vehicleCatalogService} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog.service";
import {
    vehicleCatalogEntriesToDTO,
    vehicleCatalogEntryEditToDTO,
    vehicleCatalogEntryToDTO,
} from "@carRentalModule/utilities/mappers/vehicleCatalog/vehicleCatalogMapper.dto";
import {vehicleCatalogEntriesToSelect} from "@carRentalModule/utilities/mappers/vehicleCatalog/vehicleCatalogMapper.select";

/** The level a parent must have: a make sits under a type, a model under a make, a type at the top. */
const PARENT_LEVEL: Record<VehicleCatalogLevel, VehicleCatalogLevel | null> = {type: null, make: "type", model: "make"};

/** A type has no parent; a make's is a type, a model's a make, so the tree stays type → make → model. */
async function assertParentFits(level: VehicleCatalogLevel, parentId: unknown, languageCode: string): Promise<void> {
    const wanted = PARENT_LEVEL[level];
    const parent = parentId
        ? await vehicleCatalogService.findOne({_id: new ObjectId(String(parentId))}, {withDeleted: false}, undefined, "level")
        : null;
    if (wanted ? parent?.level !== wanted : Boolean(parentId)) {
        throw apiValidationException("vehicle_catalog_parent_level", "parentEntry", null, languageCode);
    }
}

export const basePath = "/api/carRental/vehicleCatalog";

const buildCreate = buildCreateDataFromSchemaDef(VehicleCatalogSchemaDef);
const buildUpdate = buildUpdateDataFromSchemaDef(VehicleCatalogSchemaDef);

const platformList = platformListRouteOptions<IVehicleCatalogEntry, CreateVehicleCatalogFormType>({
    model: VehicleCatalogEntry,
    collectionName: "vehiclecatalogentries",
    toDTO: vehicleCatalogEntryToDTO,
    service: vehicleCatalogService,
    buildCreateData: async (params) => {
        await assertParentFits(params.level, params.parentEntry, params.languageCode);
        return buildCreate(params);
    },
    // The panel's page is `/tenancy/systemSettings/vehiclecatalogentries`, the collection name (the default).
});

// A platform list (D160, D199): one tree owned by the platform company and read by every company; only the platform
// company edits it, and another company's create is a request the platform approves.
export const {router} = createCrudRouter<IVehicleCatalogEntry, CreateVehicleCatalogFormType, EditVehicleCatalogFormType>({
    collectionName: "vehiclecatalogentries",
    model: VehicleCatalogEntry,
    service: vehicleCatalogService,
    entityName: "VehicleCatalogEntry",
    // Every name with the make's, so "mercedes e" finds the E-Class; the label names the parent ("Mercedes-Benz › E-Class").
    selectSearchField: "searchText",
    selectProjection: "_id name names parentEntry level",
    selectPopulate: [{path: "parentEntry", select: "name names"}],
    selectSort: {order: 1, name: 1},
    defaultSort: {order: 1, name: 1},
    createSchema: createVehicleCatalogFormSchema,
    editSchema: editVehicleCatalogFormSchema,
    selectSchema: vehicleCatalogSelectFormSchema,
    toDTO: vehicleCatalogEntryToDTO,
    toDTOArray: vehicleCatalogEntriesToDTO,
    toSelect: vehicleCatalogEntriesToSelect,
    ...platformList,
    // After the platform list's options, which bring their own: only the single read, which the edit form loads,
    // carries every language's name; the request record stays the requester's and the platform's.
    enrichSingle: async (doc, params) => withoutForeignRequest(vehicleCatalogEntryEditToDTO(doc), params.company),
    // The platform list's approved rows, of one level and under one parent when asked (the car form picks a model).
    extraSelectFilter: async (params) => {
        const filter: Record<string, unknown> = {...await platformList.extraSelectFilter(params)};
        const {level, parentEntry, excludeEntryId} = params;
        if (typeof level === "string") filter.level = level;
        if (parentEntry && ObjectId.isValid(parentEntry as string)) filter.parentEntry = new ObjectId(parentEntry as string);
        if (excludeEntryId && ObjectId.isValid(excludeEntryId as string)) filter._id = {$ne: new ObjectId(excludeEntryId as string)};
        return filter;
    },
    buildUpdateData: async (params, writeFields) => {
        const data = buildUpdate(params, writeFields);
        const level = (data.level ?? params.existing.level) as VehicleCatalogLevel;
        if (data.level !== undefined || data.parentEntry !== undefined) {
            await assertParentFits(level, data.parentEntry === undefined ? nestedEntityToRef(params.existing.parentEntry) : data.parentEntry, params.languageCode);
        }
        return data;
    },
    rateLimits: {read: 60, write: 30, delete: 20},
});

// The hierarchy view: one level at a time (thousands of models), or a search in any language with each match's path.
addPlatformListTreeRoute(router, {model: VehicleCatalogEntry, service: vehicleCatalogService, parentField: "parentEntry"});
