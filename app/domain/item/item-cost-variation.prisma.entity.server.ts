import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type ItemCostVariationSource =
  | "manual"
  | "purchase"
  | "recipe-sheet"
  | "import"
  | "adjustment"
  | string;

export type SetItemVariationCostInput = {
  itemVariationId: string;
  costAmount: number;
  unit?: string | null;
  source?: ItemCostVariationSource | null;
  referenceType?: string | null;
  referenceId?: string | null;
  validFrom?: Date;
  updatedBy?: string | null;
  metadata?: unknown;
};

class ItemCostVariationPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  private get model() {
    return (this.client as any).itemCostVariation;
  }

  private get historyModel() {
    return (this.client as any).itemCostVariationHistory;
  }

  async findCurrentByItemVariationId(itemVariationId: string) {
    if (!itemVariationId) return null;
    return await this.model.findUnique({
      where: { itemVariationId },
      include: {
        ItemVariation: {
          include: {
            Item: true,
            Variation: true,
          },
        },
      },
    });
  }

  async findHistoryByItemVariationId(itemVariationId: string, limit = 50) {
    if (!itemVariationId) return [];
    return await this.historyModel.findMany({
      where: { itemVariationId },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  async listCurrentByItemId(itemId: string) {
    if (!itemId) return [];
    return await this.model.findMany({
      where: {
        deletedAt: null,
        ItemVariation: {
          is: {
            itemId,
            deletedAt: null,
          },
        },
      },
      include: {
        ItemVariation: {
          include: {
            Variation: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async setCurrentCost(input: SetItemVariationCostInput) {
    if (!input.itemVariationId) {
      throw new Error("itemVariationId é obrigatório");
    }

    const nextCost = Number(input.costAmount);
    if (!Number.isFinite(nextCost)) {
      throw new Error("costAmount inválido");
    }

    const validFrom = input.validFrom || new Date();

    return await this.client.$transaction(async (tx) => {
      const itemVariation = await (tx as any).itemVariation.findUnique({
        where: { id: input.itemVariationId },
        include: { Variation: true, Item: true },
      });

      if (!itemVariation || itemVariation.deletedAt) {
        throw new Error("ItemVariation inválida ou removida");
      }

      const current = await (tx as any).itemCostVariation.findUnique({
        where: { itemVariationId: input.itemVariationId },
      });

      const previousCostAmount = Number(current?.costAmount || 0);
      const now = new Date();

      const saved = current
        ? await (tx as any).itemCostVariation.update({
            where: { id: current.id },
            data: {
              costAmount: nextCost,
              previousCostAmount,
              unit: input.unit ?? current.unit ?? null,
              source: input.source ?? current.source ?? null,
              referenceType: input.referenceType ?? null,
              referenceId: input.referenceId ?? null,
              validFrom,
              updatedBy: input.updatedBy ?? null,
              deletedAt: null,
              updatedAt: now,
            },
          })
        : await (tx as any).itemCostVariation.create({
            data: {
              itemVariationId: input.itemVariationId,
              costAmount: nextCost,
              previousCostAmount: 0,
              unit: input.unit ?? null,
              source: input.source ?? null,
              referenceType: input.referenceType ?? null,
              referenceId: input.referenceId ?? null,
              validFrom,
              updatedBy: input.updatedBy ?? null,
              createdAt: now,
              updatedAt: now,
            },
          });

      await (tx as any).itemCostVariationHistory.create({
        data: {
          itemVariationId: input.itemVariationId,
          costAmount: nextCost,
          previousCostAmount,
          unit: input.unit ?? current?.unit ?? null,
          source: input.source ?? current?.source ?? null,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          validFrom,
          createdBy: input.updatedBy ?? null,
          metadata: (input.metadata as any) ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      return saved;
    });
  }

  async softDeleteCurrentByItemVariationId(itemVariationId: string) {
    if (!itemVariationId) throw new Error("itemVariationId é obrigatório");

    return await this.model.update({
      where: { itemVariationId },
      data: { deletedAt: new Date() },
    });
  }

  async setCurrentCostByItemAndVariation(params: {
    itemId: string;
    variationKind: string;
    variationCode: string;
    costAmount: number;
    unit?: string | null;
    source?: ItemCostVariationSource | null;
    referenceType?: string | null;
    referenceId?: string | null;
    validFrom?: Date;
    updatedBy?: string | null;
    metadata?: unknown;
  }) {
    const itemVariation = await (this.client as any).itemVariation.findFirst({
      where: {
        itemId: params.itemId,
        deletedAt: null,
        Variation: {
          is: {
            kind: String(params.variationKind || "").trim().toLowerCase(),
            code: String(params.variationCode || "").trim().toLowerCase(),
            deletedAt: null,
          },
        },
      },
    });

    if (!itemVariation) {
      throw new Error("ItemVariation não encontrada para item/kind/code informado");
    }

    return await this.setCurrentCost({
      itemVariationId: itemVariation.id,
      costAmount: params.costAmount,
      unit: params.unit,
      source: params.source,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      validFrom: params.validFrom,
      updatedBy: params.updatedBy,
      metadata: params.metadata,
    });
  }
}

export const itemCostVariationPrismaEntity = new ItemCostVariationPrismaEntity({
  client: prismaClient,
});

