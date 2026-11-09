import type { KdsOrder } from "./types";
export const OVEN_ALERT_REMINDER_MS = 15_000;
// Keep acknowledgements only until the reminder is due or the request ends.
export function pendingOvenAlerts(
  orders: KdsOrder[],
  acknowledged: Map<string, number>,
  now = Date.now()
) {
  const requested = orders.filter(
    (order) => order.status === "aguardandoForno" && order.requestedForOven
  );
  const active = new Set(requested.map((order) => order.id));
  for (const [id, remindAt] of acknowledged)
    if (!active.has(id) || now >= remindAt) acknowledged.delete(id);
  return requested.filter((order) => !acknowledged.has(order.id));
}
