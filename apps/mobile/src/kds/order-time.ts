import type { KdsOrder } from "./types";

export function isOrderOverOneHour(order: KdsOrder, now: number) {
  const start = new Date(order.novoPedidoAt ?? order.createdAt).getTime();
  return order.status !== "finalizado" && now - start > 60 * 60_000;
}

export function averageCompletionMinutes(orders: KdsOrder[]) {
  let total = 0;
  let count = 0;
  for (const order of orders) {
    if (order.status !== "finalizado" || !order.finalizadoAt) continue;
    const start = new Date(order.novoPedidoAt ?? order.createdAt).getTime();
    const end = new Date(order.finalizadoAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      continue;
    total += end - start;
    count++;
  }
  return { minutes: count ? total / count / 60_000 : null, count };
}

export function elapsedSince(value: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60_000)
  );
  if (!Number.isFinite(minutes)) return "--h --mm";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}h ${String(
    minutes % 60
  ).padStart(2, "0")}mm`;
}
