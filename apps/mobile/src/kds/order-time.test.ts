import { expect, it } from "vitest";
import { averageCompletionMinutes, isOrderOverOneHour } from "./order-time";
import type { KdsOrder } from "./types";

const finished = (overrides: Partial<KdsOrder> = {}) =>
  ({
    status: "finalizado",
    createdAt: "2026-10-10T12:00:00Z",
    novoPedidoAt: "2026-10-10T12:10:00Z",
    finalizadoAt: "2026-10-10T12:30:00Z",
    ...overrides,
  } as KdsOrder);

it("highlights only active orders strictly over one hour from entry", () => {
  const order = finished({ status: "assando" });
  const oneHour = Date.parse("2026-10-10T13:10:00Z");
  expect(isOrderOverOneHour(order, oneHour - 1)).toBe(false);
  expect(isOrderOverOneHour(order, oneHour)).toBe(false);
  expect(isOrderOverOneHour(order, oneHour + 1)).toBe(true);
  expect(isOrderOverOneHour(finished(), oneHour + 1)).toBe(false);
  expect(isOrderOverOneHour({ ...order, novoPedidoAt: null }, oneHour)).toBe(
    true
  );
  expect(
    isOrderOverOneHour({ ...order, novoPedidoAt: "invalid" }, oneHour)
  ).toBe(false);
  expect(isOrderOverOneHour(order, NaN)).toBe(false);
});

it("averages completion from entry time, falling back to creation for older orders", () => {
  expect(
    averageCompletionMinutes([finished(), finished({ novoPedidoAt: null })])
  ).toEqual({ minutes: 25, count: 2 });
});

it("excludes active orders, missing timestamps, invalid dates and negative durations", () => {
  expect(
    averageCompletionMinutes([
      finished(),
      finished({ status: "assando" }),
      finished({ finalizadoAt: null }),
      finished({ novoPedidoAt: "invalid" }),
      finished({ finalizadoAt: "invalid" }),
      finished({ finalizadoAt: "2026-10-10T12:09:00Z" }),
    ])
  ).toEqual({ minutes: 20, count: 1 });
  expect(averageCompletionMinutes([])).toEqual({ minutes: null, count: 0 });
});

it("includes zero durations and averages before rounding", () => {
  expect(
    averageCompletionMinutes([
      finished({ finalizadoAt: "2026-10-10T12:10:00Z" }),
      finished({ finalizadoAt: "2026-10-10T12:11:30Z" }),
    ])
  ).toEqual({ minutes: 0.75, count: 2 });
});
