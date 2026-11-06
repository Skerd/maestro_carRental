import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import type {TransactionRequiredParams} from "@coreModule/utilities/middlewares/transactionUtils";
import {addMoney, roundToCurrency, subtractMoney} from "armonia/src/modules/core/helpers/money";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {chargeVehicleDamageFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/chargeVehicleDamage.form.validator";
import {scheduleVehicleDamageRepairFormSchema} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/scheduleVehicleDamageRepair.form.validator";
import type {
    ChargeVehicleDamageFormType,
    ScheduleVehicleDamageRepairFormType,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.schema-def";
import type {VehicleDamage as VehicleDamageDto} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.dto";
import VehicleDamage, {type IVehicleDamage} from "./vehicleDamage";
import RentalReservation from "../rentalReservation/rentalReservation";
import RentalExtra from "../rentalExtra/rentalExtra";
import VehicleMaintenance, {type IVehicleMaintenance} from "../vehicleMaintenance/vehicleMaintenance";
import {vehicleMaintenanceService} from "../vehicleMaintenance/vehicleMaintenance.service";
import {vehicleDamageToDTO} from "@carRentalModule/utilities/mappers/vehicleDamage/vehicleDamageMapper.dto";
import {nestedEntityToRef} from "@coreModule/utilities/mappers/common.mapper";
import {addReservationCharges} from "@carRentalModule/workflows/rentalLifecycle";
import {rentalPricingLabel} from "@carRentalModule/utilities/services/rentalPricingLabels";
import {blockForService} from "@carRentalModule/utilities/services/vehicleRecords";

type ActionParams<F> = TransactionRequiredParams & F;

const DESCRIPTION_IN_LABEL_MAX = 60;

/** A scheduled repair record for one damage, blocking the car until `readyAt` when given. */
async function newRepair(damage: IVehicleDamage, vehicleId: ObjectId, params: ActionParams<ScheduleVehicleDamageRepairFormType>): Promise<IVehicleMaintenance> {
    const {company, session, languageCode} = params;
    if (!params.serviceDate) throw apiValidationException("vehicle_repair_date_required", "", null, languageCode);
    const serviceDate = new Date(params.serviceDate);
    const readyAt = params.readyAt ? new Date(params.readyAt) : undefined;
    const block = readyAt ? await blockForService({vehicleId, type: "repair", serviceDate, readyAt}, {companyId: company._id, session, languageCode}) : undefined;
    return vehicleMaintenanceService.create(
        {
            company: company._id,
            vehicle: vehicleId,
            type: "repair",
            status: "scheduled",
            serviceDate,
            readyAt,
            block,
            provider: params.provider,
            cost: params.cost ?? damage.estimatedCost,
            description: damage.description,
            damages: [damage._id],
        },
        {session, logger: params.logger, languageCode, auditUserId: params.actionUserCtx.userId},
    );
}

export class VehicleDamageActions {
    /**
     * Sends the car to repair for an open damage: a new scheduled repair record (with
     * a block until `readyAt`), or an existing scheduled repair of the same car. The
     * repair's complete and cancel actions then move the damage on.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: scheduleVehicleDamageRepairFormSchema})
    async scheduleRepair(params: ActionParams<ScheduleVehicleDamageRepairFormType>): Promise<VehicleDamageDto> {
        const {company, session, languageCode} = params;
        const damage = ObjectId.isValid(params._id)
            ? await VehicleDamage.findOne({_id: new ObjectId(params._id), company: company._id, deletedAt: null}).session(session)
            : null;
        if (!damage) throw apiValidationException("vehicleDamage_not_found", "", null, languageCode);
        if (damage.status !== "open") throw apiValidationException("vehicle_damage_not_open", "", null, languageCode);
        const vehicleId = nestedEntityToRef(damage.vehicle)!;

        const repair = params.repair
            ? await VehicleMaintenance.findOneAndUpdate(
                  {_id: new ObjectId(String(params.repair)), company: company._id, vehicle: vehicleId, type: "repair", status: "scheduled", deletedAt: null},
                  {$addToSet: {damages: damage._id}},
                  {session},
              )
            : await newRepair(damage, vehicleId, params);
        if (!repair) throw apiValidationException("vehicle_repair_not_found", "", null, languageCode);
        damage.status = "in_repair";
        damage.repair = repair._id;
        await damage.save({session});
        return vehicleDamageToDTO(damage);
    }

    /**
     * Charges the customer of the linked booking for the repair. With a protection
     * package, all damage charges on the booking together never exceed its excess.
     */
    @action({auth: "private", transaction: true, rateLimit: {windowMs: 60000, max: 30}, schema: chargeVehicleDamageFormSchema})
    async chargeToCustomer(params: ActionParams<ChargeVehicleDamageFormType>): Promise<VehicleDamageDto> {
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
        let amount = roundToCurrency(params.amount);
        if (protection?.excessAmount !== undefined) {
            const charged = addMoney(...reservation.pricing.lines.filter((line) => line.code === "damage").map((line) => line.total));
            amount = Math.min(amount, Math.max(0, subtractMoney(protection.excessAmount, charged)));
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
