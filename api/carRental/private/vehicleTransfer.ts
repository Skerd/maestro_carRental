import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {buildCreateDataFromSchemaDef, buildUpdateDataFromSchemaDef} from "@coreModule/api/buildUpdateDataFromSchemaDef";
import {VehicleTransferSchemaDef} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/vehicleTransfer.schema-def";
import {createVehicleTransferFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/createVehicleTransfer.form.validator";
import {editVehicleTransferFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/editVehicleTransfer.form.validator";
import VehicleTransfer from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer";
import {vehicleTransferService} from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer.service";
import {vehicleTransferToDTO, vehicleTransfersToDTO} from "@carRentalModule/utilities/mappers/vehicleTransfer/vehicleTransferMapper.dto";
import {vehicleTransfersToSelect} from "@carRentalModule/utilities/mappers/vehicleTransfer/vehicleTransferMapper.select";
import {VehicleTransferActions} from "@carRentalModule/database/schemas/vehicleTransfer/vehicleTransfer.actions";
import RentalLocation from "@carRentalModule/database/schemas/rentalLocation/rentalLocation";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {assertCompanyVehicle} from "@carRentalModule/utilities/services/vehicleRecords";
import {assertNoBookingClash} from "@carRentalModule/utilities/services/rentalAvailability";

export const basePath = "/api/carRental/vehicleTransfer";

export const {router} = createCrudRouter({
    collectionName: "vehicletransfers",
    model: VehicleTransfer,
    service: vehicleTransferService,
    entityName: "VehicleTransfer",
    createSchema: createVehicleTransferFormSchema,
    editSchema: editVehicleTransferFormSchema,
    toDTO: vehicleTransferToDTO,
    toDTOArray: vehicleTransfersToDTO,
    toSelect: vehicleTransfersToSelect,
    selectSearchField: "vehicle",
    defaultSort: {departAt: -1},
    actions: VehicleTransferActions,
    /**
     * Plans the move: both locations of this company and different, and a block for
     * the trip so no booking takes the car on the way (refused over an existing booking).
     */
    buildCreateData: async (params: any) => {
        const {company, session, languageCode} = params;
        const vehicleId = await assertCompanyVehicle(params.vehicle, {companyId: company._id, session, languageCode});
        const data = await buildCreateDataFromSchemaDef(VehicleTransferSchemaDef)(params);
        if (String(data.fromLocation) === String(data.toLocation)) throw apiValidationException("rental_transfer_same_location", "", null, languageCode);
        const locations = await RentalLocation.countDocuments({_id: {$in: [data.fromLocation, data.toLocation]}, company: company._id, deletedAt: null}).session(session);
        if (locations !== 2) throw apiValidationException("rental_location_not_found", "", null, languageCode);
        const start = new Date(data.departAt);
        const end = new Date(data.arriveAt);
        await assertNoBookingClash(vehicleId, {start, end}, {companyId: company._id, session, languageCode});
        const [block] = await VehicleBlock.create([{company: company._id, vehicle: vehicleId, startAt: start, endAt: end, reason: "transfer", source: "transfer"}], {session});
        return {...data, status: "planned", block: block._id};
    },
    // The trip's times and places are fixed: a changed plan is a new transfer. Driver, km and notes can change.
    buildUpdateData: (params: any, writeFields) => {
        const update = buildUpdateDataFromSchemaDef(VehicleTransferSchemaDef)(params, writeFields);
        return Object.fromEntries(Object.entries(update).filter(([key]) => ["driver", "odometerKm", "notes"].includes(key)));
    },
});
