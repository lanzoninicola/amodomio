import { describe, expect, it, vi } from "vitest";
import {
  upsertAdminActionNotification,
  resolveAdminActionNotificationTarget,
} from "./admin-action-notification.server";

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

describe("upsertAdminActionNotification", () => {
  const input = {
    key: "recipe-cost-sheet-recalculation:recipe-1",
    type: "recipe-cost-sheet-recalculation",
    title: "Recalcular ficha técnica",
    targets: [{ type: "item-cost-sheet", id: "sheet-1" }],
  };

  function client() {
    return {
      adminActionNotification: {
        upsert: vi.fn().mockResolvedValue({ id: "notification-1" }),
      },
      adminActionNotificationTarget: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }

  it.each([false, true])(
    "grava aviso e destinos com cliente principal=%s",
    async (root) => {
      const tx = client();
      const transaction = vi.fn(async (callback: any) => callback(tx));
      const db = root ? { $transaction: transaction } : tx;
      await expect(upsertAdminActionNotification(db, input)).resolves.toEqual({
        id: "notification-1",
      });
      expect(transaction).toHaveBeenCalledTimes(root ? 1 : 0);
      expect(tx.adminActionNotificationTarget.deleteMany).toHaveBeenCalledWith({
        where: { notificationId: "notification-1" },
      });
      expect(tx.adminActionNotificationTarget.createMany).toHaveBeenCalledWith({
        data: [
          {
            notificationId: "notification-1",
            targetType: "item-cost-sheet",
            targetId: "sheet-1",
          },
        ],
      });
    }
  );

  it("propaga falhas para cancelar a transação da substituição", async () => {
    const tx = client();
    tx.adminActionNotificationTarget.createMany.mockRejectedValue(
      new Error("falha ao gravar destino")
    );
    await expect(upsertAdminActionNotification(tx, input)).rejects.toThrow(
      "falha ao gravar destino"
    );
  });
});
