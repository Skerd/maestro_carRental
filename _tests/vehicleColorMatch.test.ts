import {describe, expect, it} from "vitest";
import {vehicleColorCode} from "@carRentalModule/utilities/services/vehicleColorMatch";

describe("typed colours onto the colour list (D199)", () => {
    it("knows the colour words of the 5 languages and common variants", () => {
        expect(vehicleColorCode("E bardhë")).toBe("white");
        expect(vehicleColorCode("Jeshile e errët")).toBe("green");
        expect(vehicleColorCode("Blu e errët")).toBe("blue");
        expect(vehicleColorCode("Argjendi")).toBe("silver");
        expect(vehicleColorCode("Schwarz")).toBe("black");
        expect(vehicleColorCode("Gray metallic")).toBe("grey");
        expect(vehicleColorCode("rosso")).toBe("red");
    });

    it("never guesses", () => {
        expect(vehicleColorCode("Mystic")).toBeUndefined();
        expect(vehicleColorCode("")).toBeUndefined();
        expect(vehicleColorCode(undefined)).toBeUndefined();
    });
});
