import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import prisma from "~/lib/prisma/client.server";
import { mapSuitableOrder } from "~/domain/suitable/map-order";
import type { SuitableOrderDetails } from "~/domain/suitable/suitable-client.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return json({ ok: false, orders: [] }, { status: 401 });
  const rows = await prisma.suitableOrderInbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const orders = rows.map((r) => ({
    id: r.id,
    suitableOrderId: r.suitableOrderId,
    paid: r.paid,
    fetchError: r.fetchError,
    fill: r.details ? mapSuitableOrder(r.details as unknown as SuitableOrderDetails) : null,
    displayNumber: (r.details as any)?.display_number ?? null,
  }));
  return json({ ok: true, orders });
}
