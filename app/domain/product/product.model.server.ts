import type { LatestSellPrice } from "../sell-price/sell-price.model.server";
import { type SellPrice } from "../sell-price/sell-price.model.server";
import type { LatestCost } from "../purchase-price/purchase-price.model.server";
import { type PurchasePrice } from "../purchase-price/purchase-price.model.server";
import type { ProductMenu } from "./product-menu.model.server";
import type { Category } from "../category/category.model.server";

export interface Product {
  id?: string;
  name: string;
  unit: ProductUnit;
  info?: ProductInfo | null;
  menu?: ProductMenu;
  stock?: ProductStock;
  components?: ProductComponent[];
  pricing?: ProductPricing;
}

export type ProductType =
  | "simple"
  | "topping" // topping is merely a topping of products that cannot be sold neither separately nor as a topping
  // | "pizza" // pizza is a product that is produced and sold by the company itself. The components are raw materials and semi-pizza products. They suffer a transformation process and are cannot be sold.
  // | "ingredient" // raw material is a product that is bought from a supplier and is used to produce pizza products
  | "processed" // semi-manufactured is a product that is bought from a supplier or produced by the company and is used to produce pizza products
  | "semi-finished"; // semi-finished is a product that is bought from a supplier or produced by the company and is used to produce pizza products

export interface ProductInfo {
  productId?: string;
  type: ProductType;
  description?: string;
  category?: Category | undefined | null;
  measurement?: ProductMeasurementConfig;
}

export interface ProductStock {
  productId: string;
  stockCheck: boolean;
  initialQuantity: number;
  currentQuantity: number;
  stockStatus: "in-stock" | "out-of-stock";
}

export type ProductUnit = "kg" | "g" | "l" | "ml" | "un" | "gr" | "lt";

export interface ProductMeasurementConfig {
  purchaseUnit: ProductUnit;
  consumptionUnit: ProductUnit;
  // how many consumption units exist in 1 purchase unit
  purchaseToConsumptionFactor: number;
}

export interface ProductComponent {
  parentId: string;
  product: Product;
  unit: ProductUnit;
  quantity: number;
  unitCost: number;
  // if the product is a topping, for each component I can adjust the description for the menu
  menuDescription: string;
}

export interface ProductPricing {
  productId: string;
  latestSellPrice: LatestSellPrice;
  latestCost: LatestCost;
  sellPrices: SellPrice[];
  purchasePrices: PurchasePrice[];
}
