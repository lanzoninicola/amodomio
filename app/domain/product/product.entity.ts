import type {
  Product,
  ProductComponent,
  ProductType,
} from "./product.model.server";
import type { Category } from "../category/category.model.server";

export interface ProductTypeHTMLSelectOption {
  value: ProductType;
  label: string;
}

export type TCategoryProducts = Record<Category["name"], Product[]>;

type MaybeProduct = Product | null;

function notAvailableError() {
  return new Error("Fluxo de Product foi removido. Use Item/Recipe/ItemCostSheet.");
}

export class ProductEntity {
  constructor(_: unknown = undefined) {}

  static findAllProductTypes(): ProductTypeHTMLSelectOption[] {
    return [];
  }

  static findProductTypeLabel(): string {
    return "Descontinuado";
  }

  async findAll(): Promise<Product[]> {
    return [];
  }

  async findAllOrderedBy(): Promise<Product[]> {
    return [];
  }

  async findAllGroupedByCategory(): Promise<TCategoryProducts> {
    return {} as TCategoryProducts;
  }

  async findAllByCategory(): Promise<Product[]> {
    return [];
  }

  async findById(): Promise<MaybeProduct> {
    return null;
  }

  async findByType(): Promise<Product[]> {
    return [];
  }

  async findCompositionWithProduct(): Promise<Product[]> {
    return [];
  }

  async isProductPartOfComposition(): Promise<boolean> {
    return false;
  }

  async addComponent(): Promise<never> {
    throw notAvailableError();
  }

  async updateComponent(): Promise<never> {
    throw notAvailableError();
  }

  async removeComponent(): Promise<never> {
    throw notAvailableError();
  }

  async create(): Promise<never> {
    throw notAvailableError();
  }

  async update(): Promise<never> {
    throw notAvailableError();
  }

  async delete(): Promise<never> {
    throw notAvailableError();
  }

  async deleteProduct(): Promise<never> {
    throw notAvailableError();
  }
}

export class ProductPrismaEntity extends ProductEntity {
  constructor(_: unknown = undefined) {
    super();
  }
}

// Legacy aliases kept for compile compatibility while Product is being removed.
export const productEntity: any = new ProductEntity();
export const productPrismaEntity: any = new ProductPrismaEntity();

// Keep the imported type referenced so TS doesn't flag it as unused in stricter setups.
void (0 as unknown as ProductComponent | undefined);
