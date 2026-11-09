import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listRecipeCompositionLines: vi.fn(),
  resolveItemCostSnapshot: vi.fn(),
  registerItemCostEvent: vi.fn(),
}));

vi.mock("~/domain/recipe/recipe-composition.server", () => ({
  listRecipeCompositionLines: mocks.listRecipeCompositionLines,
}));

vi.mock("~/domain/costs/item-cost-snapshot.server", () => ({
  resolveItemCostSnapshot: mocks.resolveItemCostSnapshot,
}));

vi.mock("~/domain/costs/item-cost-event.server", () => ({
  registerItemCostEvent: mocks.registerItemCostEvent,
}));

import {
  roundItemCostSheetMoney,
  calcItemCostSheetTotalCostAmount,
  getRecipeCompositionCostSnapshot,
  recalcItemCostSheetTotals,
  resolveRecipeIngredientCostSnapshot,
} from "~/domain/costs/item-cost-sheet-recalc.server";

describe("roundItemCostSheetMoney", () => {
  it("arredonda para 6 casas decimais", () => {
    expect(roundItemCostSheetMoney(1.1234567890)).toBe(1.123457);
  });

  it("retorna 0 para valor 0", () => {
    expect(roundItemCostSheetMoney(0)).toBe(0);
  });

  it("retorna 0 para undefined/NaN", () => {
    expect(roundItemCostSheetMoney(NaN)).toBe(0);
    expect(roundItemCostSheetMoney(undefined as any)).toBe(0);
  });

  it("mantém valores exatos sem arredondamento desnecessário", () => {
    expect(roundItemCostSheetMoney(1.5)).toBe(1.5);
    expect(roundItemCostSheetMoney(10.123456)).toBe(10.123456);
  });
});

describe("calcItemCostSheetTotalCostAmount", () => {
  it("calcula custo básico sem desperdício", () => {
    expect(calcItemCostSheetTotalCostAmount(10, 2, 0)).toBe(20);
  });

  it("aplica percentual de desperdício corretamente", () => {
    // 10 * 2 * (1 + 10/100) = 22
    expect(calcItemCostSheetTotalCostAmount(10, 2, 10)).toBe(22);
  });

  it("aplica desperdício de 50%", () => {
    // 5 * 4 * 1.5 = 30
    expect(calcItemCostSheetTotalCostAmount(5, 4, 50)).toBe(30);
  });

  it("retorna 0 quando unitCostAmount é 0", () => {
    expect(calcItemCostSheetTotalCostAmount(0, 10, 20)).toBe(0);
  });

  it("retorna 0 quando quantity é 0", () => {
    expect(calcItemCostSheetTotalCostAmount(10, 0, 20)).toBe(0);
  });

  it("trata valores undefined/null como 0", () => {
    expect(calcItemCostSheetTotalCostAmount(undefined as any, 5, 0)).toBe(0);
    expect(calcItemCostSheetTotalCostAmount(10, undefined as any, 0)).toBe(0);
    expect(calcItemCostSheetTotalCostAmount(10, 5, null as any)).toBe(50);
  });

  it("arredonda resultado para 6 casas decimais", () => {
    const result = calcItemCostSheetTotalCostAmount(1.333333, 3, 0);
    expect(result).toBe(3.999999);
  });
});

describe("recalcItemCostSheetTotals", () => {
  let db: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mocks.listRecipeCompositionLines.mockResolvedValue([]);
    mocks.resolveItemCostSnapshot.mockResolvedValue({
      lastUnitCostAmount: 0,
      avgUnitCostAmount: 0,
    });
    mocks.registerItemCostEvent.mockResolvedValue(undefined);

    db = {
      itemCostSheet: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      itemCostSheetComponent: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      itemCostSheetVariationComponent: {
        update: vi.fn().mockResolvedValue({}),
      },
      itemVariation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      recipe: {
        findUnique: vi.fn(),
      },
      item: {
        findUnique: vi.fn(),
      },
      itemCostVariation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it("retorna rootSheetId null quando ficha não existe", async () => {
    db.itemCostSheet.findUnique.mockResolvedValue(null);

    const result = await recalcItemCostSheetTotals(db, "sheet-999");
    expect(result).toEqual({ rootSheetId: null, updatedSheets: 0 });
  });

  it("retorna updatedSheets 0 quando não há variações no grupo", async () => {
    db.itemCostSheet.findUnique.mockResolvedValue({
      id: "root-1",
      itemVariationId: "var-1",
      baseItemCostSheetId: null,
    });
    db.itemCostSheet.findMany.mockResolvedValue([]);

    const result = await recalcItemCostSheetTotals(db, "root-1");
    expect(result.updatedSheets).toBe(0);
    expect(result.rootSheetId).toBe("root-1");
  });

  it("resolve rootSheetId a partir de ficha de variação", async () => {
    db.itemCostSheet.findUnique.mockResolvedValue({
      id: "var-sheet-1",
      itemVariationId: "var-1",
      baseItemCostSheetId: "root-1",
    });
    db.itemCostSheet.findMany
      .mockResolvedValueOnce([
        { id: "root-1", itemVariationId: null },
        { id: "var-sheet-1", itemVariationId: "var-1" },
      ])
      .mockResolvedValueOnce([]);
    db.itemCostVariation.findMany.mockResolvedValue([]);

    const result = await recalcItemCostSheetTotals(db, "var-sheet-1");
    expect(result.rootSheetId).toBe("root-1");
    expect(result.updatedSheets).toBe(2);
  });

  it("atualiza custo da ficha com soma dos componentes de variação", async () => {
    db.itemCostSheet.findUnique.mockResolvedValue({
      id: "root-1",
      itemVariationId: null,
      baseItemCostSheetId: null,
    });

    const groupSheets = [
      { id: "root-1", itemVariationId: null },
      { id: "var-sheet-1", itemVariationId: "var-1" },
    ];

    const components = [
      {
        id: "comp-1",
        itemCostSheetId: "root-1",
        type: "manual",
        refId: null,
        sortOrderIndex: 0,
        ItemCostSheetVariationComponent: [
          { id: "vc-1", itemVariationId: null, totalCostAmount: 15, quantity: 1, wastePerc: 0 },
          { id: "vc-2", itemVariationId: "var-1", totalCostAmount: 20, quantity: 1, wastePerc: 0 },
        ],
      },
    ];

    db.itemCostSheet.findMany.mockResolvedValue(groupSheets);
    // ambas as chamadas a itemCostSheetComponent.findMany retornam os mesmos dados
    db.itemCostSheetComponent.findMany.mockResolvedValue(components);
    db.itemCostVariation.findMany.mockResolvedValue([]);

    await recalcItemCostSheetTotals(db, "root-1");

    const updateCalls = db.itemCostSheet.update.mock.calls;
    const rootUpdate = updateCalls.find((c: any) => c[0].where.id === "root-1");
    const varUpdate = updateCalls.find((c: any) => c[0].where.id === "var-sheet-1");

    expect(rootUpdate[0].data.costAmount).toBe(15);
    expect(varUpdate[0].data.costAmount).toBe(20);
  });

  it("pula componente recipeSheet quando refId é o próprio rootSheetId (evita loop)", async () => {
    db.itemCostSheet.findUnique.mockResolvedValue({
      id: "root-1",
      itemVariationId: null,
      baseItemCostSheetId: null,
    });

    db.itemCostSheet.findMany
      .mockResolvedValueOnce([{ id: "root-1", itemVariationId: null }])
      .mockResolvedValueOnce([]);

    db.itemCostSheetComponent.findMany.mockResolvedValue([
      {
        id: "comp-self",
        type: "recipeSheet",
        refId: "root-1",
        ItemCostSheetVariationComponent: [
          { id: "vc-1", itemVariationId: null, quantity: 1, wastePerc: 0 },
        ],
      },
    ]);

    db.itemCostVariation.findMany.mockResolvedValue([]);

    await recalcItemCostSheetTotals(db, "root-1");

    expect(db.itemCostSheetVariationComponent.update).not.toHaveBeenCalled();
  });

  it("recalcula linha item referenciada usando o custo atual do item", async () => {
    db.itemCostSheet.findUnique.mockResolvedValue({
      id: "root-1",
      itemVariationId: "var-pizza",
      baseItemCostSheetId: null,
    });
    db.itemCostSheet.findMany
      .mockResolvedValueOnce([{ id: "root-1", itemVariationId: "var-pizza" }])
      .mockResolvedValueOnce([]);
    db.itemCostSheetComponent.findMany.mockResolvedValue([
      {
        id: "comp-packaging",
        type: "item",
        refId: "item-packaging",
        ItemCostSheetVariationComponent: [
          {
            id: "vc-packaging",
            itemVariationId: "var-pizza",
            quantity: 1,
            wastePerc: 10,
            totalCostAmount: 0,
          },
        ],
      },
    ]);
    db.item.findUnique.mockResolvedValue({
      id: "item-packaging",
      name: "Caixa pizza",
      classification: "embalagem",
      purchaseUm: "UN",
      consumptionUm: "UN",
    });
    mocks.resolveItemCostSnapshot.mockResolvedValue({
      itemVariationId: "packaging-var",
      lastUnitCostAmount: 1.5,
      avgUnitCostAmount: 2,
      averageWindowDays: 30,
      historyCount: 3,
    });

    await recalcItemCostSheetTotals(db, "root-1");

    expect(db.itemCostSheetVariationComponent.update).toHaveBeenCalledWith({
      where: { id: "vc-packaging" },
      data: {
        unit: "UN",
        unitCostAmount: 2,
        totalCostAmount: 2.2,
      },
    });
    expect(db.itemCostSheetComponent.update).toHaveBeenCalledWith({
      where: { id: "comp-packaging" },
      data: {
        name: "Caixa pizza",
        notes: "snapshot item: custo=2.0000 janela=30d amostras=3",
      },
    });
  });

  it("usa a ficha ativa da subreceita quando o ingrediente não possui custo próprio", async () => {
    mocks.resolveItemCostSnapshot.mockResolvedValue({
      itemVariationId: "ingredient-var-no-cost",
      lastUnitCostAmount: 0,
      avgUnitCostAmount: 0,
    });

    db.itemVariation.findFirst
      .mockResolvedValueOnce({
        id: "subrecipe-var-medium",
        recipeId: "recipe-sub-bacon",
      });
    db.itemCostSheet.findFirst = vi.fn().mockResolvedValue({
      id: "active-subrecipe-sheet",
      costAmount: 18.5,
      activatedAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const result = await resolveRecipeIngredientCostSnapshot({
      db,
      itemId: "ingredient-item-bacon",
      variationId: "size-medium",
    });

    expect(result.avgUnitCostAmount).toBe(18.5);
    expect(result.lastUnitCostAmount).toBe(18.5);
    expect(db.itemVariation.findFirst).toHaveBeenCalledWith({
      where: {
        itemId: "ingredient-item-bacon",
        variationId: "size-medium",
        deletedAt: null,
        recipeId: { not: null },
      },
      select: {
        id: true,
        recipeId: true,
      },
    });
  });

  function makeSubrecipeSetup(activeSheet: object | null) {
    mocks.resolveItemCostSnapshot.mockResolvedValueOnce({
      itemVariationId: "ingredient-var-no-cost",
      lastUnitCostAmount: 0,
      avgUnitCostAmount: 0,
    });
    db.itemVariation.findFirst.mockResolvedValueOnce({
      id: "subrecipe-var-medium",
      recipeId: "recipe-sub-bacon",
    });
    db.itemCostSheet.findFirst = vi.fn().mockResolvedValue(activeSheet);
    db.recipe.findUnique.mockResolvedValue({
      id: "recipe-sub-bacon",
      name: "Bacon desfiado",
    });
    db.itemVariation.findUnique.mockResolvedValue({
      variationId: "size-medium",
    });
    mocks.listRecipeCompositionLines.mockResolvedValue([
      {
        id: "line-subing",
        recipeId: "recipe-sub-bacon",
        itemId: "item-raw-bacon",
        unit: "KG",
        quantity: 1,
        defaultLossPct: 0,
        lossPct: 0,
        sortOrderIndex: 0,
        notes: null,
        ItemVariation: { variationId: "size-medium" },
      },
    ]);
    mocks.resolveItemCostSnapshot.mockResolvedValue({
      itemVariationId: "raw-bacon-var",
      lastUnitCostAmount: 25,
      avgUnitCostAmount: 25,
    });
  }

  it("calcula composição dinamicamente quando subreceita não tem ficha técnica vinculada", async () => {
    makeSubrecipeSetup(null);

    const result = await resolveRecipeIngredientCostSnapshot({
      db,
      itemId: "ingredient-item-bacon",
      variationId: "size-medium",
    });

    expect(result.avgUnitCostAmount).toBe(25);
    expect(result.lastUnitCostAmount).toBe(25);
  });

  it("calcula composição dinamicamente quando ficha ativa da subreceita tem custo zero", async () => {
    makeSubrecipeSetup({
      id: "active-subrecipe-sheet",
      costAmount: 0,
      activatedAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const result = await resolveRecipeIngredientCostSnapshot({
      db,
      itemId: "ingredient-item-bacon",
      variationId: "size-medium",
    });

    expect(result.avgUnitCostAmount).toBe(25);
    expect(result.lastUnitCostAmount).toBe(25);
  });

  it("calcula receita usando custo da ficha ativa da subreceita vinculada", async () => {
    db.recipe.findUnique.mockResolvedValue({
      id: "recipe-main",
      name: "Receita principal",
    });
    db.itemVariation.findUnique.mockResolvedValue({
      variationId: "size-medium",
    });
    db.itemVariation.findFirst
      .mockResolvedValueOnce({
        id: "subrecipe-var-medium",
        recipeId: "recipe-sub-bacon",
      });
    db.itemCostSheet.findFirst = vi.fn().mockResolvedValue({
      id: "active-subrecipe-sheet",
      costAmount: 10,
      activatedAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    mocks.listRecipeCompositionLines.mockResolvedValue([
      {
        id: "line-bacon",
        recipeId: "recipe-main",
        recipeIngredientId: "ingredient-bacon",
        itemId: "item-bacon",
        unit: "KG",
        quantity: 0.04,
        defaultLossPct: 0,
        lossPct: 0,
        sortOrderIndex: 0,
        notes: null,
        lastUnitCostAmount: 0,
        avgUnitCostAmount: 0,
        lastTotalCostAmount: 0,
        avgTotalCostAmount: 0,
        Item: {
          id: "item-bacon",
          name: "Bacon defumado desfiado",
        },
        ItemVariation: {
          id: "ingredient-var-bacon",
          variationId: "size-medium",
          Variation: {
            id: "size-medium",
            name: "Tamanho Medio",
          },
        },
      },
    ]);
    mocks.resolveItemCostSnapshot.mockResolvedValue({
      itemVariationId: "ingredient-var-bacon",
      lastUnitCostAmount: 0,
      avgUnitCostAmount: 0,
    });

    const snapshot = await getRecipeCompositionCostSnapshot(
      db,
      "recipe-main",
      "owner-var-medium"
    );

    expect(snapshot.unitCostAmount).toBe(0.4);
    expect(snapshot.avgTotal).toBe(0.4);
    expect(snapshot.lastTotal).toBe(0.4);
  });
});
