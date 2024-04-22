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
import dayjs from "dayjs";
import { Category } from "../category/category.model.server";
import { jsonParse } from "~/utils/json-helper";
import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { Prisma, PrismaClient } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export interface ProductTypeHTMLSelectOption {
  value: ProductType;
  label: string;
}

export type TCategoryProducts = Record<Category["name"], Product[]>;

type FieldOrderBy = "name" | "createdAt" | "updatedAt";

export class ProductEntity extends BaseEntity<Product> {
  async findAllOrderedBy(field: FieldOrderBy, orientation: "asc" | "desc") {
    const products = await this.findAll();

    const compareFunction = (a: Product, b: Product) => {
      if (field === "name") {
        return a.name.localeCompare(b.name);
      }

      if (field === "createdAt") {
        // @ts-ignore
        const createdAtA = dayjs(a.createdAt);
        // @ts-ignore
        const createdAtB = dayjs(b.createdAt);

        if (createdAtA.isBefore(createdAtB)) {
          return -1;
        }
        if (createdAtA.isAfter(createdAtB)) {
          return 1;
        }
        return 0;
      }

      if (field === "updatedAt") {
        // @ts-ignore
        const updatedAtA = dayjs(a.updatedAt);
        // @ts-ignore
        const updatedAtB = dayjs(b.updatedAt);

        if (updatedAtA.isBefore(updatedAtB)) {
          return -1;
        }
        if (updatedAtA.isAfter(updatedAtB)) {
          return 1;
        }
        return 0;
      }

      return 0;
    };

    return orientation === "asc"
      ? products.slice().sort(compareFunction)
      : products.slice().sort(compareFunction).reverse();
  }

  async findAllGroupedByCategory() {
    const products = await this.findAllOrderedBy("name", "asc");

    const categories = products.reduce((acc, product) => {
      const categoryStringify = product.info?.category;

      const category = jsonParse(categoryStringify) as Category;

      const categoryName = category?.name || "Não definido";

      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(product);

      return acc;
    }, {} as TCategoryProducts);

    return categories;
  }

  async deleteProduct(id: Product["id"]) {
    if (!id) {
      throw new Error("Não foi passado o ID do produto da eliminar");
    }

    // check if the product is part of a composition, if so, throw an error
    const isPartOfComposition = await this.isProductPartOfComposition(id);

    if (isPartOfComposition === true) {
      throw new Error("O produto está em composição, não pode ser deletado.");
    }

    const [err, data] = await tryit(productEntity._delete(id));

    if (err) {
      throw new Error(err.message);
    }

    return data;
  }

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

  /**
   * This retrieves the main product containing the item I wish to verify within its composition.
   *
   * @param id The product ID that could be inside a composition
   * @return
   */
  async findCompositionWithProduct(id: Product["id"]): Promise<Product[]> {
    const products = await this.findAll();
    return products.filter((p) => {
      const composition = p.components?.filter((c) => c.product.id === id);

      if (composition && composition?.length > 0) {
        return p;
      }
      return false;
    });
  }

  /**
   * This detect if a product is part of a composition.
   *
   * @param id The product ID that could be inside a composition
   * @return boolean
   */
  async isProductPartOfComposition(id: Product["id"]): Promise<boolean> {
    const products = await this.findAll();

    return products.some((p) => {
      const composition = p.components?.some((c) => c.product.id === id);

      if (composition && composition === true) {
        return true;
      }
      return false;
    });
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
      // case "pizza":
      //   return "Pizza";
      // case "ingredient":
      //   return "Ingrediente";
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
      // { value: "pizza", label: "Pizza" },
      // { value: "ingredient", label: "Ingrediente" },
      { value: "topping", label: "Sabor" },
      { value: "semi-finished", label: "Semi-acabado" },
      { value: "processed", label: "Produzido" },
      { value: "simple", label: "Simples" },
    ];
  }

  validate(product: Product) {
    if (!product.name) {
      serverError("O nome do produto é obrigatório", { throwIt: true });
    }
  }

  findAllByCategory(categoryId: string) {
    return this.findAll([
      {
        field: "info.category.id",
        op: "==",
        value: categoryId,
      },
    ]);
  }
}

export class ProductPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.ProductWhereInput) {
    if (!where) {
      return await this.client.product.findMany();
    }

    return await this.client.product.findMany({ where });
  }

  async findAllByCategory(categoryId: string) {
    return await this.client.product.findMany({
      where: {
        categoryId: categoryId,
      },
    });
  }

  async findById(id: string) {
    return await this.client.product.findUnique({ where: { id } });
  }

  async create(data: Prisma.ProductCreateInput) {
    return await this.client.product.create({ data });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return await this.client.product.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.product.delete({ where: { id } });
  }
}

export const productEntity = new ProductEntity(ProductModel);
export const productPrismaEntity = new ProductPrismaEntity({
  client: prismaClient,
});
