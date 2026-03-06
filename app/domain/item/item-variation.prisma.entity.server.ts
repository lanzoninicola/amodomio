import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { variationPrismaEntity } from "./variation.prisma.entity.server";

export type LinkItemVariationInput = {
  itemId: string;
  variationId: string;
};

type SetReferenceInput = {
  itemId: string;
  itemVariationId: string;
};

class ItemVariationPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  private get model() {
    return (this.client as any).itemVariation;
  }

  async findById(id: string) {
    if (!id) return null;
    return await this.model.findUnique({
      where: { id },
      include: { Variation: true, ItemCostVariation: true },
    });
  }

  async findManyByItemId(itemId: string, params?: { includeDeleted?: boolean }) {
    if (!itemId) return [];

    const where: Record<string, unknown> = { itemId };
    if (!params?.includeDeleted) where.deletedAt = null;

    return await this.model.findMany({
      where,
      include: {
        Variation: true,
        ItemCostVariation: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  async findByItemAndVariation(itemId: string, variationId: string) {
    if (!itemId || !variationId) return null;

    return await this.model.findFirst({
      where: { itemId, variationId },
      include: { Variation: true, ItemCostVariation: true },
    });
  }

  async linkToItem({ itemId, variationId }: LinkItemVariationInput) {
    if (!itemId) throw new Error("ItemVariation.itemId é obrigatório");
    if (!variationId) throw new Error("ItemVariation.variationId é obrigatório");

    return await this.client.$transaction(async (tx) => {
      const item = await (tx as any).item.findUnique({ where: { id: itemId } });
      if (!item) throw new Error("Item não encontrado");

      const variation = await (tx as any).variation.findUnique({
        where: { id: variationId },
      });
      if (!variation || variation.deletedAt) {
        throw new Error("Variation inválida ou removida");
      }

      const existing = await (tx as any).itemVariation.findFirst({
        where: { itemId, variationId },
      });

      if (existing && !existing.deletedAt) return existing;

      if (existing?.deletedAt) {
        const restored = await (tx as any).itemVariation.update({
          where: { id: existing.id },
          data: { deletedAt: null, updatedAt: new Date() },
        });
        await this.ensureReferenceForItemTx(tx, itemId);
        return restored;
      }

      const created = await (tx as any).itemVariation.create({
        data: { itemId, variationId, isReference: false },
      });
      await this.ensureReferenceForItemTx(tx, itemId);
      return created;
    });
  }

  async unlink(id: string) {
    if (!id) throw new Error("ItemVariation.id é obrigatório");

    return await this.client.$transaction(async (tx) => {
      const itemVariation = await (tx as any).itemVariation.findUnique({
        where: { id },
        include: { Variation: true },
      });

      if (!itemVariation) throw new Error("Vínculo ItemVariation não encontrado");

      if (itemVariation.deletedAt) return itemVariation;

      const isBase =
        itemVariation?.Variation?.kind === "base" &&
        itemVariation?.Variation?.code === "base";

      if (isBase) {
        throw new Error("Não é permitido remover a variação base do item");
      }

      const removed = await (tx as any).itemVariation.update({
        where: { id },
        data: { deletedAt: new Date(), isReference: false },
      });
      await this.ensureReferenceForItemTx(tx, itemVariation.itemId);
      return removed;
    });
  }

  async ensureBaseVariationForItem(itemId: string) {
    if (!itemId) throw new Error("Item.id é obrigatório");

    const baseVariation = await variationPrismaEntity.ensureBaseVariation();
    return await this.linkToItem({
      itemId,
      variationId: baseVariation.id,
    });
  }

  async replaceItemVariations(
    itemId: string,
    variationIds: string[],
    params?: { keepBase?: boolean }
  ) {
    if (!itemId) throw new Error("Item.id é obrigatório");

    return await this.client.$transaction(async (tx) => {
      const keepBase = params?.keepBase !== false;
      const normalizedIds = Array.from(new Set(variationIds.filter(Boolean)));

      if (keepBase) {
        const baseVariation =
          (await (tx as any).variation.findFirst({
            where: { kind: "base", code: "base" },
          })) ||
          (await (tx as any).variation.create({
            data: { kind: "base", code: "base", name: "Base" },
          }));

        normalizedIds.push(baseVariation.id);
      }

      const uniqueIds = Array.from(new Set(normalizedIds));
      const current = await (tx as any).itemVariation.findMany({
        where: { itemId },
      });

      for (const variationId of uniqueIds) {
        const existing = current.find((row: any) => row.variationId === variationId);
        if (!existing) {
          await (tx as any).itemVariation.create({
            data: { itemId, variationId, isReference: false },
          });
          continue;
        }

        if (existing.deletedAt) {
          await (tx as any).itemVariation.update({
            where: { id: existing.id },
            data: { deletedAt: null, isReference: false },
          });
        }
      }

      const toDisable = current.filter(
        (row: any) => !uniqueIds.includes(row.variationId) && !row.deletedAt
      );

      for (const row of toDisable) {
        const variation = await (tx as any).variation.findUnique({
          where: { id: row.variationId },
        });
        const isBase = variation?.kind === "base" && variation?.code === "base";
        if (isBase && keepBase) continue;

        await (tx as any).itemVariation.update({
          where: { id: row.id },
          data: { deletedAt: new Date(), isReference: false },
        });
      }

      await this.ensureReferenceForItemTx(tx, itemId);

      return await (tx as any).itemVariation.findMany({
        where: { itemId, deletedAt: null },
        include: { Variation: true, ItemCostVariation: true },
        orderBy: [{ createdAt: "asc" }],
      });
    });
  }

  async setReferenceVariation({ itemId, itemVariationId }: SetReferenceInput) {
    if (!itemId) throw new Error("Item.id é obrigatório");
    if (!itemVariationId) throw new Error("ItemVariation.id é obrigatório");

    return await this.client.$transaction(async (tx) => {
      const target = await (tx as any).itemVariation.findFirst({
        where: { id: itemVariationId, itemId, deletedAt: null },
      });

      if (!target) {
        throw new Error("Variação de referência inválida");
      }

      await (tx as any).itemVariation.updateMany({
        where: { itemId, deletedAt: null, isReference: true },
        data: { isReference: false },
      });

      return await (tx as any).itemVariation.update({
        where: { id: itemVariationId },
        data: { isReference: true },
      });
    });
  }

  private async ensureReferenceForItemTx(tx: any, itemId: string) {
    const activeRows = await (tx as any).itemVariation.findMany({
      where: { itemId, deletedAt: null },
      include: { Variation: true },
      orderBy: [{ createdAt: "asc" }],
    });

    if (activeRows.length === 0) return;

    const currentReference = activeRows.find((row: any) => row.isReference);
    if (currentReference) {
      const extraReferences = activeRows.filter((row: any) => row.isReference && row.id !== currentReference.id);
      if (extraReferences.length > 0) {
        await (tx as any).itemVariation.updateMany({
          where: { id: { in: extraReferences.map((row: any) => row.id) } },
          data: { isReference: false },
        });
      }
      return;
    }

    const preferred =
      activeRows.find((row: any) => row?.Variation?.kind !== "base") ||
      activeRows.find((row: any) => row?.Variation?.kind === "base" && row?.Variation?.code === "base") ||
      activeRows[0];

    await (tx as any).itemVariation.update({
      where: { id: preferred.id },
      data: { isReference: true },
    });
  }
}

export const itemVariationPrismaEntity = new ItemVariationPrismaEntity({
  client: prismaClient,
});
