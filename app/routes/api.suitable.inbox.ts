import { waitUntil } from "@vercel/functions";
import { processSuitablePendingOrders } from "~/domain/suitable/process-pending.server";
import { suitableDisplayNumber } from "~/domain/suitable/order-display";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import prisma from "~/lib/prisma/client.server";
import { getSuitableSettings } from "~/domain/suitable/suitable-settings.server";
import { mapSuitableOrder } from "~/domain/suitable/map-order";
import type { SuitableOrderDetails } from "~/domain/suitable/suitable-client.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return json({ ok: false, paused: false, orders: [] }, { status: 401 });
  const settings = await getSuitableSettings();
  if (!settings.paused) waitUntil(processSuitablePendingOrders().catch(() => console.error("[Suitable pending_processing_failed] etapa=process_pending")));
  const [lastEvent, errorCount, lastImport] = await Promise.all([
    prisma.suitableWebhookEvent.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.suitableOrderInbox.count({
      where: { status: "pending", fetchError: { not: null } },
    }),
    prisma.suitableOrderInbox.findFirst({ where: { status: "imported" }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const configured = Boolean(
    process.env.SUITABLE_CLIENT_ID &&
      process.env.SUITABLE_CLIENT_SECRET &&
      process.env.SUITABLE_WEBHOOK_SECRET
  );
  const rows = await prisma.suitableOrderInbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const orders = rows.map((r) => ({
    id: r.id,
    suitableOrderId: r.suitableOrderId,
    paid: r.paid,
    receivedAt: r.createdAt.toISOString(),
    fetchError: r.fetchError,
    fill: r.details ? mapSuitableOrder(r.details as unknown as SuitableOrderDetails) : null,
    displayNumber: suitableDisplayNumber((r.details as any)?.display_number),
  }));
  return json({
    ok: true,
    paused: settings.paused,
    status: {
      configured,
      lastEventAt: lastEvent?.createdAt.toISOString() ?? null,
      errorCount,
      lastImportedAt: lastImport?.updatedAt.toISOString() ?? null,
    },
    orders,
  });
}
