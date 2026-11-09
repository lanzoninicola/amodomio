import { describe, expect, it, vi } from "vitest";
import { buildCostImpactGraphForItem } from "~/domain/costs/cost-impact-graph.server";

describe("buildCostImpactGraphForItem", () => {
  it("inclui fichas que referenciam diretamente um item de embalagem", async () => {
    const db = {
      recipeIngredient: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      recipe: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemCostSheet: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      itemCostSheetComponent: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            {
              itemCostSheetId: "sheet-pizza-root",
              ItemCostSheet: {
                id: "sheet-pizza-root",
                baseItemCostSheetId: null,
                itemId: "item-pizza",
              },
            },
          ])
          .mockResolvedValueOnce([]),
      },
      menuItem: {
        findMany: vi.fn().mockResolvedValue([
          { id: "menu-pizza" },
        ]),
      },
    };

    const graph = await buildCostImpactGraphForItem(db, "item-caixa-pizza");

    expect(graph.affectedItemCostSheetIds).toEqual(["sheet-pizza-root"]);
    expect(graph.affectedItemIds).toEqual(["item-caixa-pizza", "item-pizza"]);
    expect(graph.affectedMenuItemIds).toEqual(["menu-pizza"]);
    expect(db.itemCostSheetComponent.findMany).toHaveBeenNthCalledWith(1, {
      where: { type: "item", refId: "item-caixa-pizza" },
      select: {
        itemCostSheetId: true,
        ItemCostSheet: {
          select: {
            id: true,
            baseItemCostSheetId: true,
            itemId: true,
          },
        },
      },
    });
  });
});
