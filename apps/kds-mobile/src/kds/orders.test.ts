import { expect, it } from "vitest";
import { ordersForDate } from "./orders";
import type { KdsOrder } from "./types";

function order(id: string, status: string, dateInt = 20261001): KdsOrder {
  return {
    id,
    status,
    dateInt,
    commandNumber: 1,
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-01T12:00:00Z",
    channel: "",
    takeAway: false,
    requestedForOven: false,
    customerName: null,
    sizes: null,
  };
}

it("shows no orders for a day containing only reserved commands, including cached rows", () => {
  const reserved = Array.from({ length: 40 }, (_, i) =>
    order(String(i), "pendente")
  );
  expect(ordersForDate(reserved, "2026-10-01")).toEqual([]);
});

it("keeps started and finished orders, excluding reservations and other dates", () => {
  const started = order("started", "novoPedido");
  const finished = order("finished", "finalizado");
  expect(
    ordersForDate(
      [
        order("reserved", "pendente"),
        started,
        finished,
        order("yesterday", "assando", 20260930),
      ],
      "2026-10-01"
    )
  ).toEqual([started, finished]);
});

it("includes a reserved command once it becomes a new order", () => {
  const reserved = order("command", "pendente");
  expect(ordersForDate([reserved], "2026-10-01")).toEqual([]);
  const started = { ...reserved, status: "novoPedido" };
  expect(ordersForDate([started], "2026-10-01")).toEqual([started]);
});
