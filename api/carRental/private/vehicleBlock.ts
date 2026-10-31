import {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {createVehicleBlockFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/createVehicleBlock.form.validator";
import {editVehicleBlockFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/editVehicleBlock.form.validator";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import {vehicleBlockService} from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock.service";
import {vehicleBlockToDTO, vehicleBlocksToDTO} from "@carRentalModule/utilities/mappers/vehicleBlock/vehicleBlockMapper.dto";
import {vehicleBlocksToSelect} from "@carRentalModule/utilities/mappers/vehicleBlock/vehicleBlockMapper.select";
import {assertNoBookingClash} from "@carRentalModule/utilities/services/rentalAvailability";

export const basePath = "/api/carRental/vehicleBlock";

export const {router} = createCrudRouter({
    collectionName: "vehicleblocks",
    model: VehicleBlock,
    service: vehicleBlockService,
    entityName: "VehicleBlock",
    createSchema: createVehicleBlockFormSchema,
    editSchema: editVehicleBlockFormSchema,
    toDTO: vehicleBlockToDTO,
    toDTOArray: vehicleBlocksToDTO,
    toSelect: vehicleBlocksToSelect,
    selectSearchField: "reason",
    selectProjection: "_id reason startAt",
    defaultSort: {startAt: -1},
    /**
     * Blocking a car over a booking would strand that customer: the booking must be
     * reassigned first. The vehicle lock stops a booking racing this block.
     */
    buildCreateData: async ({vehicle, startAt, endAt, reason, note, company, session, languageCode}: any) => {
        const vehicleId = new ObjectId(String(vehicle));
        const start = new Date(startAt);
        const end = new Date(endAt);
        await assertNoBookingClash(vehicleId, {start, end}, {companyId: company._id, session, languageCode});
        return {vehicle: vehicleId, startAt: start, endAt: end, reason, note};
    },
    // The window was checked against bookings at create; only the reason and note change.
    buildUpdateData: ({reason, note}: any, writeFields) => ({
        ...(reason !== undefined && writeFields.reason && {reason}),
        ...(note !== undefined && writeFields.note && {note}),
    }),
});
