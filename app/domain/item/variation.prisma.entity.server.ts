import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export type VariationKind = string;

export type VariationCreateInput = {
  kind: string;
  code: string;
  name: string;
  sortOrderIndex?: number | null;
  additionalInformation?: string | null;
};

export type VariationUpdateInput = Partial<VariationCreateInput>;

function normalizeKind(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCode(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeName(value: string) {
  return String(value || "").trim();
}

function normalizeAdditionalInformation(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeSortOrderIndex(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

class VariationPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  private get model() {
    return (this.client as any).variation;
  }

  async findAll(params?: { kind?: string; includeDeleted?: boolean }) {
    const where: Record<string, unknown> = {};
    if (params?.kind) where.kind = normalizeKind(params.kind);
    if (!params?.includeDeleted) where.deletedAt = null;

    return await this.model.findMany({
      where,
      orderBy: [{ kind: "asc" }, { sortOrderIndex: "asc" }, { name: "asc" }],
    });
  }

  async findById(id: string) {
    if (!id) return null;
    return await this.model.findUnique({ where: { id } });
  }

  async findByKindAndCode(kind: string, code: string) {
    const normalizedKind = normalizeKind(kind);
    const normalizedCode = normalizeCode(code);
    if (!normalizedKind || !normalizedCode) return null;

    return await this.model.findFirst({
      where: {
        kind: normalizedKind,
        code: normalizedCode,
      },
    });
  }

  async create(data: VariationCreateInput) {
    const kind = normalizeKind(data.kind);
    const code = normalizeCode(data.code);
    const name = normalizeName(data.name);
    const sortOrderIndex = normalizeSortOrderIndex(data.sortOrderIndex);
    const additionalInformation = normalizeAdditionalInformation(data.additionalInformation);

    if (!kind) throw new Error("Variation.kind é obrigatório");
    if (!code) throw new Error("Variation.code é obrigatório");
    if (!name) throw new Error("Variation.name é obrigatório");

    return await this.model.create({
      data: {
        kind,
        code,
        name,
        sortOrderIndex,
        additionalInformation,
      },
    });
  }

  async update(id: string, data: VariationUpdateInput) {
    if (!id) throw new Error("Variation.id é obrigatório");

    const nextData: Record<string, unknown> = {};
    if (data.kind != null) nextData.kind = normalizeKind(data.kind);
    if (data.code != null) nextData.code = normalizeCode(data.code);
    if (data.name != null) nextData.name = normalizeName(data.name);
    if (data.sortOrderIndex != null || Object.prototype.hasOwnProperty.call(data, "sortOrderIndex")) {
      nextData.sortOrderIndex = normalizeSortOrderIndex(data.sortOrderIndex);
    }
    if (data.additionalInformation != null || Object.prototype.hasOwnProperty.call(data, "additionalInformation")) {
      nextData.additionalInformation = normalizeAdditionalInformation(data.additionalInformation);
    }

    if ("kind" in nextData && !nextData.kind) throw new Error("Variation.kind inválido");
    if ("code" in nextData && !nextData.code) throw new Error("Variation.code inválido");
    if ("name" in nextData && !nextData.name) throw new Error("Variation.name inválido");

    return await this.model.update({
      where: { id },
      data: nextData,
    });
  }

  async softDelete(id: string) {
    if (!id) throw new Error("Variation.id é obrigatório");

    const linkedSellingPrices = await (this.client as any).itemSellingPriceVariation.count({
      where: {
        ItemVariation: {
          variationId: id,
          deletedAt: null,
        },
      },
    });

    if (linkedSellingPrices > 0) {
      throw new Error("Esta variação possui preços de venda vinculados e não pode ser excluída");
    }

    return await this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async ensureBaseVariation() {
    const existing = await this.findByKindAndCode("base", "base");
    if (existing && !existing.deletedAt) return existing;

    if (existing?.deletedAt) {
      return await this.model.update({
        where: { id: existing.id },
        data: { name: "Base", sortOrderIndex: 0, deletedAt: null },
      });
    }

    return await this.create({
      kind: "base",
      code: "base",
      name: "Base",
      sortOrderIndex: 0,
    });
  }
}

export const variationPrismaEntity = new VariationPrismaEntity({
  client: prismaClient,
});
