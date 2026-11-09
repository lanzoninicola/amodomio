import { describe, expect, it } from "vitest";
import {
  applyPreparationsToPlan,
  calculateProductionTotals,
  calculateProductionPlan,
  convertQuantity,
  formatProductionQuantity,
} from "./production-order-calc";

const ingredients = [
  { id: "f", name: "Farinha", quantity: 10, unit: "KG" },
  { id: "a", name: "Água", quantity: 7, unit: "KG" },
  { id: "s", name: "Sal", quantity: 0.2, unit: "KG" },
  { id: "y", name: "Fermento", quantity: 0.05, unit: "KG" },
];
const preparations = [
  {
    id: "t",
    name: "Tangzhong",
    ingredients: [
      { recipeIngredientId: "f", quantity: 0.5 },
      { recipeIngredientId: "a", quantity: 2.5 },
    ],
  },
  {
    id: "b",
    name: "Biga",
    ingredients: [
      { recipeIngredientId: "f", quantity: 3 },
      { recipeIngredientId: "a", quantity: 1.35 },
      { recipeIngredientId: "y", quantity: 0.03 },
    ],
  },
  {
    id: "au",
    name: "Autólise",
    ingredients: [
      { recipeIngredientId: "f", quantity: 4 },
      { recipeIngredientId: "a", quantity: 2.6 },
    ],
  },
];

describe("calculateProductionPlan", () => {
  it("subtrai todas as preparações", () => {
    const plan = calculateProductionPlan({
      ingredients,
      preparations,
      baseIngredientId: "f",
      baseQuantity: 10,
    });
    const rest = Object.fromEntries(
      plan.final.ingredients.map((i) => [i.id, i.quantity])
    );
    expect(rest.f).toBeCloseTo(2.5);
    expect(rest.a).toBeCloseTo(0.55);
    expect(rest.s).toBeCloseTo(0.2);
    expect(rest.y).toBeCloseTo(0.02);
    expect(plan.inconsistencies).toEqual([]);
  });

  it("escala proporcionalmente", () => {
    const plan = calculateProductionPlan({
      ingredients,
      preparations,
      baseIngredientId: "f",
      baseQuantity: 5,
    });
    expect(plan.preparations[1].ingredients[0].quantity).toBeCloseTo(1.5);
  });

  it("receita simples não tem preparações", () => {
    const plan = calculateProductionPlan({
      ingredients,
      preparations: [],
      baseIngredientId: "f",
      baseQuantity: 20,
    });
    expect(plan.final.ingredients).toHaveLength(4);
    expect(plan.final.ingredients[1].quantity).toBeCloseTo(14);
  });

  it("detecta inconsistência", () => {
    const plan = calculateProductionPlan({
      ingredients,
      preparations: [
        ...preparations,
        { id: "x", name: "Extra", ingredients: [{ recipeIngredientId: "f", quantity: 5 }] },
      ],
      baseIngredientId: "f",
      baseQuantity: 10,
    });
    expect(plan.inconsistencies.length).toBe(1);
  });

  it("aceita qualquer ingrediente-base", () => {
    const plan = calculateProductionPlan({
      ingredients,
      preparations: [],
      baseIngredientId: "a",
      baseQuantity: 14,
    });
    expect(plan.scaleFactor).toBe(2);
  });
});

describe("units", () => {
  it("converte e formata", () => {
    expect(convertQuantity(500, "G", "KG")).toBe(0.5);
    expect(convertQuantity(1, "UN", "KG")).toBeNull();
    expect(formatProductionQuantity(0.5, "KG")).toEqual({ value: "500", unit: "g" });
    expect(formatProductionQuantity(2.5, "KG")).toEqual({ value: "2,5", unit: "kg" });
  });
});


describe("invalid production formulas", () => {
  it.each([-1, NaN, Infinity])("rejects invalid recipe quantity %s", (quantity) => {
    expect(() => calculateProductionPlan({
      ingredients: [...ingredients, { id: "bad", name: "Inválido", quantity, unit: "KG" }],
      preparations: [], baseIngredientId: "f", baseQuantity: 10,
    })).toThrow("quantidade inválida");
  });
  it("rejects preparations referring to removed ingredients", () => {
    expect(() => calculateProductionPlan({
      ingredients, baseIngredientId: "f", baseQuantity: 10,
      preparations: [{ id: "p", name: "Biga", ingredients: [{ recipeIngredientId: "removed", quantity: 1 }] }],
    })).toThrow("não encontrado");
  });
  it("rejects overflow when scaling", () => {
    expect(() => calculateProductionPlan({
      ingredients: [{ id: "f", name: "Farinha", quantity: Number.MIN_VALUE, unit: "KG" }],
      preparations: [], baseIngredientId: "f", baseQuantity: Number.MAX_VALUE,
    })).toThrow();
  });
});

describe("duas fases", () => {
  it("fase 1 só calcula totais e fase 2 aplica preparações absolutas", () => {
    const totals = calculateProductionTotals({
      ingredients,
      baseIngredientId: "f",
      baseQuantity: 10,
    });
    expect(totals.preparationsDefined).toBe(false);
    expect(totals.preparations).toEqual([]);
    expect(totals.final.ingredients).toHaveLength(4);
    const plan = applyPreparationsToPlan(totals, [
      { id: "p1", name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 3 }] },
      { id: "p2", name: "Poolish", ingredients: [{ recipeIngredientId: "f", quantity: 2 }] },
    ]);
    expect(plan.preparationsDefined).toBe(true);
    expect(plan.final.ingredients.find((i) => i.id === "f")!.quantity).toBeCloseTo(5);
    expect(plan.inconsistencies).toEqual([]);
  });

  it("detecta excesso na fase 2", () => {
    const totals = calculateProductionTotals({ ingredients, baseIngredientId: "f", baseQuantity: 10 });
    const plan = applyPreparationsToPlan(totals, [
      { id: "p1", name: "Biga", ingredients: [{ recipeIngredientId: "f", quantity: 11 }] },
    ]);
    expect(plan.inconsistencies).toHaveLength(1);
  });
});
