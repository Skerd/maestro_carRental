import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {setVehicleReadinessFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/setVehicleReadiness.form.validator";
import type {SetVehicleReadinessFormType} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {Vehicle as VehicleDto} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.dto";
import Vehicle from "./vehicle";
import {vehicleToDTO} from "@carRentalModule/utilities/mappers/vehicle/vehicleMapper.dto";
import {assertReservationWrite} from "@carRentalModule/utilities/services/rentalAccess";

export class VehicleActions {
    /** Marks a car ready to go out again (after cleaning), or as needing a check. Counter staff may do this. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 60}, schema: setVehicleReadinessFormSchema})
    async setReadiness(params: TransactionRequiredParams & SetVehicleReadinessFormType): Promise<VehicleDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const vehicle = ObjectId.isValid(params._id)
            ? await Vehicle.findOne({_id: new ObjectId(params._id), company: params.company._id, deletedAt: null}).session(params.session)
            : null;
        if (!vehicle) throw apiValidationException("vehicle_not_found", "", null, params.languageCode);
        vehicle.readiness = params.readiness;
        await vehicle.save({session: params.session});
        return vehicleToDTO(vehicle);
    }
}
