import {ObjectId} from "mongodb";
import type {ClientSession} from "mongoose";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {platformRowsClause} from "@coreModule/utilities/security/platformAccess";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import type {IVehicle} from "@carRentalModule/database/schemas/vehicle/vehicle";
import {vehicleCatalogService} from "@carRentalModule/database/schemas/vehicleCatalog/vehicleCatalog.service";

/** The specs a catalog model gives a car that has none of its own (D199). */
const MODEL_SPECS = ["seats", "doors", "fuelType", "transmission"] as const;

const sameId = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");

/**
 * A car's make and model come from the platform's vehicle catalog (D199): a new car picks both, the model one of the
 * make's. The server writes their names into `make` and `model` (never typed) and fills the specs the car has none of
 * (staff may still change them). An older car not linked yet can still be edited; once it has a model it keeps one.
 * `data` is the create or update payload; `existing` the car being edited.
 */
export async function applyCatalogModel(
    data: Record<string, unknown>,
    input: {existing?: IVehicle; languageCode: string; session?: ClientSession},
): Promise<Record<string, unknown>> {
    const {existing, languageCode, session} = input;
    // The names are the catalog's, whatever a request sends.
    delete data.make;
    delete data.model;
    const required = () => apiValidationException("vehicle_catalog_model_required", "catalogModel", null, languageCode);
    const pickedModel = data.catalogModel === undefined ? nestedEntityToRef(existing?.catalogModel) : data.catalogModel;
    const pickedMake = data.catalogMake === undefined ? nestedEntityToRef(existing?.catalogMake) : data.catalogMake;
    if (!pickedModel) {
        // Only an older car never linked may stay without one.
        if (!existing || existing.catalogModel || data.catalogModel === null) throw required();
        return data;
    }
    const changed = !sameId(pickedModel, nestedEntityToRef(existing?.catalogModel)) || !sameId(pickedMake, nestedEntityToRef(existing?.catalogMake));
    if (!changed) return data;

    const model = ObjectId.isValid(String(pickedModel))
        ? await vehicleCatalogService.findOne(
            {_id: new ObjectId(String(pickedModel)), ...await platformRowsClause()},
            {session, withDeleted: false},
            [{path: "parentEntry", select: "name level"}],
        )
        : null;
    const make = model?.parentEntry;
    if (!model || model.level !== "model" || !make || typeof make !== "object" || !("name" in make)) {
        throw apiValidationException("vehicle_catalog_model_level", "catalogModel", null, languageCode);
    }
    if (pickedMake && !sameId(pickedMake, make._id)) {
        throw apiValidationException("vehicle_catalog_model_make", "catalogModel", null, languageCode);
    }
    data.catalogMake = make._id;
    data.catalogModel = model._id;
    data.make = make.name;
    data.model = model.name;
    for (const spec of MODEL_SPECS) {
        if (data[spec] === undefined && existing?.[spec] === undefined && model[spec] !== undefined) data[spec] = model[spec];
    }
    return data;
}
