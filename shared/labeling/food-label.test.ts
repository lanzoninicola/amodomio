import { describe, expect, it } from "vitest";
import { buildEscPosFoodLabel, shelfLifeLabel } from "./food-label";

describe("food label", () => {
  it("formats a 42-column ESC/POS label with the configured data", () => {
    const output = buildEscPosFoodLabel({
      id: "label-1", itemId: "item-1", itemName: "Mussarela",
      conservation: "Conservar refrigerado", manipulatedAt: "2026-11-23T12:40:00.000Z",
      expiresAt: "2026-11-26T12:40:00.000Z", copies: 1, operatorName: "Mário",
      printStatus: "requested",
    }, { printerName: "Tanca TP-620", qzHost: "192.168.1.10", columns: 42, cutAfterPrint: true }).join("");

    expect(output).toContain("MUSSARELA");
    expect(output).toContain("MANIPULADO: 23/11/2026 09:40");
    expect(output).toContain("VALIDADE:   26/11/2026 09:40");
    expect(output).toContain("RESP.: Mario");
    expect(output).toContain("-".repeat(42));
    expect(output.endsWith("\x1D\x56\x00")).toBe(true);
  });

  it("describes shelf life without duplicating product data", () => {
    expect(shelfLifeLabel(1440)).toBe("1 dia");
    expect(shelfLifeLabel(4320)).toBe("3 dias");
    expect(shelfLifeLabel(120)).toBe("2 horas");
  });
});
