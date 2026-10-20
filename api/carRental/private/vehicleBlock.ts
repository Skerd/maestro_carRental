import {ObjectId} from "mongodb";
import {createCrudRouter} from "@coreModule/api/crudRouterFactory";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {createVehicleBlockFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/createVehicleBlock.form.validator";
import {editVehicleBlockFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/editVehicleBlock.form.validator";
import VehicleBlock from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock";
import {vehicleBlockService} from "@carRentalModule/database/schemas/vehicleBlock/vehicleBlock.service";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";
import {vehicleBlockToDTO, vehicleBlocksToDTO} from "@carRentalModule/utilities/mappers/vehicleBlock/vehicleBlockMapper.dto";
import {vehicleBlocksToSelect} from "@carRentalModule/utilities/mappers/vehicleBlock/vehicleBlockMapper.select";
import {blockingReservationFilter, lockVehicle} from "@carRentalModule/utilities/services/rentalAvailability";

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
        await lockVehicle(vehicleId, {companyId: company._id, session, languageCode, requireActive: false});
        const start = new Date(startAt);
        const end = new Date(endAt);
        const clash = await RentalReservation.findOne({
            company: company._id,
            vehicle: vehicleId,
            pickupAt: {$lt: end},
            blockedUntil: {$gt: start},
            ...blockingReservationFilter(new Date()),
        }).select("number").session(session);
        if (clash) {
            throw apiValidationException("vehicle_block_overlaps_reservation", "", null, languageCode, [clash.number]);
        }
        return {vehicle: vehicleId, startAt: start, endAt: end, reason, note};
    },
    // The window was checked against bookings at create; only the reason and note change.
    buildUpdateData: ({reason, note}: any, writeFields) => ({
        ...(reason !== undefined && writeFields.reason && {reason}),
        ...(note !== undefined && writeFields.note && {note}),
    }),
});
