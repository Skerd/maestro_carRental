import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {roundMoney} from "@coreModule/utilities/helpers/money";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {chargeVehicleDamageFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/chargeVehicleDamage.form.validator";
import type {ChargeVehicleDamageFormType} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.schema-def";
import type {VehicleDamage as VehicleDamageDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.dto";
import VehicleDamage from "./vehicleDamage";
import RentalReservation from "../rentalReservation/rentalReservation";
import RentalExtra from "../rentalExtra/rentalExtra";
import {vehicleDamageToDTO} from "@carRentalModule/utilities/mappers/vehicleDamage/vehicleDamageMapper.dto";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {assertReservationWrite} from "@carRentalModule/utilities/services/rentalAccess";
import {addReservationCharges} from "@carRentalModule/utilities/services/rentalLifecycle";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";

type ActionParams<F> = TransactionRequiredParams & F;

const DESCRIPTION_IN_LABEL_MAX = 60;

export class VehicleDamageActions {
    /**
     * Charges the customer of the linked booking for the repair. With a protection
     * package, all damage charges on the booking together never exceed its excess.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: chargeVehicleDamageFormSchema})
    async chargeToCustomer(params: ActionParams<ChargeVehicleDamageFormType>): Promise<VehicleDamageDto> {
        assertReservationWrite("status", params.actionUserCtx, params.languageCode);
        const {company, session, languageCode} = params;
        const damage = ObjectId.isValid(params._id)
            ? await VehicleDamage.findOne({_id: new ObjectId(params._id), company: company._id, deletedAt: null}).session(session)
            : null;
        if (!damage) throw apiValidationException("vehicleDamage_not_found", "", null, languageCode);
        const reservation = damage.reservation
            ? await RentalReservation.findOne({_id: nestedEntityToRef(damage.reservation), company: company._id, deletedAt: null}).session(session)
            : null;
        if (!reservation) throw apiValidationException("vehicle_damage_no_reservation", "", null, languageCode);
        if (damage.chargedAmount) throw apiValidationException("vehicle_damage_already_charged", "", null, languageCode);

        const protection = await RentalExtra.findOne({
            _id: {$in: reservation.extras.map((line) => nestedEntityToRef(line.extra))},
            kind: "protection",
        }).select("excessAmount").session(session);
        let amount = roundMoney(params.amount);
        if (protection?.excessAmount !== undefined) {
            const charged = reservation.pricing.lines.filter((line) => line.code === "damage").reduce((sum, line) => sum + line.total, 0);
            amount = roundMoney(Math.min(amount, Math.max(0, protection.excessAmount - charged)));
            if (amount <= 0) throw apiValidationException("vehicle_damage_excess_reached", "", null, languageCode);
        }

        const description = damage.description.length > DESCRIPTION_IN_LABEL_MAX ? `${damage.description.slice(0, DESCRIPTION_IN_LABEL_MAX - 1)}…` : damage.description;
        const by = new ObjectId(params.actionUserCtx.userId);
        const ctx = {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId};
        await addReservationCharges(reservation, [{code: "damage", label: rentalPricingLabel(languageCode, "damage", {description}), amount}], {by}, ctx);
        damage.chargedAmount = amount;
        damage.chargedAt = new Date();
        await damage.save({session});
        return vehicleDamageToDTO(damage);
    }
}
