import type {VehicleColor} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

/**
 * A typed colour's code (D199), for moving free-text colours onto the colour list: the colour words of the 5 panel
 * languages and a few common variants ("Gray", "Dark blue", "Argjendi"). Never guesses: no known word, no code.
 */
const COLOR_WORDS: Record<Exclude<VehicleColor, "other">, string[]> = {
    white: ["Bianco", "Blanc", "E bardhë", "Weiss", "White", "bianca", "blanche", "pearl", "perla"],
    black: ["Black", "E zezë", "Nero", "Noir", "Schwarz", "nera", "noire"],
    silver: ["Argent", "Argento", "Argjendi", "Silber", "Silver", "argento", "argjend", "silber"],
    grey: ["Grau", "Grey", "Gri", "Grigio", "Gris", "anthracite", "antracit", "graphite", "gray"],
    blue: ["Blau", "Bleu", "Blu", "Blue", "azzurro", "bleu", "navy"],
    red: ["E kuqe", "Red", "Rosso", "Rot", "Rouge", "bordeaux", "burgundy", "maroon"],
    green: ["Green", "Grün", "Jeshile", "Verde", "Vert", "jeshile e errët", "olive"],
    beige: ["Beige", "Bezhë", "champagne", "sand"],
    brown: ["Braun", "Brown", "Kafe", "Marron", "Marrone", "bronze", "bronzo"],
    yellow: ["E verdhë", "Gelb", "Giallo", "Jaune", "Yellow"],
    orange: ["Arancione", "Orange", "Portokalli"],
    gold: ["Ari", "Gold", "Or", "Oro", "dorato", "golden"],
    purple: ["Purple", "Viola", "Violet", "Violett", "Vjollcë", "viola", "violet"],
};

const plain = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function vehicleColorCode(typed: string | undefined | null): VehicleColor | undefined {
    if (!typed?.trim()) return undefined;
    const text = plain(typed);
    const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
    for (const [code, names] of Object.entries(COLOR_WORDS) as [VehicleColor, string[]][]) {
        // A whole phrase ("e bardhe", "jeshile e erret") or one word ("blau") of it.
        if (names.some((name) => { const known = plain(name); return known.includes(" ") ? text.includes(known) : words.has(known); })) return code;
    }
    return undefined;
}
