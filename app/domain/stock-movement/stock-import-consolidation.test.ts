import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  consolidateSupplierBatchLines,
  fingerprintsForAppliedDuplicateCheck,
} from "./stock-import-consolidation";

const line = (overrides: Record<string, unknown> = {}) => ({
  ingredientName: "Figader Simons Cremos",
  invoiceNumber: "000512173",
  supplierCnpj: "79.846.275/0001-09",
  movementAt: new Date("2026-09-14T12:00:00Z"),
  unitEntry: "UN",
  movementUnit: "UN",
  unitConsumption: null,
  qtyConsumption: null,
  qtyEntry: 1,
  costAmount: 19.95,
  costTotalAmount: 19.95,
  sourceFingerprint: "one",
  rowNumber: 2,
  rawData: { row: 2 },
  ...overrides,
});

describe("supplier import consolidation", () => {
  it("sums the actual 1 + 3 Figader lines before mapping and preserves source data", () => {
    const input = [
      line(),
      line({
        qtyEntry: 3,
        costTotalAmount: 59.85,
        sourceFingerprint: "three",
        rowNumber: 5,
        rawData: { row: 5 },
      }),
    ];
    const result = consolidateSupplierBatchLines(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      qtyEntry: 4,
      costTotalAmount: 79.8,
      costAmount: 19.95,
      qtyConsumption: null,
    });
    expect(result[0].metadata.consolidation.rowNumbers).toEqual([2, 5]);
    expect(result[0].rawData.consolidatedLines).toEqual([
      { row: 2 },
      { row: 5 },
    ]);
    expect(input[0].qtyEntry).toBe(1);
    expect(
      fingerprintsForAppliedDuplicateCheck(result).map(
        (l) => l.sourceFingerprint
      )
    ).toEqual(expect.arrayContaining(["one", "three"]));
    expect(
      consolidateSupplierBatchLines([...input].reverse())[0].sourceFingerprint
    ).toBe(result[0].sourceFingerprint);
  });

  it.each([
    { ingredientName: "Figader Simons Cremos." },
    { unitEntry: "KG" },
    { supplierCnpj: "other" },
    { invoiceNumber: "other" },
    { movementAt: new Date("2026-09-15T12:00:00Z") },
    { movementUnit: "UN750" },
    { qtyEntry: 0 },
    { costTotalAmount: -1 },
  ])("keeps incompatible lines separate: %j", (overrides) => {
    expect(
      consolidateSupplierBatchLines([line(), line(overrides)])
    ).toHaveLength(2);
  });

  it("does not group the two butter descriptions merely because they map to the same item", () => {
    expect(
      consolidateSupplierBatchLines([
        line({
          ingredientName: "Mante Ext S.Sal Bata",
          mappedItemId: "butter",
        }),
        line({
          ingredientName: "Mante Ext. S.Sal Bata",
          mappedItemId: "butter",
        }),
      ])
    ).toHaveLength(2);
  });

  it("calculates weighted unit cost from totals and derives missing totals", () => {
    const [result] = consolidateSupplierBatchLines([
      line({ costAmount: 10, costTotalAmount: null }),
      line({ qtyEntry: 3, costAmount: 20, costTotalAmount: 60 }),
    ]);
    expect(result).toMatchObject({
      qtyEntry: 4,
      costTotalAmount: 70,
      costAmount: 17.5,
    });
  });

  it("retains compatibility with previously consolidated identical lines", () => {
    const expected = createHash("sha256")
      .update(
        JSON.stringify({ originalFingerprint: "one", occurrenceCount: 2 })
      )
      .digest("hex");
    const [result] = consolidateSupplierBatchLines([line(), line()]);
    expect(result.sourceFingerprint).toBe(expected);
    const [mixed] = consolidateSupplierBatchLines([
      line(),
      line(),
      line({ sourceFingerprint: "three", qtyEntry: 3 }),
    ]);
    expect(
      fingerprintsForAppliedDuplicateCheck([mixed]).map(
        (l) => l.sourceFingerprint
      )
    ).toContain(expected);
  });
});
