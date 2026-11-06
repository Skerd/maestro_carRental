import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {setVehicleReadinessFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicle/setVehicleReadiness.form.validator";
import type {SetVehicleReadinessFormType} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {SetVehicleReadinessResult} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.dto";
import {vehicleService} from "@carRentalModule/database/schemas/vehicle/vehicle.service";

export class VehicleActions {
    /** Marks a car ready to go out again (after cleaning), or as needing a check. Counter staff may do this. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 60}, schema: setVehicleReadinessFormSchema})
    async setReadiness(params: TransactionRequiredParams & SetVehicleReadinessFormType): Promise<SetVehicleReadinessResult> {
        const vehicle = await vehicleService.findOneOrThrow({_id: new ObjectId(params._id), company: params.company._id}, {session: params.session, withDeleted: false});
        vehicle.readiness = params.readiness;
        await vehicle.save({session: params.session});
        return {readiness: params.readiness};
    }
}
