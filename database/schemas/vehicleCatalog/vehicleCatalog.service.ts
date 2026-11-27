import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import VehicleCatalogEntry, {type IVehicleCatalogEntry} from "./vehicleCatalog";

export class VehicleCatalogService extends BaseCrudService<IVehicleCatalogEntry, typeof VehicleCatalogEntry> {
    constructor() {
        super(VehicleCatalogEntry, "VehicleCatalogEntry");
    }
}

export const vehicleCatalogService = new VehicleCatalogService();
