import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";
import type {VehicleInsurance as VehicleInsuranceDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.dto";
import {statusForExpiry} from "@carRentalModule/utilities/services/vehicleRecords";
import {vehicleInsuranceToDTO} from "@carRentalModule/utilities/mappers/vehicleInsurance/vehicleInsuranceMapper.dto";
import VehicleInsurance, {type IVehicleInsurance} from "./vehicleInsurance";

type ActionParams = TransactionRequiredParams & {_id: string};

async function loadPolicy(params: ActionParams, statuses: IVehicleInsurance["status"][]): Promise<IVehicleInsurance> {
    const policy = ObjectId.isValid(params._id)
        ? await VehicleInsurance.findOne({_id: new ObjectId(params._id), company: params.company._id, deletedAt: null}).session(params.session)
        : null;
    if (!policy) throw apiValidationException("vehicleInsurance_not_found", "", null, params.languageCode);
    if (!statuses.includes(policy.status)) throw apiValidationException("vehicleInsurance_invalid_status", "", null, params.languageCode);
    return policy;
}

export class VehicleInsuranceActions {
    /** Freeze the policy. Dates and amounts stay as they are until it is restored. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async cancel(params: ActionParams): Promise<VehicleInsuranceDto> {
        const policy = await loadPolicy(params, ["active", "expired"]);
        await VehicleInsurance.updateOne({_id: policy._id}, {$set: {status: "cancelled"}}, {session: params.session});
        policy.status = "cancelled";
        return vehicleInsuranceToDTO(policy);
    }

    /** Open it again. A past end date comes back expired; anything else is active. */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: validateSingleForm})
    async uncancel(params: ActionParams): Promise<VehicleInsuranceDto> {
        const policy = await loadPolicy(params, ["cancelled"]);
        const status = statusForExpiry(policy.expiresAt);
        await VehicleInsurance.updateOne(
            {_id: policy._id},
            {$set: {status, expiryReminderSentAt: null}},
            {session: params.session},
        );
        policy.status = status;
        return vehicleInsuranceToDTO(policy);
    }
}
