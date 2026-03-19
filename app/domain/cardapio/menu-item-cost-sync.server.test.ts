import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllSizes: vi.fn(),
  calculateAllRecommendedCostVariations: vi.fn(),
}));

vi.mock("./menu-item-size.entity.server", () => ({
  menuItemSizePrismaEntity: {
    findAll: mocks.findAllSizes,
  },
}));

vi.mock("./menu-item-cost-variation-utility.entity.server", () => ({
  MenuItemCostVariationUtility: {
    calculateAllRecommendedCostVariations:
      mocks.calculateAllRecommendedCostVariations,
  },
}));

import {
  normalizeVariationToSizeKey,
  syncMenuItemCostsForItems,
} from "~/domain/costs/menu-item-cost-sync.server";

describe("normalizeVariationToSizeKey", () => {
  it("normaliza aliases conhecidos", () => {
    expect(normalizeVariationToSizeKey("media")).toBe("pizza-medium");
    expect(normalizeVariationToSizeKey("familia")).toBe("pizza-bigger");
    expect(normalizeVariationToSizeKey("pizza-big")).toBe("pizza-big");
  });

  it("retorna null para valores desconhecidos", () => {
    expect(normalizeVariationToSizeKey("gigante")).toBeNull();
  });
});

describe("syncMenuItemCostsForItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.findAllSizes.mockResolvedValue([
      { id: "size-medium", key: "pizza-medium" },
      { id: "size-big", key: "pizza-big" },
    ]);
    mocks.calculateAllRecommendedCostVariations.mockReturnValue({
      "pizza-medium": 40,
      "pizza-big": 52,
    });
  });

  it("sincroniza custos do menu item a partir das fichas ativas do item", async () => {
    const db = {
      menuItem: {
        findMany: vi.fn().mockResolvedValue([{ id: "menu-1", itemId: "item-1" }]),
      },
      itemCostSheet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sheet-1",
            itemId: "item-1",
            costAmount: 40,
            ItemVariation: {
              isReference: true,
              Variation: { code: "media", name: "Media" },
            },
          },
          {
            id: "sheet-2",
            itemId: "item-1",
            costAmount: 55,
            ItemVariation: {
              isReference: false,
              Variation: { code: "grande", name: "Grande" },
            },
          },
        ]),
      },
      menuItemCostVariation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: "existing-medium", costAmount: 38 })
          .mockResolvedValueOnce({ id: "existing-big", costAmount: 50 }),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    const result = await syncMenuItemCostsForItems({
      db,
      itemIds: ["item-1"],
      updatedBy: "user:test",
    });

    expect(result.updatedMenuItems).toEqual(["menu-1"]);
    expect(db.menuItemCostVariation.upsert).toHaveBeenCalledTimes(2);
    expect(db.menuItemCostVariation.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          menuItemId_menuItemSizeId: {
            menuItemId: "menu-1",
            menuItemSizeId: "size-medium",
          },
        },
        update: expect.objectContaining({
          costAmount: 40,
          previousCostAmount: 38,
          updatedBy: "user:test",
        }),
      })
    );
    expect(db.menuItemCostVariation.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          menuItemId_menuItemSizeId: {
            menuItemId: "menu-1",
            menuItemSizeId: "size-big",
          },
        },
        update: expect.objectContaining({
          costAmount: 55,
          previousCostAmount: 50,
          updatedBy: "user:test",
        }),
      })
    );
  });
});
