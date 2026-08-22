import { describe, expect, it, vi } from "vitest";
import { resolveAdminActionNotificationTarget } from "./admin-action-notification.server";

function buildClient() {
  return {
    adminActionNotificationTarget: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "target-1", notificationId: "notification-1" },
        ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    adminActionNotification: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("resolveAdminActionNotificationTarget", () => {
  it("reutiliza o cliente quando já está dentro de uma transação", async () => {
    const tx = buildClient();

    await resolveAdminActionNotificationTarget(tx, {
      type: "item-cost-sheet",
      id: "sheet-1",
    });

    expect(tx.adminActionNotificationTarget.updateMany).toHaveBeenCalledOnce();
    expect(tx.adminActionNotification.update).toHaveBeenCalledOnce();
  });

  it("abre uma transação quando recebe o cliente Prisma principal", async () => {
    const tx = buildClient();
    const db = {
      ...buildClient(),
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx)
      ),
    };

    await resolveAdminActionNotificationTarget(db, {
      type: "item-cost-sheet",
      id: "sheet-1",
    });

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.adminActionNotificationTarget.updateMany).toHaveBeenCalledOnce();
  });
});
