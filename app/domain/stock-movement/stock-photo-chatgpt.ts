import {
  DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE,
  DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL,
  DEFAULT_STOCK_PHOTO_MULTI_CHATGPT_PROMPT_TEMPLATE,
} from "./stock-photo-chatgpt-settings";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParsedVisionPayload = {
  metadata?: {
    returnUrl: string | null;
  };
  document: {
    supplierName: string | null;
    supplierCnpj: string | null;
    invoiceNumber: string | null;
    movementAt: string | null;
    notes: string | null;
  };
  lines: Array<{
    rowNumber: number;
    movementAt: string | null;
    invoiceNumber: string | null;
    supplierName: string | null;
    supplierCnpj: string | null;
    ingredientName: string;
    qtyEntry: number | null;
    unitEntry: string | null;
    qtyConsumption: number | null;
    unitConsumption: string | null;
    movementUnit: string | null;
    costAmount: number | null;
    costTotalAmount: number | null;
    observation: string | null;
  }>;
};

export type VisionLine = ParsedVisionPayload["lines"][number];

// ─── Primitive helpers ────────────────────────────────────────────────────────

export function str(value: unknown): string {
  return String(value || "").trim();
}

export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = str(value);
  if (!raw) return null;

  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUnit(value: unknown): string | null {
  const normalized = str(value).toUpperCase();
  return normalized || null;
}

export function extractJsonPayloadFromText(value: string): string {
  const raw = str(value);
  if (!raw) return "";

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBraceIndex = raw.indexOf("{");
  const lastBraceIndex = raw.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return raw.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return raw;
}

export function parseFlexibleDate(value: unknown): Date | null {
  const raw = str(value);
  if (!raw) return null;

  const isoDateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnlyMatch) {
    const [, yyyy, mm, dd] = isoDateOnlyMatch;
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;

  const match = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;

  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = match;
  const parsed = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(mi),
    Number(ss),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInputValue(value: Date | null): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseVisionResponse(value: string): ParsedVisionPayload {
  const jsonPayload = extractJsonPayloadFromText(value);
  if (!jsonPayload) throw new Error("Cole a resposta JSON do ChatGPT.");

  const parsed = JSON.parse(jsonPayload);
  const document =
    parsed?.document && typeof parsed.document === "object"
      ? parsed.document
      : {};
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];

  const normalizedLines = lines
    .map((line: Record<string, unknown>, index: number) => ({
      rowNumber: Number(line?.rowNumber || index + 1),
      movementAt: str(line?.movementAt || document?.movementAt) || null,
      invoiceNumber: str(line?.invoiceNumber || document?.invoiceNumber) || null,
      supplierName: str(line?.supplierName || document?.supplierName) || null,
      supplierCnpj: str(line?.supplierCnpj || document?.supplierCnpj) || null,
      ingredientName: str(line?.ingredientName),
      qtyEntry: parseNumeric(line?.qtyEntry),
      unitEntry: normalizeUnit(line?.unitEntry),
      qtyConsumption: parseNumeric(line?.qtyConsumption),
      unitConsumption: normalizeUnit(line?.unitConsumption),
      movementUnit: normalizeUnit(
        line?.movementUnit || line?.unitEntry || line?.unitConsumption,
      ),
      costAmount: parseNumeric(line?.costAmount),
      costTotalAmount: parseNumeric(line?.costTotalAmount),
      observation: str(line?.observation) || null,
    }))
    .filter((line) => line.ingredientName);

  if (normalizedLines.length === 0) {
    throw new Error("Nenhuma linha válida encontrada em lines.");
  }

  return {
    metadata: {
      returnUrl: str(parsed?.metadata?.returnUrl) || null,
    },
    document: {
      supplierName: str(document?.supplierName) || null,
      supplierCnpj: str(document?.supplierCnpj) || null,
      invoiceNumber: str(document?.invoiceNumber) || null,
      movementAt: str(document?.movementAt) || null,
      notes: str(document?.notes) || null,
    },
    lines: normalizedLines,
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildStockPhotoPrompt(params?: {
  supplierName?: string | null;
  supplierCnpj?: string | null;
  returnUrl?: string | null;
  promptTemplate?: string | null;
}): string {
  const template =
    params?.promptTemplate || DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE;
  const supplierName = params?.supplierName || "nome do fornecedor";
  const supplierCnpj = params?.supplierCnpj || "00.000.000/0000-00";
  const supplierCnpjLabel = params?.supplierCnpj
    ? ` (CNPJ ${params.supplierCnpj})`
    : "";
  const returnUrl =
    params?.returnUrl || DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL;

  return template
    .replaceAll("{{supplierName}}", supplierName)
    .replaceAll("{{supplierCnpj}}", supplierCnpj)
    .replaceAll("{{supplierCnpjLabel}}", supplierCnpjLabel)
    .replaceAll("{{returnUrl}}", returnUrl);
}

export function buildMultiStockPhotoPrompt(params?: {
  returnUrl?: string | null;
  promptTemplate?: string | null;
}): string {
  const template =
    params?.promptTemplate || DEFAULT_STOCK_PHOTO_MULTI_CHATGPT_PROMPT_TEMPLATE;
  const returnUrl =
    params?.returnUrl || DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL;

  return template.replaceAll("{{returnUrl}}", returnUrl);
}

// ─── Group lines by supplier (for multi-supplier flow) ────────────────────────

export type SupplierGroup = {
  supplierName: string;
  supplierCnpj: string | null;
  invoiceNumber: string | null;
  movementAt: string | null;
  lines: VisionLine[];
};

export function groupLinesBySupplier(
  lines: VisionLine[],
  documentFallback: ParsedVisionPayload["document"],
): SupplierGroup[] {
  const map = new Map<string, SupplierGroup>();

  for (const line of lines) {
    const key = str(line.supplierName || documentFallback.supplierName) || "Fornecedor desconhecido";

    if (!map.has(key)) {
      map.set(key, {
        supplierName: key,
        supplierCnpj: line.supplierCnpj || documentFallback.supplierCnpj,
        invoiceNumber: line.invoiceNumber || documentFallback.invoiceNumber,
        movementAt: line.movementAt || documentFallback.movementAt,
        lines: [],
      });
    }

    map.get(key)!.lines.push(line);
  }

  return Array.from(map.values());
}
