import {action} from "@coreModule/api/actionDecorator";
import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import type {CarRentalConfig as CarRentalConfigDto} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.dto";
import CarRentalConfig from "./carRentalConfig";
import {carRentalConfigService} from "./carRentalConfig.service";
import {carRentalConfigToDTO} from "@carRentalModule/utilities/mappers/carRentalConfig/carRentalConfigMapper.dto";

export class CarRentalConfigActions {
    /** Get-or-create the company's rental settings; used by the settings page. */
    @action({auth: "private", rateLimit: {windowMs: 60000, max: 60}, transaction: true})
    async ensure(params: Record<string, any>): Promise<CarRentalConfigDto> {
        const {logger, languageCode, session, actionUserCtx, company} = params;

        const existing = await carRentalConfigService.findForCompany(company._id, {session, logger, languageCode});
        if (!existing) {
            SchemaGuard.checkModelPermission(CarRentalConfig, "create", actionUserCtx, languageCode);
        }
        const doc = existing ?? await carRentalConfigService.getOrCreateForCompany(company._id, {
            session,
            logger,
            languageCode,
            auditUserId: actionUserCtx.userId,
        });

        const readFields = SchemaGuard.sanitizeFields(
            CarRentalConfig,
            getModelCollectedData("carrentalconfigs").readFields!,
            "read",
            actionUserCtx,
            languageCode,
        );
        const populate = SchemaGuard.generatePopulate(readFields, CarRentalConfig.schema);
        const populated = await carRentalConfigService.findById(doc._id, {session, logger, languageCode}, populate.populate);
        return carRentalConfigToDTO(populated ?? doc);
    }
}
