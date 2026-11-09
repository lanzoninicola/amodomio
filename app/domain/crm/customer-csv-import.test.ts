import { describe, expect, it } from "vitest";
import {
  classificationTagKey,
  normalizeCrmCustomerName,
  parseBrCurrency,
  parseBrDate,
  suggestCrmCustomerImportDecision,
  validateCrmCustomerCsvHeaders,
  CRM_CUSTOMER_CSV_HEADERS,
} from "./customer-csv-import";

describe("customer CSV import", () => {
  it("recognizes the ERP header and reports missing columns", () => {
    expect(
      validateCrmCustomerCsvHeaders([...CRM_CUSTOMER_CSV_HEADERS]).valid
    ).toBe(true);
    expect(
      validateCrmCustomerCsvHeaders(["Nome", "Telefone"]).missing
    ).toContain("Total gasto");
  });

  it("removes the legacy customer number without damaging the name", () => {
    expect(normalizeCrmCustomerName("#204 - Abramo Marchesi")).toEqual({
      legacyCustomerId: "204",
      name: "Abramo Marchesi",
    });
    expect(normalizeCrmCustomerName("Maria Silva").name).toBe("Maria Silva");
  });

  it("parses Brazilian currency and dates", () => {
    expect(parseBrCurrency("R$ 1.234,56")).toBe(1234.56);
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("22/08/2026")).toContain("2026-08-22");
  });

  it("requires review when the phone matches but the names diverge", () => {
    expect(
      suggestCrmCustomerImportDecision({
        phoneE164: "+5546999999999",
        importedName: "Maria Souza",
        existingName: "Maria Silva",
        hasMatch: true,
      }).decision
    ).toBe("pending");
    expect(
      suggestCrmCustomerImportDecision({
        phoneE164: "+5546999999999",
        importedName: "José da Silva",
        existingName: "Jose da Silva",
        hasMatch: true,
      }).decision
    ).toBe("merge");
  });

  it("creates stable classification tag keys", () => {
    expect(classificationTagKey("Frequênte")).toBe(
      "erp-classificacao-frequente"
    );
  });
});
