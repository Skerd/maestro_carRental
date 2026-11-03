import * as path from "path";
import {applyPlaceholders, loadEmailStrings} from "@coreModule/utilities/emails/emailLocale";

const LOCALES_ROOT = path.join(__dirname, "..", "emails", "static", "locales");

export type RentalPricingLabelKey =
    | "youngDriver"
    | "additionalDriver"
    | "oneWay"
    | "promo"
    | "account"
    | "crossBorder"
    | "extraKm"
    | "fuel"
    | "refuelService"
    | "lateReturn"
    | "cleaning"
    | "smoking"
    | "damage"
    | "fine"
    | "fineAdmin"
    | "chargeRemoved";

/**
 * Labels for the fee, discount and charge lines the system writes itself. A line
 * keeps its label, so it is written in the language of whoever caused it.
 */
export function rentalPricingLabel(languageCode: string, key: RentalPricingLabelKey, values: Record<string, string> = {}): string {
    return applyPlaceholders(loadEmailStrings(["rentalPricing"], languageCode, LOCALES_ROOT)[key], values);
}
