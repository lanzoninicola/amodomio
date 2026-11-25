import { expect, it } from "vitest";
import { mapSuitableOrder } from "./map-order";

it("maps delivery order with card payment", () => {
  const r = mapSuitableOrder({
    id: 9, status: "pending", paid: true, delivery_fee: "8.00", discount: "0",
    total: "88.50", order_type: "delivery",
    customer: { name: "Ana", phone: "+55 (11) 99999-0000" },
    items: [{ name: "Pizza Grande Marguerita", quantity: 2, options: [] }],
    payment: { paid: true, methods: [{ type: "Cartão", value: "88.50" }] },
  } as any);
  expect(r.sizes.F).toBe(2);
  expect(r.hasMoto).toBe(true);
  expect(r.motoValue).toBe(8);
  expect(r.isCreditCard).toBe(true);
  expect(r.customerPhone).toBe("5511999990000");
});

it("keeps the visible Suitable number separate from its internal ID", () => {
  const result = mapSuitableOrder({ id: 1902, display_number: "1", items: [], payment: { methods: [] } } as any);
  expect(result.suitableOrderId).toBe(1902);
  expect(result.commandNumber).toBe(1);
  expect(result.notes).toContain("Pedido Suitable #1");
  expect(result.notes.join(" ")).not.toContain("1902");
});
