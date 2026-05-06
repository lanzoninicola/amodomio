import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  itemVariationFindUnique: vi.fn(),
  itemCostVariationFindUnique: vi.fn(),
  itemCostVariationUpsert: vi.fn(),
  itemCostVariationHistoryFindFirst: vi.fn(),
  itemCostVariationHistoryCreate: vi.fn(),
  itemCostVariationHistoryUpdate: vi.fn(),
  itemCostVariationHistoryAuditCreate: vi.fn(),
}));

vi.mock("~/lib/prisma/client.server", () => {
  const tx = {
    itemVariation: {
      findUnique: mocks.itemVariationFindUnique,
    },
    itemCostVariation: {
      findUnique: mocks.itemCostVariationFindUnique,
      upsert: mocks.itemCostVariationUpsert,
    },
    itemCostVariationHistory: {
      findFirst: mocks.itemCostVariationHistoryFindFirst,
      create: mocks.itemCostVariationHistoryCreate,
      update: mocks.itemCostVariationHistoryUpdate,
    },
    itemCostVariationHistoryAudit: {
      create: mocks.itemCostVariationHistoryAuditCreate,
    },
  };

  return {
    default: {
      ...tx,
      $transaction: async (cb: (client: typeof tx) => unknown) => await cb(tx),
    },
  };
});

import { itemCostVariationPrismaEntity } from "~/domain/item/item-cost-variation.prisma.entity.server";

describe("itemCostVariationPrismaEntity.setCurrentCost", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.itemVariationFindUnique.mockResolvedValue({
      id: "item-var-1",
      deletedAt: null,
      Variation: { id: "variation-1" },
      Item: { id: "item-1" },
    });
    mocks.itemCostVariationHistoryFindFirst.mockResolvedValue(null);
    mocks.itemCostVariationHistoryCreate.mockResolvedValue({ id: "history-1" });
    mocks.itemCostVariationUpsert.mockImplementation(async (args: any) => ({
      id: "cost-1",
      ...args.create,
      ...args.update,
    }));
  });

  it("usa upsert para evitar corrida ao gravar o custo atual", async () => {
    mocks.itemCostVariationFindUnique.mockResolvedValue(null);

    await itemCostVariationPrismaEntity.setCurrentCost({
      itemVariationId: "item-var-1",
      costAmount: 51.95,
      unit: "KG",
      source: "import",
      referenceType: "stock-movement",
      referenceId: "movement-1",
    });

    expect(mocks.itemCostVariationUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.itemCostVariationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemVariationId: "item-var-1" },
        create: expect.objectContaining({
          itemVariationId: "item-var-1",
          costAmount: 51.95,
          previousCostAmount: 0,
        }),
        update: expect.objectContaining({
          costAmount: 51.95,
          previousCostAmount: 0,
        }),
      })
    );
  });

  it("preserva o custo anterior no update do registro atual", async () => {
    mocks.itemCostVariationFindUnique.mockResolvedValue({
      id: "cost-existing",
      costAmount: 42,
      unit: "KG",
      source: "manual",
    });

    await itemCostVariationPrismaEntity.setCurrentCost({
      itemVariationId: "item-var-1",
      costAmount: 51.95,
      unit: "KG",
      source: "import",
      referenceType: "stock-movement",
      referenceId: "movement-1",
    });

    expect(mocks.itemCostVariationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          previousCostAmount: 42,
        }),
      })
    );
  });
});
