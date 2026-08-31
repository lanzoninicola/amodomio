import { describe, expect, it, vi } from "vitest";
import { countRecipeCostSheetUsage } from "./recipe-cost-sheet-usage.server";

describe("recipe cost sheet usage", () => {
  it("does not infer a cost sheet from item variations for a draft recipe", async () => {
    const db = {
      recipe: {
        findUnique: vi.fn().mockResolvedValue({ status: "draft" }),
      },
      itemCostSheetComponent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemCostSheetLine: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemCostSheet: {
        findMany: vi.fn(),
      },
    };

    await expect(countRecipeCostSheetUsage(db, "recipe-draft")).resolves.toBe(
      0
    );
    expect(db.itemCostSheet.findMany).not.toHaveBeenCalled();
  });

  it("keeps exact component references visible for a draft recipe", async () => {
    const db = {
      recipe: {
        findUnique: vi.fn().mockResolvedValue({ status: "draft" }),
      },
      itemCostSheetComponent: {
        findMany: vi.fn().mockResolvedValue([
          {
            itemCostSheetId: "sheet-1",
            ItemCostSheet: { id: "sheet-1", baseItemCostSheetId: null },
          },
        ]),
      },
      itemCostSheetLine: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemCostSheet: {
        findMany: vi.fn(),
      },
    };

    await expect(countRecipeCostSheetUsage(db, "recipe-draft")).resolves.toBe(
      1
    );
  });
});
