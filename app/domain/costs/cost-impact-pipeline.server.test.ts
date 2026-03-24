import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildCostImpactGraphForItem: vi.fn(),
  recalcRecipeCosts: vi.fn(),
  recalcItemCostSheetTotals: vi.fn(),
  syncMenuItemCostsForItems: vi.fn(),
  listMenuItemMarginImpactRows: vi.fn(),
}));

vi.mock("~/domain/costs/cost-impact-graph.server", () => ({
  buildCostImpactGraphForItem: mocks.buildCostImpactGraphForItem,
}));

vi.mock("~/domain/costs/recipe-cost-recalc.server", () => ({
  recalcRecipeCosts: mocks.recalcRecipeCosts,
}));

vi.mock("~/domain/costs/item-cost-sheet-recalc.server", () => ({
  recalcItemCostSheetTotals: mocks.recalcItemCostSheetTotals,
}));

vi.mock("~/domain/costs/menu-item-cost-sync.server", () => ({
  syncMenuItemCostsForItems: mocks.syncMenuItemCostsForItems,
}));

vi.mock("~/domain/costs/menu-item-margin-impact.server", () => ({
  listMenuItemMarginImpactRows: mocks.listMenuItemMarginImpactRows,
}));

import {
  resolvePriority,
  runCostImpactPipelineForItemChange,
} from "~/domain/costs/cost-impact-pipeline.server";

describe("resolvePriority", () => {
  it("classifica impactos críticos por margem", () => {
    expect(resolvePriority({ marginGapPerc: 10, priceGapAmount: 0 })).toBe(
      "critical"
    );
  });

  it("classifica impactos altos e baixos corretamente", () => {
    expect(resolvePriority({ marginGapPerc: 5, priceGapAmount: 0 })).toBe(
      "high"
    );
    expect(resolvePriority({ marginGapPerc: 1, priceGapAmount: 1 })).toBe(
      "low"
    );
  });
});

describe("runCostImpactPipelineForItemChange", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.buildCostImpactGraphForItem.mockResolvedValue({
      sourceItemId: "item-1",
      affectedRecipeIds: ["recipe-1", "recipe-2"],
      affectedItemCostSheetIds: ["sheet-1"],
      affectedItemIds: ["item-1", "item-2"],
      affectedMenuItemIds: ["menu-1", "menu-2"],
    });
    mocks.recalcRecipeCosts.mockResolvedValue(undefined);
    mocks.recalcItemCostSheetTotals.mockResolvedValue(undefined);
    mocks.syncMenuItemCostsForItems.mockResolvedValue({
      updatedMenuItems: ["menu-1"],
    });
    mocks.listMenuItemMarginImpactRows.mockResolvedValue([
      {
        menuItemId: "menu-1",
        menuItemName: "Pizza Teste",
        sizeId: "size-1",
        sizeKey: "pizza-medium",
        sizeName: "Media",
        channelId: "channel-1",
        channelKey: "delivery",
        channelName: "Delivery",
        currentCostAmount: 35,
        previousCostAmount: 30,
        sellingPriceAmount: 60,
        profitActualPerc: 18,
        profitExpectedPerc: 25,
        priceExpectedAmount: 64,
        recommendedPriceAmount: 66,
        priceGapAmount: 6,
        marginGapPerc: 7,
      },
    ]);
  });

  it("recalcula dependências, sincroniza menu item e persiste a execução", async () => {
    const db = {
      costImpactRun: {
        create: vi.fn().mockResolvedValue({ id: "run-1" }),
      },
      costImpactMenuItem: {
        create: vi.fn().mockResolvedValue({ id: "impact-1" }),
      },
    } as any;

    const result = await runCostImpactPipelineForItemChange({
      db,
      itemId: "item-1",
      sourceType: "stock-movement-import",
      sourceRefId: "applied-change-1",
      updatedBy: "user:test",
    });

    expect(mocks.buildCostImpactGraphForItem).toHaveBeenCalledWith(db, "item-1");
    expect(mocks.recalcRecipeCosts).toHaveBeenCalledTimes(2);
    expect(mocks.recalcItemCostSheetTotals).toHaveBeenCalledWith(db, "sheet-1");
    expect(mocks.syncMenuItemCostsForItems).toHaveBeenCalledWith({
      db,
      itemIds: ["item-1", "item-2"],
      updatedBy: "user:test",
    });
    expect(mocks.listMenuItemMarginImpactRows).toHaveBeenCalledWith(["menu-1"]);
    expect(db.costImpactRun.create).toHaveBeenCalledTimes(1);
    expect(db.costImpactMenuItem.create).toHaveBeenCalledTimes(1);
    expect(result.updatedRecipes).toBe(2);
    expect(result.updatedItemCostSheets).toBe(1);
  });

  it("não persiste quando as tabelas não estiverem disponíveis", async () => {
    const db = {} as any;

    await runCostImpactPipelineForItemChange({
      db,
      itemId: "item-1",
    });

    expect(mocks.listMenuItemMarginImpactRows).toHaveBeenCalledTimes(1);
  });
});
