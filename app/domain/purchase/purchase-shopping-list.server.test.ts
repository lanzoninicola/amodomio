import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }));
vi.mock("~/domain/item/item.prisma.entity.server", () => ({
  itemPrismaEntity: {
    client: {
      item: { findMany: mocks.find },
      purchaseShoppingList: { create: mocks.create },
    },
  },
}));
vi.mock("~/domain/item/item-units.server", () => ({
  getAvailableItemUnits: async () => ["UN"],
}));
import {
  createMobilePurchaseList,
  listMobilePurchaseCatalog,
} from "./purchase-shopping-list.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue([
    {
      id: "p",
      name: "Produto",
      purchaseUm: "KG",
      ItemUnit: [],
      StockMovement: [{ Supplier: { id: "s", name: "Fornecedor" } }],
    },
  ]);
});
it("uses only non-deleted stock entries for supplier discovery", async () => {
  const catalog = await listMobilePurchaseCatalog();
  expect(catalog[0].suppliers).toEqual([{ id: "s", name: "Fornecedor" }]);
  expect(mocks.find.mock.calls[0][0].select.StockMovement.where).toEqual({
    direction: "entry",
    deletedAt: null,
    supplierId: { not: null },
  });
});
it.each([
  [{ itemId: "p", quantity: 0, unit: "KG" }],
  [{ itemId: "p", quantity: 1, unit: "INVALID" }],
  [{ itemId: "missing", quantity: 1, unit: "KG" }],
  [
    { itemId: "p", quantity: 1, unit: "KG" },
    { itemId: "p", quantity: 2, unit: "KG" },
  ],
])(
  "rejects invalid selections before creating a list: %j",
  async (...items) => {
    await expect(createMobilePurchaseList("Compras", items)).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  }
);
it("saves quantities and units for valid items", async () => {
  await createMobilePurchaseList("Compras", [
    { itemId: "p", quantity: 0.5, unit: "KG" },
  ]);
  expect(mocks.create.mock.calls[0][0].data.Items.createMany.data).toEqual([
    { itemId: "p", quantity: 0.5, unit: "KG" },
  ]);
});
