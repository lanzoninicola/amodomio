import { expect, it, vi } from "vitest";
import { prepareSuitableKdsOrder, SuitableKdsConflict } from "./prepare-kds-order.server";
function setup(status: string, existing: unknown = null) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "day" }]),
    kdsDailyOrder: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ operationStatus: status }),
      update: vi.fn().mockResolvedValue({}),
    },
    kdsDailyOrderDetail: {
      findFirst: vi.fn().mockResolvedValue(existing),
      aggregate: vi.fn().mockResolvedValue({ _max: { sortOrderIndex: 4000 } }),
      create: vi.fn().mockResolvedValue({ id: "row", commandNumber: 1 }),
    },
  };
  return tx;
}
it("creates the exact Suitable comanda and reopens a closed day", async () => {
  const tx = setup("CLOSED");
  expect(await prepareSuitableKdsOrder(tx as any, "day", 20261124, 1, () => true)).toMatchObject({ commandNumber: 1 });
  expect(tx.kdsDailyOrderDetail.create).toHaveBeenCalledWith({ data: expect.objectContaining({ commandNumber: 1, orderId: "day", sortOrderIndex: 5000 }) });
  expect(tx.kdsDailyOrder.update).toHaveBeenCalledWith({ where: { id: "day" }, data: { operationStatus: "REOPENED", openedAt: expect.any(Date), closedAt: null } });
});
it("opens a pending day on its first import", async () => {
  const tx = setup("pending");
  await prepareSuitableKdsOrder(tx as any, "day", 20261124, 1, () => true);
  expect(tx.kdsDailyOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operationStatus: "OPENED" }) }));
});
it("reuses an empty matching comanda without creating or reopening an open day", async () => {
  const tx = setup("OPENED", { id: "existing", commandNumber: 1 });
  expect(await prepareSuitableKdsOrder(tx as any, "day", 20261124, 1, () => true)).toMatchObject({ id: "existing" });
  expect(tx.kdsDailyOrderDetail.create).not.toHaveBeenCalled();
  expect(tx.kdsDailyOrder.update).not.toHaveBeenCalled();
});
it("refuses an occupied number before changing the day", async () => {
  const tx = setup("CLOSED", { id: "existing", commandNumber: 1 });
  await expect(prepareSuitableKdsOrder(tx as any, "day", 20261124, 1, () => false)).rejects.toBeInstanceOf(SuitableKdsConflict);
  expect(tx.kdsDailyOrderDetail.create).not.toHaveBeenCalled();
  expect(tx.kdsDailyOrder.update).not.toHaveBeenCalled();
});
