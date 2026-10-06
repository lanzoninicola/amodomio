import type { KdsOrder } from "./types";
// Keep acknowledgements only while a request remains active; cancellation rearms it.
export function pendingOvenAlerts(
  orders: KdsOrder[],
  acknowledged: Set<string>
) {
  const requested = orders.filter(
    (order) => order.status === "aguardandoForno" && order.requestedForOven
  );
  const active = new Set(requested.map((order) => order.id));
  for (const id of acknowledged) if (!active.has(id)) acknowledged.delete(id);
  return requested.filter((order) => !acknowledged.has(order.id));
}
