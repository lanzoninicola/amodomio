import { describe, expect, it } from "vitest";

import {
  BRAZIL_SOCIOECONOMIC_CLASSES,
  getBrazilSocioeconomicClass,
  listBrazilSocioeconomicClasses,
  resolveBrazilSocioeconomicClassByFamilyIncome,
} from "./brazil-socioeconomic-class";

describe("brazil-socioeconomic-class", () => {
  it("returns all classes in marketing order", () => {
    expect(listBrazilSocioeconomicClasses()).toEqual(BRAZIL_SOCIOECONOMIC_CLASSES);
    expect(BRAZIL_SOCIOECONOMIC_CLASSES.map((item) => item.code)).toEqual([
      "A+",
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
  });

  it("finds a class by code", () => {
    expect(getBrazilSocioeconomicClass("C")).toMatchObject({
      code: "C",
      priceSensitivity: "Alta",
      purchaseMotivation: "Preço acessível, utilidade",
    });
  });

  it("resolves family income ranges including boundaries", () => {
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(1500)?.code).toBe("E");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(1500.01)?.code).toBe("D");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(3000)?.code).toBe("D");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(3000.01)?.code).toBe("C");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(7000)?.code).toBe("C");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(7000.01)?.code).toBe("B");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(15000)?.code).toBe("B");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(15000.01)?.code).toBe("A");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(30000)?.code).toBe("A");
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(30000.01)?.code).toBe("A+");
  });

  it("returns null for invalid family income values", () => {
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(null)).toBeNull();
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(undefined)).toBeNull();
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(Number.NaN)).toBeNull();
    expect(resolveBrazilSocioeconomicClassByFamilyIncome(-1)).toBeNull();
  });
});
