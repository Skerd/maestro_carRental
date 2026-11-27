import type {ObjectId} from "mongodb";
import {platformRowsClause} from "@coreModule/utilities/security/platformAccess";
import {vehicleCatalogService} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog.service";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";
import {catalogMatcher, type CatalogModelRef} from "./vehicleCatalogMatch";
import {vehicleColorCode} from "./vehicleColorMatch";
import {VEHICLE_COLORS} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

/** The catalog's usable models with their make's name and type's key, for matching typed names (D199). */
export async function catalogModelRefs(): Promise<(CatalogModelRef & {makeId: string})[]> {
    const rows = await vehicleCatalogService.find({...await platformRowsClause(), deletedAt: null}, {}, undefined, "_id name level parentEntry catalogId");
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    return rows.filter((row) => row.level === "model").flatMap((model) => {
        const make = byId.get(String(model.parentEntry));
        const type = make ? byId.get(String(make.parentEntry)) : undefined;
        return make && type
            ? [{id: String(model._id), makeId: String(make._id), make: make.name, model: model.name, type: type.catalogId ?? type.name.toLowerCase()}]
            : [];
    });
}

export type CatalogLinkResult = {
    linked: {vehicleId: string; plate: string; make: string; model: string; catalogModelId: string}[];
    unmatched: {vehicleId: string; plate: string; make: string; model: string}[];
};

/**
 * Links cars that have no catalog model yet to the one their typed make and model name, with its make (D199), leaving
 * their names as typed (a car linked to a model only gets its make); cars that match nothing are listed, never guessed. `apply: false` only reports. All companies' cars, or one.
 */
export async function linkVehiclesToCatalog(input: {companyId?: ObjectId; apply: boolean}): Promise<CatalogLinkResult> {
    const refs = await catalogModelRefs();
    const match = catalogMatcher(refs);
    const makeOf = new Map(refs.map((ref) => [ref.id, ref.makeId]));
    const cars = await vehicleService.find(
        {...(input.companyId ? {company: input.companyId} : {}), $or: [{catalogModel: null}, {catalogMake: null}], deletedAt: null},
        {},
        undefined,
        "_id plate make model catalogModel",
    );
    const result: CatalogLinkResult = {linked: [], unmatched: []};
    for (const car of cars) {
        // Linked by an earlier run with its model only: its make is the model's.
        const linkedModel = car.catalogModel ? String(car.catalogModel) : undefined;
        const found = linkedModel ? refs.find((ref) => ref.id === linkedModel) : match(car.make, car.model);
        const row = {vehicleId: String(car._id), plate: car.plate, make: car.make, model: car.model};
        if (!found) {
            result.unmatched.push(row);
            continue;
        }
        result.linked.push({...row, catalogModelId: found.id});
        if (input.apply) await vehicleService.updateOne({_id: car._id}, {$set: {catalogModel: found.id, catalogMake: makeOf.get(found.id)}});
    }
    return result;
}

export type ColorMoveResult = {moved: number; cleared: {plate: string; color: string}[]};

/**
 * Moves typed colours onto the colour list (D199): a colour word in any panel language becomes its code; one with no
 * known word is cleared and listed (a free-text colour would fail the car's next save). `apply: false` only reports.
 */
export async function moveVehicleColorsToCodes(input: {companyId?: ObjectId; apply: boolean}): Promise<ColorMoveResult> {
    const cars = await vehicleService.find(
        {...(input.companyId ? {company: input.companyId} : {}), color: {$exists: true, $nin: [...VEHICLE_COLORS, null]}, deletedAt: null},
        {},
        undefined,
        "_id plate color",
    );
    const result: ColorMoveResult = {moved: 0, cleared: []};
    for (const car of cars) {
        const typed = String(car.color);
        const code = vehicleColorCode(typed);
        if (code) result.moved += 1;
        else result.cleared.push({plate: car.plate, color: typed});
        if (input.apply) await vehicleService.updateOne({_id: car._id}, code ? {$set: {color: code}} : {$unset: {color: ""}});
    }
    return result;
}
