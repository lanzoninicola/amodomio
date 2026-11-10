import type { KdsOrder } from "./types";

export function needsCutNotice(order: KdsOrder) {
  return (
    order.requiresCut === true &&
    (order.status === "assando" || order.status === "finalizado")
  );
}
