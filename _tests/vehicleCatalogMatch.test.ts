import {describe, expect, it} from "vitest";
import {catalogMatcher, type CatalogModelRef} from "@carRentalModule/utilities/services/vehicleCatalogMatch";

const catalog: CatalogModelRef[] = [
    {id: "e", make: "Mercedes-Benz", model: "E-Class", type: "car"},
    {id: "octavia", make: "Škoda", model: "Octavia", type: "car"},
    {id: "tiguan", make: "Volkswagen", model: "Tiguan", type: "car"},
    {id: "multivan-van", make: "Volkswagen", model: "Multivan", type: "van"},
    {id: "multivan-car", make: "Volkswagen", model: "Multivan", type: "car"},
    {id: "5", make: "BMW", model: "5 Series", type: "car"},
    {id: "a3", make: "Audi", model: "A3", type: "car"},
    {id: "a3s", make: "Audi", model: "A3 Sportback", type: "car"},
];
const match = catalogMatcher(catalog);

describe("vehicle catalog matching (D199)", () => {
    it("matches the make ignoring case, accents and hyphens, and the model by name", () => {
        expect(match("mercedes benz", "E-Class")?.id).toBe("e");
        expect(match("Skoda", "Octavia")?.id).toBe("octavia");
        expect(match("BMW", "5 Series")?.id).toBe("5");
    });

    it("takes the longest catalog name that starts the car's model as whole words", () => {
        expect(match("Škoda", "Octavia Combi")?.id).toBe("octavia");
        expect(match("Volkswagen", "Tiguan 4Motion")?.id).toBe("tiguan");
        expect(match("Audi", "A3 Sportback 35 TFSI")?.id).toBe("a3s");
        expect(match("Audi", "A3 Sedan")?.id).toBe("a3");
    });

    it("prefers a car to a van of the same name, and never guesses", () => {
        expect(match("Volkswagen", "Multivan")?.id).toBe("multivan-car");
        expect(match("Volkswagen", "Tig")).toBeUndefined();
        expect(match("Mercedes-Benz", "Class E")).toBeUndefined();
        expect(match("Lada", "Niva")).toBeUndefined();
    });
});
