import { beforeEach, expect, it, vi } from "vitest";
vi.mock("~/lib/prisma/client.server", () => ({
  default: { crmCustomer: { findFirst: vi.fn() } },
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { authorize: vi.fn(() => ({ status: 200 })) },
}));
vi.mock("~/domain/crm/order-history.server", () => ({
  getCustomerPurchaseHistory: vi.fn(),
}));
import prisma from "~/lib/prisma/client.server";
import { getCustomerPurchaseHistory } from "~/domain/crm/order-history.server";
import { loader } from "./api.crm.customers";
beforeEach(() => {
  vi.clearAllMocks();
});
it("reads exact normalized customer and returns purchase frequency without writing", async () => {
  vi.spyOn(Date, "now").mockReturnValue(
    new Date("2026-10-13T00:00:00Z").getTime()
  );
  vi.mocked(prisma.crmCustomer.findFirst).mockResolvedValue({
    id: "customer",
    phone_e164: "+5546991052049",
    name: "Ana",
  } as never);
  vi.mocked(getCustomerPurchaseHistory).mockResolvedValue({
    summary: {
      first: "2026-10-07T00:00:00Z",
      last: "2026-10-12T00:00:00Z",
      orders: 2,
    },
  } as never);
  const response = await loader({
    request: new Request(
      "http://localhost/api/crm/customers?phone=46991052049&purchaseSummary=1"
    ),
  } as never);
  expect(prisma.crmCustomer.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { phone_e164: "+5546991052049" } })
  );
  expect((await response.json()).purchaseSummary).toEqual({
    last: "2026-10-12T00:00:00Z",
    weekly: 2,
    monthly: 2,
  });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  vi.restoreAllMocks();
});
it("returns no metrics for unknown customers", async () => {
  vi.mocked(prisma.crmCustomer.findFirst).mockResolvedValue(null);
  const response = await loader({
    request: new Request(
      "http://localhost/api/crm/customers?phone=46991052049&purchaseSummary=1"
    ),
  } as never);
  expect((await response.json()).purchaseSummary).toBeNull();
  expect(getCustomerPurchaseHistory).not.toHaveBeenCalled();
});
