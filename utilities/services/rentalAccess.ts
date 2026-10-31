import {getModelCollectedData} from "@coreModule/database/collections";
import SchemaGuard from "@coreModule/database/security/schemaGuard";
import type {UserContext} from "@coreModule/utilities/types/types";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import RentalReservation from "@carRentalModule/database/schemas/rentalReservation/rentalReservation";

/**
 * Actions get no permission check from the CRUD router: each one requires write
 * access to the reservation field it changes (`status` for lifecycle moves and
 * charges, `amountPaid` for payments), which role packs grant to agents and managers.
 */
export function assertReservationWrite(field: "status" | "amountPaid", actionUserCtx: UserContext, languageCode: string): void {
    const writeFields = SchemaGuard.sanitizeFields(
        RentalReservation,
        getModelCollectedData("rentalreservations").writeFields!,
        "write",
        actionUserCtx,
        languageCode,
    );
    if (!writeFields[field]) {
        throw apiValidationException("user_permissions_not_sufficient", "", null, languageCode);
    }
}
