import { serverError } from "~/utils/http-response.server";
import {
  ProductModel,
  type Product,
  type ProductComponent,
  type ProductInfo,
  type ProductType,
} from "./product.model.server";
import type { LatestSellPrice } from "../sell-price/sell-price.model.server";
import { BaseEntity } from "../base.entity";
import tryit from "~/utils/try-it";

export interface ProductTypeHTMLSelectOption {
  value: ProductType;
  label: string;
}

export class ProductEntity extends BaseEntity<Product> {
  async findByType(type: ProductType) {
    const [err, products] = await tryit(
      productEntity.findAll([
        {
          field: "info.type",
          op: "==",
          value: type,
        },
      ])
    );

    if (err) {
      throw new Error(err.message);
    }

    return products;
  }

  async addComponent(productId: string, component: ProductComponent) {
    const product = await this.findById(productId);
    const components = product?.components || [];

    const componentExists = components.some(
      (c) => c.product.id === component.product.id
    );

    if (componentExists === false) {
      components.push(component);
    }

    return await this.update(productId, {
      components: components,
    });
  }

  async updateComponent(
    productId: string,
    componentId: string,
    updatedData: any
  ) {
    const product = await this.findById(productId);
    const components = product?.components || [];

    const updatedComponents = components.map((component) => {
      if (component.product.id === componentId) {
        return {
          ...component,
          ...updatedData,
        };
      }

      return component;
    });

    return await this.update(productId, {
      components: updatedComponents,
    });
  }

  async removeComponent(productId: string, componentId: string) {
    const product = await this.findById(productId);
    const components = product?.components || [];

    const updatedComponents = components.filter(
      (component) => component.product.id !== componentId
    );

    return await this.update(productId, {
      components: updatedComponents,
    });
  }

  async getSellingPrice(productId: string): Promise<LatestSellPrice> {
    const product = await this.findById(productId);

    if (!product) {
      return {
        unitPrice: 0,
        unitPromotionalPrice: 0,
      };
    }

    const productType = product?.info?.type;

    if (!productType) {
      return {
        unitPrice: 0,
        unitPromotionalPrice: 0,
      };
    }

    return (
      product.pricing?.latestSellPrice || {
        unitPrice: 0,
        unitPromotionalPrice: 0,
      }
    );
  }

  static findProductTypeByName(type: ProductInfo["type"] | null | undefined) {
    switch (type) {
      case "pizza":
        return "Pizza";
      case "ingredient":
        return "Ingrediente";
      case "topping":
        return "Sabor";
      case "processed":
        return "Produzido";
      case "simple":
        return "Simples";
      case null:
      case undefined:
        return "Não definido";
      default:
        return "Não definido";
    }
  }

  static findAllProductTypes(): ProductTypeHTMLSelectOption[] {
    return [
      { value: "pizza", label: "Pizza" },
      { value: "ingredient", label: "Ingrediente" },
      { value: "topping", label: "Sabor" },
      { value: "processed", label: "Produzido" },
      { value: "simple", label: "Simples" },
    ];
  }

  validate(product: Product) {
    if (!product.name) {
      serverError("O nome do produto é obrigatório", { throwIt: true });
    }
  }
}

export const productEntity = new ProductEntity(ProductModel);
