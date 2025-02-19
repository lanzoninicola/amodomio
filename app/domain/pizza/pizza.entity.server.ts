import type { Product, ProductInfo } from "../product/product.model.server";

// A pizza is a product with variation of sizes
export interface Pizza extends Product {
  sizes: PizzaSizeVariation[];
}

// each size has a variation of toppings
export interface PizzaSizeVariation {
  key: "individual" | "media" | "familia";
  name: string;
  slices: number;
  maxPersonServeAmount: number;
  maxToppingsAmount: number;
  toppings?: Topping[];
}

interface ToppingInfo extends ProductInfo {
  type: "processed";
}

export interface Topping extends Product {
  info: ToppingInfo;
}
