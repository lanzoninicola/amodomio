import prisma from "~/lib/prisma/client.server";
import { importSuitableInboxOrder } from "./import-order.server";
import { syncInboxOrder } from "./suitable-inbox.server";
import { getSuitableSettings } from "./suitable-settings.server";
import { suitableDiagnosticExcerpt } from "./suitable-client.server";

/** Recuperação automática enquanto o KDS estiver aberto, com limite por ciclo. */
export async function processSuitablePendingOrders() {
  if ((await getSuitableSettings()).paused) return;
  const rows = await prisma.suitableOrderInbox.findMany({
    where: { status: "pending", updatedAt: { lte: new Date(Date.now() - 30_000) } },
    orderBy: { updatedAt: "asc" }, take: 3,
  });
  for (const row of rows) {
    try {
      if (!row.details || row.fetchError) await syncInboxOrder(row.suitableOrderId, row.lastEventId, "auto_retry");
      else await importSuitableInboxOrder(row.id);
    } catch (error) {
      const message = `[Suitable auto_import_failed] orderId=${row.suitableOrderId}; etapa=import_kds; ${suitableDiagnosticExcerpt(error instanceof Error ? error.message : String(error))}`;
      console.error(message);
      await prisma.suitableOrderInbox.updateMany({ where: { id: row.id, status: "pending" }, data: { fetchError: message } });
    }
  }
}
