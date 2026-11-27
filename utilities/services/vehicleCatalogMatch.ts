/**
 * Matches a car's typed make and model to the platform's vehicle catalog (D199), for the one-off link of existing cars
 * and the demo seed. Never guesses beyond these rules; what does not match stays unlinked and is listed.
 * - the make by name, ignoring case, accents, spaces and hyphens ("Mercedes Benz" = "Mercedes-Benz");
 * - the model by the same name, else by the longest catalog model name that starts the car's model as whole words
 *   ("Octavia Combi" → Octavia, "Tiguan 4Motion" → Tiguan, "5 Series" → 5 Series);
 * - a car's type before a van's, then the rest (the same make and name can be both, e.g. a Multivan).
 */

export type CatalogModelRef = {id: string; make: string; model: string; type: string};

const TYPE_ORDER = ["car", "van", "motorcycle", "truck", "bus"];

/** A name for comparing: lower case, no accents, words split on anything that is not a letter or digit. */
export function catalogWords(value: string): string[] {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

const key = (value: string) => catalogWords(value).join("");

/** An index of the catalog's models by make, built once for many cars. */
export function catalogMatcher(models: CatalogModelRef[]): (make: string, model: string) => CatalogModelRef | undefined {
    const byMake = new Map<string, CatalogModelRef[]>();
    for (const entry of models) {
        const makeKey = key(entry.make);
        byMake.set(makeKey, [...(byMake.get(makeKey) ?? []), entry]);
    }
    const typeRank = (entry: CatalogModelRef) => {
        const rank = TYPE_ORDER.indexOf(entry.type);
        return rank < 0 ? TYPE_ORDER.length : rank;
    };
    return (make, model) => {
        const candidates = byMake.get(key(make)) ?? [];
        const words = catalogWords(model);
        const fits = candidates
            .map((entry) => ({entry, words: catalogWords(entry.model)}))
            .filter((row) => row.words.length > 0 && row.words.length <= words.length && row.words.every((word, i) => word === words[i]))
            // The longest name first (exact before prefix), then a car before a van.
            .sort((a, b) => b.words.length - a.words.length || typeRank(a.entry) - typeRank(b.entry));
        return fits[0]?.entry;
    };
}
