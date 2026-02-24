import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { itemVariationPrismaEntity } from "./item-variation.prisma.entity.server";

export type ItemClassification =
  | "insumo"
  | "semi_acabado"
  | "produto_final"
  | "embalagem"
  | "servico"
  | "outro";

type ItemFindManyParams = {
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
};

type CreateItemInput = {
  name: string;
  description?: string | null;
  classification: string;
  purchaseUm?: string | null;
  consumptionUm?: string | null;
  purchaseToConsumptionFactor?: number | null;
  active?: boolean;
  canPurchase?: boolean;
  canTransform?: boolean;
  canSell?: boolean;
  canStock?: boolean;
  canBeInMenu?: boolean;
};

class ItemPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  private get model() {
    // `as any` keeps this file compatible before `prisma generate` is executed.
    return (this.client as any).item;
  }

  async findAll(params: ItemFindManyParams = {}) {
    return await this.model.findMany({
      where: params.where,
      orderBy: params.orderBy ?? [{ name: "asc" }],
    });
  }

  async findById(id: string) {
    return await this.model.findUnique({
      where: { id },
    });
  }

  async create(data: CreateItemInput) {
    const item = await this.model.create({ data });
    await itemVariationPrismaEntity.ensureBaseVariationForItem(item.id);
    return item;
  }

  async update(id: string, data: Partial<CreateItemInput>) {
    return await this.model.update({
      where: { id },
      data,
    });
  }

  async upsertFromMenuItem(menuItem: {
    id: string;
    name: string;
    description?: string | null;
    active?: boolean;
  }) {
    const item = await this.model.upsert({
      where: { id: menuItem.id },
      create: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description || null,
        classification: "produto_final",
        active: menuItem.active ?? true,
        canPurchase: false,
        canTransform: true,
        canSell: true,
        canStock: true,
        canBeInMenu: true,
      },
      update: {
        name: menuItem.name,
        description: menuItem.description || null,
        active: menuItem.active ?? true,
        canSell: true,
        canBeInMenu: true,
      },
    });

    await itemVariationPrismaEntity.ensureBaseVariationForItem(item.id);
    return item;
  }
}

export const itemPrismaEntity = new ItemPrismaEntity({
  client: prismaClient,
});
