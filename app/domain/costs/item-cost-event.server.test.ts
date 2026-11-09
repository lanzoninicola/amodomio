import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addHistoryEntryWithClient: vi.fn(),
  setCurrentCostWithClient: vi.fn(),
}));

vi.mock("~/lib/prisma/client.server", () => ({ default: {} }));
vi.mock("~/domain/item/item-cost-variation.prisma.entity.server", () => ({
  itemCostVariationPrismaEntity: {
    addHistoryEntryWithClient: mocks.addHistoryEntryWithClient,
    setCurrentCostWithClient: mocks.setCurrentCostWithClient,
  },
}));

import { registerItemCostEvent } from "./item-cost-event.server";

function buildClient() {
  return {
    itemVariation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "variation-1",
        itemId: "item-1",
        deletedAt: null,
      }),
    },
    itemCostVariation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    stockMovement: {
      create: vi.fn().mockResolvedValue({ id: "movement-1" }),
    },
  };
}

describe("registerItemCostEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reutiliza o cliente quando já está dentro de uma transação", async () => {
    const tx = buildClient();

    await registerItemCostEvent({
      client: tx,
      itemVariationId: "variation-1",
      costAmount: 12.5,
      source: "item-cost-sheet",
    });

    expect(tx.stockMovement.create).toHaveBeenCalledOnce();
    expect(mocks.setCurrentCostWithClient).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ itemVariationId: "variation-1" })
    );
  });

  it("abre uma transação quando recebe o cliente Prisma principal", async () => {
    const tx = buildClient();
    const db = {
      ...buildClient(),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx)
      ),
    };

    await registerItemCostEvent({
      client: db,
      itemVariationId: "variation-1",
      costAmount: 12.5,
      source: "item-cost-sheet",
    });

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.stockMovement.create).toHaveBeenCalledOnce();
  });
});
