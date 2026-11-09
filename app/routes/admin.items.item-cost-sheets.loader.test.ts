import { describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { itemCostSheetComponent: { findMany } },
}));
import { loader } from "./admin.items.$id.item-cost-sheets";

describe("item cost sheet composition streaming", () => {
  it("converts Prisma's lazy thenable into a tracked promise resolving to rows", async () => {
    const rows = [
      {
        id: "component",
        itemCostSheetId: "sheet",
        name: "Massa",
        type: "recipe",
      },
    ];
    const thenable = {
      then: (resolve: (value: typeof rows) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    findMany.mockReturnValue(thenable);
    const result = loader({ params: { id: "item" } } as any);
    expect(result.data.composition).toBeInstanceOf(Promise);
    expect(result.pendingKeys).toContain("composition");
    expect(await result.data.composition).toEqual(rows);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ItemCostSheet: { itemId: "item" } } })
    );
  });
});
