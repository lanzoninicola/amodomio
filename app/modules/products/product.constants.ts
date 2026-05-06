import type { ProductInfo, ProductType, ProductUnit } from "~/domain/product/product.model.server";

export interface ProductTypeOption {
  value: ProductType;
  label: string;
}

export interface ProductUnitOption {
  value: ProductUnit;
  label: string;
}

export const PRODUCT_TYPE_OPTIONS: ProductTypeOption[] = [
  { value: "topping", label: "Sabor" },
  { value: "semi-finished", label: "Semi-acabado" },
  { value: "processed", label: "Produzido" },
  { value: "simple", label: "Simples" },
];

export function getProductTypeLabel(
  type: ProductInfo["type"] | null | undefined
) {
  switch (type) {
    case "topping":
      return "Sabor";
    case "semi-finished":
      return "Semi-acabado";
    case "processed":
      return "Produzido";
    case "simple":
      return "Simples";
    default:
      return "Nao definido";
  }
}

export const PRODUCT_UNIT_OPTIONS: ProductUnitOption[] = [
  { value: "un", label: "UN" },
  { value: "kg", label: "KG" },
  { value: "g", label: "G" },
  { value: "l", label: "L" },
  { value: "ml", label: "ML" },
];
