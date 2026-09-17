import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  itemCostSheet: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  itemVariation: { findMany: vi.fn() },
  itemCostSheetComponent: { findFirst: vi.fn(), findMany: vi.fn() },
  recipe: { findFirst: vi.fn() },
}));
vi.mock("~/lib/prisma/client.server", () => ({ default: db }));
vi.mock("~/domain/costs/item-cost-sheet-recalc.server", () => ({}));
vi.mock("~/domain/recipe/recipe-composition.server", () => ({}));
import { action } from "./admin.item-cost-sheets.$id";

function activate(sheetId = "root") {
  return action({
    request: new Request("http://localhost/admin/item-cost-sheets/root", {
      method: "POST",
      body: new URLSearchParams({
        _action: "item-cost-sheet-activate",
        itemCostSheetId: sheetId,
      }),
    }),
    params: { id: "root" },
    context: {},
  });
}

describe("activate cost sheet from item list", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.itemCostSheet.findUnique.mockResolvedValue({
      id: "root",
      itemId: "item",
      baseItemCostSheetId: null,
    });
    db.itemCostSheet.findMany.mockResolvedValue([]);
    db.itemVariation.findMany.mockResolvedValue([]);
    db.itemCostSheetComponent.findFirst.mockResolvedValue(null);
    db.itemCostSheet.updateMany.mockResolvedValue({ count: 2 });
  });

  it("activates the group without overwriting its name, description or notes", async () => {
    const response = await activate();
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(db.itemCostSheet.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "root" }, { baseItemCostSheetId: "root" }] },
      data: { isActive: true, status: "active", activatedAt: expect.any(Date) },
    });
  });

  it("blocks activation when a referenced recipe is not active", async () => {
    db.itemCostSheetComponent.findFirst.mockResolvedValue({ refId: "recipe" });
    db.itemCostSheetComponent.findMany.mockResolvedValue([{ refId: "recipe" }]);
    db.recipe.findFirst.mockResolvedValue({ name: "Massa", version: 2 });
    const response = await activate();
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(
      "Ative a receita Massa v2"
    );
    expect(db.itemCostSheet.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a mismatched sheet id", async () => {
    expect((await activate("other")).status).toBe(400);
    expect(db.itemCostSheet.updateMany).not.toHaveBeenCalled();
  });
});
