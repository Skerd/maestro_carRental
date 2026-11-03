import type {VehicleDocumentSimple} from "armonia/src/modules/carRental/dto/vehicleDocument.dto";
import type {IVehicleDocument} from "./vehicleDocument";
import {defineSnippet} from "@coreModule/database/utilities/snippet";

export const VehicleDocumentSimpleSnippet = defineSnippet<IVehicleDocument, VehicleDocumentSimple>()({
    keys: {
        _id: {},
        type: {},
        documentNumber: {},
        status: {},
    },
});
