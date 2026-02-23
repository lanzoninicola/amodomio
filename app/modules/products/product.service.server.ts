import type { Category } from "@prisma/client";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import type {
  ProductMeasurementConfig,
  Product,
} from "~/domain/product/product.model.server";
import { PRODUCT_TYPE_OPTIONS, PRODUCT_UNIT_OPTIONS } from "./product.constants";
import getSearchParam from "~/utils/get-search-param";
import { validateMeasurementConfig } from "./product.measurement";

export async function getProductCreatePageData(request: Request) {
  const [products, categories] = await Promise.all([
    prismaClient.product.findMany({
      include: {
        Measurement: true,
      },
    }),
    categoryPrismaEntity.findAll({ type: "product" }),
  ]);

  const callbackUrl = getSearchParam({ request, paramName: "callbackUrl" });

  return {
    products: products as Product[],
    categories: categories as Category[],
    callbackUrl: callbackUrl || "",
    productTypes: PRODUCT_TYPE_OPTIONS,
    productUnits: PRODUCT_UNIT_OPTIONS,
  };
}

export async function createProduct(params: {
  name: string;
  categoryId?: string;
  measurement: ProductMeasurementConfig;
}) {
  const measurement = validateMeasurementConfig(params.measurement);

  const now = new Date();
  const categoryId = params.categoryId && params.categoryId !== "" ? params.categoryId : null;
  const consumptionUm = String(measurement.consumptionUnit || "UN").toUpperCase();
  const purchaseUm = String(measurement.purchaseUnit || "UN").toUpperCase();

  const created = await prismaClient.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: params.name,
        um: consumptionUm,
        categoryId,
        createdAt: now,
        updatedAt: now,
      },
    });

    await tx.productMeasurement.create({
      data: {
        productId: product.id,
        purchaseUm,
        consumptionUm,
        purchaseToConsumptionFactor: measurement.purchaseToConsumptionFactor,
      },
    });

    return product;
  });

  return created;
}

export async function listProducts() {
  return (await prismaClient.product.findMany({
    include: {
      Measurement: true,
    },
  })) as Product[];
}

export async function deleteProduct(id: string) {
  return await prismaClient.product.delete({ where: { id } });
}
