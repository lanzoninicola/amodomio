import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  batch: vi.fn(),
  line: vi.fn(),
  create: vi.fn(),
  view: vi.fn(),
  start: vi.fn(),
  step: vi.fn(),
  map: vi.fn(),
  conversion: vi.fn(),
  approve: vi.fn(),
  lock: vi.fn(),
  supplier: vi.fn(),
  edit: vi.fn(),
}));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: vi.fn().mockResolvedValue(null) },
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: { authorize: m.auth, rateLimitCheck: m.limit },
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: {
    supplier: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: m.supplier,
    },
    stockMovementImportBatch: { findUnique: m.batch },
    stockMovementImportBatchLine: { findUnique: m.line },
    $transaction: (fn: any) =>
      fn({
        $executeRaw: m.lock,
        stockMovementImportBatch: { findFirst: m.batch },
      }),
  },
}));
vi.mock("~/domain/stock-movement/stock-movement-import.server", () => ({
  createStockMovementImportBatchFromVisionPayload: m.create,
  getStockMovementImportBatchView: m.view,
  startStockMovementImportBatch: m.start,
  importStockMovementImportBatchStep: m.step,
  mapBatchLinesToItem: m.map,
  setBatchLineManualConversion: m.conversion,
  approveBatchLineCostReview: m.approve,
  updateStockMovementImportBatchLineEditableFields: m.edit,
}));
import { action } from "./api.stock.suitable";
const note = {
  supplierName: "Agrilar Hortifruti",
  invoiceNumber: "00002377",
  date: "2026-10-08",
  lines: [
    {
      ingredientName: "Abobrinha Verde Kg",
      qtyEntry: 3.38,
      unitEntry: "KG",
      costAmount: 5.95,
      costTotalAmount: 20.08,
    },
    {
      ingredientName: "Cogumelo Paris Uni",
      qtyEntry: 6,
      unitEntry: "AGR",
      costAmount: 11.99,
      costTotalAmount: 71.94,
    },
  ],
};
const send = (body: unknown) =>
  action({
    request: new Request("https://test/api/stock/suitable", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockReturnValue({ status: 200 });
  m.limit.mockReturnValue({ success: true });
  m.create.mockResolvedValue({ batchId: "batch" });
  m.view.mockResolvedValue({
    summary: { total: 2, readyToImport: 2, imported: 0, skippedDuplicate: 0 },
    lines: [],
    items: [],
  });
});
it("rejects unauthorized requests without accessing batches", async () => {
  m.auth.mockReturnValue({ status: 401 });
  expect((await send({ action: "create", note })).status).toBe(401);
  expect(m.create).not.toHaveBeenCalled();
});
it("preserves invoice quantities, costs, supplier and source without importing", async () => {
  const response = await send({ action: "create", note });
  expect(response.status).toBe(200);
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      supplierName: note.supplierName,
      invoiceNumber: note.invoiceNumber,
      sourceSystem: "suitable",
      lines: expect.arrayContaining([expect.objectContaining(note.lines[0])]),
    })
  );
  expect(m.start).not.toHaveBeenCalled();
  expect(m.step).not.toHaveBeenCalled();
});
it("returns existing batch on retry without creating another", async () => {
  m.batch.mockResolvedValue({ id: "existing", status: "imported" });
  const body = await (await send({ action: "create", note })).json();
  expect(body.batchId).toBe("existing");
  expect(body.existing).toBe(true);
  expect(body.batchStatus).toBe("imported");
  expect(m.create).not.toHaveBeenCalled();
});
it("looks up only non archived batches and reports new ones as created", async () => {
  m.batch.mockResolvedValue(null);
  const body = await (await send({ action: "create", note })).json();
  expect(body.existing).toBe(false);
  expect(m.batch).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        archivedAt: null,
        status: { not: "archived" },
      }),
    })
  );
});
it.each([
  { ...note, date: "2026-02-30" },
  { ...note, lines: [] },
  { ...note, lines: [{ ...note.lines[0], qtyEntry: -1 }] },
])("rejects invalid invoice data", async (invalid) => {
  expect((await send({ action: "create", note: invalid })).status).toBe(400);
  expect(m.create).not.toHaveBeenCalled();
});
it("cannot modify a Saipos batch through the Suitable endpoint", async () => {
  m.batch.mockResolvedValue({ sourceSystem: "saipos" });
  expect((await send({ action: "start", batchId: "other" })).status).toBe(400);
  expect(m.start).not.toHaveBeenCalled();
});
it("blocks partial import while lines still need review", async () => {
  m.batch.mockResolvedValue({ sourceSystem: "suitable" });
  m.view.mockResolvedValue({
    summary: { total: 2, readyToImport: 1, imported: 0, skippedDuplicate: 0 },
  });
  expect((await send({ action: "start", batchId: "batch" })).status).toBe(400);
  expect(m.start).not.toHaveBeenCalled();
});
it("refuses mapping a line from another batch", async () => {
  m.batch.mockResolvedValue({ sourceSystem: "suitable" });
  m.line.mockResolvedValue({ id: "line", batchId: "other" });
  expect(
    (
      await send({
        action: "map",
        batchId: "batch",
        lineId: "line",
        itemId: "item",
      })
    ).status
  ).toBe(400);
  expect(m.map).not.toHaveBeenCalled();
});

it("starts a fully reconciled invoice only on an explicit import action", async () => {
  m.batch.mockResolvedValue({ sourceSystem: "suitable" });
  expect((await send({ action: "start", batchId: "batch" })).status).toBe(200);
  expect(m.start).toHaveBeenCalledWith({
    batchId: "batch",
    actor: "api:suitable-stock",
  });
});
it("links a supplier while preserving invoice quantities and costs", async () => {
  m.batch.mockResolvedValue({ sourceSystem: "suitable" });
  m.line.mockResolvedValue({
    id: "line",
    batchId: "batch",
    ingredientName: "Abobrinha",
    qtyEntry: 3.38,
    unitEntry: "KG",
    costAmount: 5.95,
    costTotalAmount: 20.08,
  });
  m.supplier.mockResolvedValue({ id: "supplier", name: "Agrilar" });
  expect(
    (
      await send({
        action: "supplier",
        batchId: "batch",
        lineId: "line",
        supplierId: "supplier",
      })
    ).status
  ).toBe(200);
  expect(m.edit).toHaveBeenCalledWith(
    expect.objectContaining({
      supplierId: "supplier",
      qtyEntry: 3.38,
      costTotalAmount: 20.08,
    })
  );
});
it("rejects invalid conversion factors without changing a line", async () => {
  m.batch.mockResolvedValue({ sourceSystem: "suitable" });
  m.line.mockResolvedValue({ id: "line", batchId: "batch" });
  expect(
    (
      await send({
        action: "conversion",
        batchId: "batch",
        lineId: "line",
        factor: -1,
      })
    ).status
  ).toBe(400);
  expect(m.conversion).not.toHaveBeenCalled();
});
