import type { Category } from "@prisma/client";
import type { Product } from "~/domain/product/product.model.server";
import { PRODUCT_TYPE_OPTIONS, PRODUCT_UNIT_OPTIONS } from "./product.constants";

export async function getProductCreatePageData(_request: Request) {
  return {
    products: [] as Product[],
    categories: [] as Category[],
    callbackUrl: "",
    productTypes: PRODUCT_TYPE_OPTIONS,
    productUnits: PRODUCT_UNIT_OPTIONS,
  };
}

export async function createProduct() {
  throw new Error("Fluxo de Product foi removido. Use Item/Recipe/ItemCostSheet.");
}

export async function listProducts() {
  return [] as Product[];
}

export async function deleteProduct(_id: string) {
  throw new Error("Fluxo de Product foi removido. Use Item/Recipe/ItemCostSheet.");
}
