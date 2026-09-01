type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const VARIATION_DETAIL_PRESETS = [
  { key: "maxServeAmount", label: "Máximo de pessoas", type: "number" },
  { key: "serveDescription", label: "Descrição de rendimento", type: "string" },
  { key: "maxFlavorsAmount", label: "Máximo de sabores", type: "number" },
  { key: "flavorsDescription", label: "Descrição dos sabores", type: "string" },
] as const;

export type VariationDetailValueType = "string" | "number" | "boolean" | "json";

export function normalizeVariationDetailKey(input: string) {
  const key = input.trim();
  if (!/^[a-z][A-Za-z0-9.]{0,79}$/.test(key)) {
    throw new Error(
      "A chave deve começar com letra minúscula e usar apenas letras, números ou ponto"
    );
  }
  return key;
}

export function parseVariationDetailValue(
  input: string,
  type: VariationDetailValueType
): Exclude<JsonValue, null> {
  const value = input.trim();
  if (!value) throw new Error("O valor do detalhe é obrigatório");

  if (type === "string") return value;
  if (type === "number") {
    const number = Number(value.replace(",", "."));
    if (!Number.isFinite(number) || number < 0) {
      throw new Error("Informe um número maior ou igual a zero");
    }
    return number;
  }
  if (type === "boolean") {
    if (value !== "true" && value !== "false") {
      throw new Error('Para booleano, informe "true" ou "false"');
    }
    return value === "true";
  }

  try {
    const parsed = JSON.parse(value) as JsonValue;
    if (parsed === null) throw new Error("O valor JSON não pode ser nulo");
    return parsed;
  } catch {
    throw new Error("O valor informado não é um JSON válido");
  }
}

export function inferVariationDetailValueType(
  value: unknown
): VariationDetailValueType {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

export function formatVariationDetailValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}
