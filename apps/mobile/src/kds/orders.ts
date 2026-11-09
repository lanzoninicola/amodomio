import type { KdsOrder } from "./types";

// Pending rows reserve command numbers in the attendance grid.
// They become kitchen orders only after leaving the pending status.
export function ordersForDate(orders: KdsOrder[], date: string) {
  const dateInt = Number(date.replace(/-/g, ""));
  return orders.filter(
    (order) => order.dateInt === dateInt && order.status !== "pendente"
  );
}
