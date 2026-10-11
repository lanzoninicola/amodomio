import type { KdsOrder } from "./types";

export function newlyAwaitingOven(
  orders: Pick<KdsOrder, "id" | "status">[],
  previous: Map<string, string> | null
) {
  if (!previous) return [];
  return orders.filter(
    (order) =>
      order.status === "aguardandoForno" &&
      previous.get(order.id) !== "aguardandoForno"
  );
}
