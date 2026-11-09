export const CRM_CUSTOMER_CSV_HEADERS = [
  "Status",
  "Nome",
  "Tags",
  "Telefone",
  "Frequência",
  "Ticket",
  "Pontos",
  "Classificação",
  "Nº pedidos",
  "Total gasto",
  "1ª compra",
  "Últ. compra",
  "Bairro",
  "Aniversário",
] as const;

export type CrmCustomerCsvRow = Record<string, string>;
export type CrmCustomerImportDecision =
  | "create"
  | "merge"
  | "ignore"
  | "pending";

export type NormalizedCrmCustomerImportRow = {
  rowNumber: number;
  source: CrmCustomerCsvRow;
  normalized: {
    phoneE164: string | null;
    legacyCustomerId: string | null;
    name: string | null;
    neighborhood: string | null;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    ordersCount: number;
    totalRevenue: number;
    avgTicket: number;
    classifications: string[];
    birthday: string | null;
  };
  match: null | {
    customerId: string;
    name: string | null;
    phoneE164: string;
    neighborhood: string | null;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    ordersCount: number;
    totalRevenue: number;
    avgTicket: number;
  };
  decision: CrmCustomerImportDecision;
  suggestedDecision: Exclude<CrmCustomerImportDecision, "pending"> | "pending";
  reason: string;
  appliedAt: string | null;
};

export function validateCrmCustomerCsvHeaders(headers: string[]) {
  const missing = CRM_CUSTOMER_CSV_HEADERS.filter(
    (header) => !headers.includes(header)
  );
  return { valid: missing.length === 0, missing };
}

export function normalizeCrmCustomerName(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return { legacyCustomerId: null, name: null };
  const match = raw.match(/^#(\d+)\s*-\s*(.+)$/);
  return {
    legacyCustomerId: match?.[1] || null,
    name: (match?.[2] || raw).trim() || null,
  };
}

export function parseBrCurrency(value: string | null | undefined) {
  const normalized = String(value || "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function parseNonNegativeInteger(value: string | null | undefined) {
  const parsed = Number.parseInt(String(value || "0").replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function parseBrDate(value: string | null | undefined) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  )
    return null;
  return date.toISOString();
}

export function normalizeClassification(value: string | null | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeNameForComparison(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function suggestCrmCustomerImportDecision(params: {
  phoneE164: string | null;
  importedName: string | null;
  existingName?: string | null;
  hasMatch: boolean;
}) {
  if (!params.phoneE164) {
    return { decision: "ignore" as const, reason: "Telefone inválido" };
  }
  if (!params.hasMatch) {
    return {
      decision: "create" as const,
      reason: "Telefone ainda não existe no CRM",
    };
  }
  const imported = normalizeNameForComparison(params.importedName);
  const existing = normalizeNameForComparison(params.existingName);
  if (!existing || !imported || existing === imported) {
    return {
      decision: "merge" as const,
      reason: "Mesmo telefone e nome compatível",
    };
  }
  return {
    decision: "pending" as const,
    reason: "Mesmo telefone, mas nomes diferentes",
  };
}

export function classificationTagKey(value: string) {
  return `erp-classificacao-${value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}
