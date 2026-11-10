import { expect, it } from "vitest";
import { needsCutNotice } from "./cut-notice";
import type { KdsOrder } from "./types";

it("reminds at both kitchen stages without clearing the cut instruction", () => {
  const order = { requiresCut: true, status: "aguardandoForno" } as KdsOrder;
  expect(needsCutNotice(order)).toBe(false);
  expect(needsCutNotice({ ...order, status: "assando" })).toBe(true);
  expect(needsCutNotice({ ...order, status: "finalizado" })).toBe(true);
  expect(order.requiresCut).toBe(true);
});
it("does not warn for unmarked or legacy orders", () => {
  for (const status of ["assando", "finalizado"]) {
    expect(needsCutNotice({ status } as KdsOrder)).toBe(false);
    expect(needsCutNotice({ status, requiresCut: false } as KdsOrder)).toBe(
      false
    );
  }
});
