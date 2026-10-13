import { expect, it } from "vitest";
import { summarizePurchaseHistory } from "./purchase-history";
import { normalize_phone_e164_br } from "./normalize-phone.server";
it("counts flavor presence per pizza and distinct orders, excluding canceled purchases", () => {
  const summary = summarizePurchaseHistory([
    {
      date: "2026-10-01",
      total: 100,
      active: true,
      items: [
        {
          quantity: 2,
          flavors: ["1x Calabresa", " calabresa ", "1x Boscaiola"],
        },
        { quantity: 1, flavors: ["Calabresa"] },
      ],
    },
    {
      date: "2026-10-02",
      total: 50,
      active: true,
      items: [{ quantity: 1, flavors: [] }],
    },
    {
      date: "2026-10-03",
      total: 999,
      active: false,
      items: [{ quantity: 20, flavors: ["Margherita"] }],
    },
  ]);
  expect(summary.orders).toBe(2);
  expect(summary.revenue).toBe(150);
  expect(summary.average).toBe(75);
  expect(summary.last).toBe("2026-10-02");
  expect(summary.flavors).toEqual([
    { name: "calabresa", occurrences: 3, orders: 1 },
    { name: "Boscaiola", occurrences: 2, orders: 1 },
  ]);
});
it("supports local DDD 55 and international Brazilian phones", () => {
  expect(normalize_phone_e164_br("55999999999")).toBe("+5555999999999");
  expect(normalize_phone_e164_br("+55 (46) 99105-2049")).toBe("+5546991052049");
  expect(normalize_phone_e164_br("123")).toBeNull();
});
it("returns empty metrics for an empty history", () => {
  expect(summarizePurchaseHistory([])).toMatchObject({
    orders: 0,
    revenue: 0,
    average: 0,
    first: null,
    last: null,
    flavors: [],
  });
});
