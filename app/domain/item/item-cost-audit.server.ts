import prismaClient from "~/lib/prisma/client.server";

const db = prismaClient as any;

export type ItemCostAuditFilters = {
  itemName?: string;
  itemId?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  page?: number;
};

const PAGE_SIZE = 50;

function parseYmdStart(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseYmdEnd(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export async function loadItemCostAuditPayload(request: Request) {
  const url = new URL(request.url);
  const itemName = String(url.searchParams.get("item") || "").trim();
  const itemId = String(url.searchParams.get("itemId") || "").trim();
  const dateFromStr = url.searchParams.get("dateFrom");
  const dateToStr = url.searchParams.get("dateTo");
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);

  const dateFrom = parseYmdStart(dateFromStr);
  const dateTo = parseYmdEnd(dateToStr);

  // Build where clause for ItemCostVariationHistoryAudit
  const auditWhere: any = {};

  if (dateFrom || dateTo) {
    auditWhere.createdAt = {};
    if (dateFrom) auditWhere.createdAt.gte = dateFrom;
    if (dateTo) auditWhere.createdAt.lte = dateTo;
  }

  // If filtering by item, we need to join through ItemVariation -> Item
  if (itemId) {
    auditWhere.itemVariationId = { in: await getVariationIdsForItem(itemId) };
  } else if (itemName) {
    const variationIds = await getVariationIdsForItemName(itemName);
    auditWhere.itemVariationId = { in: variationIds };
  }

  const [rows, total] = await Promise.all([
    db.itemCostVariationHistoryAudit.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        ItemCostVariationHistory: {
          select: {
            id: true,
            referenceType: true,
            referenceId: true,
            metadata: true,
            ItemVariation: {
              select: {
                id: true,
                Item: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    }),
    db.itemCostVariationHistoryAudit.count({ where: auditWhere }),
  ]);

  const pageCount = Math.ceil(total / PAGE_SIZE);

  return {
    filters: { itemName, itemId, dateFrom: dateFromStr, dateTo: dateToStr, page },
    rows: rows.map(normalizeAuditRow),
    total,
    page,
    pageCount,
  };
}

export async function loadItemCostAuditForItem(itemVariationId: string, limit = 20) {
  if (!itemVariationId) return [];

  const rows = await db.itemCostVariationHistoryAudit.findMany({
    where: { itemVariationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      ItemCostVariationHistory: {
        select: {
          id: true,
          referenceType: true,
          referenceId: true,
          metadata: true,
        },
      },
    },
  });

  return rows.map(normalizeAuditRow);
}

async function getVariationIdsForItem(itemId: string): Promise<string[]> {
  const variations = await db.itemVariation.findMany({
    where: { itemId, deletedAt: null },
    select: { id: true },
  });
  return variations.map((v: { id: string }) => v.id);
}

async function getVariationIdsForItemName(name: string): Promise<string[]> {
  const items = await db.item.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
    select: {
      ItemVariation: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
    take: 30,
  });
  return items.flatMap((item: any) => item.ItemVariation.map((v: { id: string }) => v.id));
}

function normalizeAuditRow(row: any) {
  const history = row.ItemCostVariationHistory;
  const itemVariation = history?.ItemVariation;
  const item = itemVariation?.Item;

  const meta =
    typeof history?.metadata === "object" && history?.metadata
      ? (history.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    historyRecordId: row.historyRecordId,
    itemVariationId: row.itemVariationId,
    itemId: item?.id ?? null,
    itemName: item?.name ?? null,
    costAmountBefore: Number(row.costAmountBefore),
    costAmountAfter: Number(row.costAmountAfter),
    unitBefore: row.unitBefore ?? null,
    unitAfter: row.unitAfter ?? null,
    sourceBefore: row.sourceBefore ?? null,
    sourceAfter: row.sourceAfter ?? null,
    validFromBefore: row.validFromBefore,
    validFromAfter: row.validFromAfter,
    changedBy: row.changedBy ?? null,
    changeReason: row.changeReason ?? null,
    referenceType: history?.referenceType ?? null,
    referenceId: history?.referenceId ?? null,
    supplierName: String(meta.supplierName || "").trim() || null,
    invoiceNumber: String(meta.invoiceNumber || "").trim() || null,
    importBatchId: String(meta.importBatchId || "").trim() || null,
    createdAt: row.createdAt,
    metadata: row.metadata ?? null,
  };
}
