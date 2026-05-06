import type { ProductMeasurementConfig } from "~/domain/product/product.model.server";

export function normalizeUnit(unit: string | null | undefined) {
  const value = String(unit || "").trim().toLowerCase();
  if (value === "gr") return "g";
  if (value === "lt") return "l";
  return value;
}

export function normalizeMeasurementConfig(
  config: ProductMeasurementConfig
): ProductMeasurementConfig {
  return {
    ...config,
    purchaseUnit: normalizeUnit(config.purchaseUnit) as ProductMeasurementConfig["purchaseUnit"],
    consumptionUnit: normalizeUnit(config.consumptionUnit) as ProductMeasurementConfig["consumptionUnit"],
    purchaseToConsumptionFactor: Number(config.purchaseToConsumptionFactor || 0),
  };
}

export function validateMeasurementConfig(config: ProductMeasurementConfig) {
  const normalized = normalizeMeasurementConfig(config);

  if (!normalized.purchaseUnit) {
    throw new Error("Unidade de compra obrigatoria");
  }

  if (!normalized.consumptionUnit) {
    throw new Error("Unidade de consumo obrigatoria");
  }

  if (!Number.isFinite(normalized.purchaseToConsumptionFactor) || normalized.purchaseToConsumptionFactor <= 0) {
    throw new Error("Fator de conversao deve ser maior que zero");
  }

  return normalized;
}

export function convertPurchaseToConsumption(
  purchaseAmount: number,
  config: ProductMeasurementConfig
) {
  const cfg = validateMeasurementConfig(config);
  return purchaseAmount * cfg.purchaseToConsumptionFactor;
}

export function convertConsumptionToPurchase(
  consumptionAmount: number,
  config: ProductMeasurementConfig
) {
  const cfg = validateMeasurementConfig(config);
  return consumptionAmount / cfg.purchaseToConsumptionFactor;
}

