import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyByItemId: vi.fn(),
  findPrimaryVariationForItem: vi.fn(),
  recalcItemCostSheetTotals: vi.fn(),
  createUUID: vi.fn(),
}));

vi.mock("~/domain/item/item-variation.prisma.entity.server", () => ({
  itemVariationPrismaEntity: {
    findManyByItemId: mocks.findManyByItemId,
    findPrimaryVariationForItem: mocks.findPrimaryVariationForItem,
  },
}));

vi.mock("~/domain/costs/item-cost-sheet-recalc.server", () => ({
  recalcItemCostSheetTotals: mocks.recalcItemCostSheetTotals,
}));

vi.mock("~/utils/uuid", () => ({ default: mocks.createUUID }));

import { ensureItemCostSheetForRecipe } from "./recipe-item-cost-sheet.server";

describe("ensureItemCostSheetForRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUUID
      .mockReturnValueOnce("new-root-sheet")
      .mockReturnValueOnce("new-derived-sheet");
    mocks.findManyByItemId.mockResolvedValue([
      { id: "variation-medium" },
      { id: "variation-large" },
    ]);
    mocks.findPrimaryVariationForItem.mockResolvedValue({
      id: "variation-medium",
    });
    mocks.recalcItemCostSheetTotals.mockResolvedValue(undefined);
  });

  it("creates a new draft sheet group containing only the selected recipe", async () => {
    const db = {
      itemCostSheet: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ version: 3 }])
          .mockResolvedValueOnce([
            { id: "new-root-sheet", itemVariationId: "variation-medium" },
            { id: "new-derived-sheet", itemVariationId: "variation-large" },
          ]),
        create: vi.fn().mockResolvedValue({}),
      },
      itemCostSheetComponent: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    await expect(
      ensureItemCostSheetForRecipe({
        db,
        item: { id: "item-1", name: "Delicatissima" },
        recipe: { id: "draft-recipe", name: "Delicatissima nova" },
      })
    ).resolves.toEqual({ rootSheetId: "new-root-sheet" });

    expect(db.itemCostSheet.create).toHaveBeenCalledTimes(2);
    expect(db.itemCostSheet.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        id: "new-root-sheet",
        version: 4,
        status: "draft",
        isActive: false,
        baseItemCostSheetId: null,
      }),
    });
    expect(db.itemCostSheetComponent.create).toHaveBeenCalledTimes(1);
    expect(db.itemCostSheetComponent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemCostSheetId: "new-root-sheet",
        type: "recipe",
        refId: "draft-recipe",
        sortOrderIndex: 0,
      }),
    });
  });

  it("adds supplemental components to the new draft sheet", async () => {
    const db = {
      itemCostSheet: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: "new-root-sheet", itemVariationId: "variation-medium" },
            { id: "new-derived-sheet", itemVariationId: "variation-large" },
          ]),
        create: vi.fn().mockResolvedValue({}),
      },
      itemCostSheetComponent: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    await ensureItemCostSheetForRecipe({
      db,
      item: { id: "item-1", name: "Delicatissima" },
      recipe: { id: "pizza-recipe", name: "Delicatissima" },
      supplementalComponents: [
        {
          type: "recipe",
          refId: "base-recipe",
          name: "Receita Base de pizza romana",
          unit: "receita",
        },
        {
          type: "item",
          refId: "pizza-box",
          name: "Caixa de pizza",
          unit: "UN",
        },
      ],
    });

    expect(db.itemCostSheetComponent.create).toHaveBeenCalledTimes(3);
    expect(db.itemCostSheetComponent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          type: "recipe",
          refId: "base-recipe",
          sortOrderIndex: 1,
        }),
      })
    );
    expect(db.itemCostSheetComponent.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          type: "item",
          refId: "pizza-box",
          sortOrderIndex: 2,
        }),
      })
    );
  });
});
