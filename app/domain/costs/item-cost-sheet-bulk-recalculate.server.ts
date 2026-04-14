import prismaClient from "~/lib/prisma/client.server";
import { recalcItemCostSheetTotals } from "~/domain/costs/item-cost-sheet-recalc.server";

export interface ItemCostSheetBulkScanFilters {
  search?: string;
  onlyActive?: boolean;
  onlyWithComponents?: boolean;
}

export interface ItemCostSheetBulkScanRow {
  rootSheetId: string;
  itemId: string;
  itemName: string;
  sheetName: string;
  isActive: boolean;
  componentCount: number;
  variationCount: number;
  costAmount: number;
  updatedAt: Date;
}

export interface ItemCostSheetBulkScanResult {
  totalSheets: number;
  activeSheets: number;
  sheetsWithComponents: number;
  totalComponents: number;
  sheets: ItemCostSheetBulkScanRow[];
}

export interface ItemCostSheetBulkRecalculateRow {
  rootSheetId: string;
  itemId: string;
  itemName: string;
  sheetName: string;
  updatedSheets: number;
  publishedSnapshots: number;
  skipped: boolean;
  errors: number;
  log: string[];
}

export interface ItemCostSheetBulkRecalculateResult {
  results: ItemCostSheetBulkRecalculateRow[];
  totals: {
    updated: number;
    skipped: number;
    errors: number;
    publishedSnapshots: number;
  };
}

async function supportsComponentModel(db: any) {
  try {
    return Boolean(
      db?.itemCostSheetComponent &&
        typeof db.itemCostSheetComponent.findMany === "function"
    );
  } catch {
    return false;
  }
}

export async function scanItemCostSheetsForBulkRecalculation(
  filters: ItemCostSheetBulkScanFilters = {}
): Promise<ItemCostSheetBulkScanResult> {
  const db = prismaClient as any;
  const search = String(filters.search || "").trim();
  const onlyActive = Boolean(filters.onlyActive);
  const onlyWithComponents = Boolean(filters.onlyWithComponents);

  const roots = await db.itemCostSheet.findMany({
    where: {
      baseItemCostSheetId: null,
      ...(onlyActive ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { Item: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      itemId: true,
      name: true,
      isActive: true,
      costAmount: true,
      updatedAt: true,
      Item: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const rootIds = roots.map((sheet: any) => String(sheet.id || "")).filter(Boolean);
  if (rootIds.length === 0) {
    return {
      totalSheets: 0,
      activeSheets: 0,
      sheetsWithComponents: 0,
      totalComponents: 0,
      sheets: [],
    };
  }

  const allSheets = await db.itemCostSheet.findMany({
    where: {
      OR: [{ id: { in: rootIds } }, { baseItemCostSheetId: { in: rootIds } }],
    },
    select: {
      id: true,
      baseItemCostSheetId: true,
    },
  });

  const componentRows = (await supportsComponentModel(db))
    ? await db.itemCostSheetComponent.findMany({
        where: { itemCostSheetId: { in: rootIds } },
        select: { itemCostSheetId: true },
      })
    : await db.itemCostSheetLine.findMany({
        where: { itemCostSheetId: { in: rootIds } },
        select: { itemCostSheetId: true },
      });

  const variationCountByRootId = new Map<string, number>();
  for (const row of allSheets) {
    const rootSheetId = String(row.baseItemCostSheetId || row.id || "");
    if (!rootSheetId) continue;
    variationCountByRootId.set(
      rootSheetId,
      Number(variationCountByRootId.get(rootSheetId) || 0) + 1
    );
  }

  const componentCountByRootId = new Map<string, number>();
  for (const row of componentRows) {
    const rootSheetId = String(row.itemCostSheetId || "");
    if (!rootSheetId) continue;
    componentCountByRootId.set(
      rootSheetId,
      Number(componentCountByRootId.get(rootSheetId) || 0) + 1
    );
  }

  const sheets = roots
    .map((sheet: any) => {
      const rootSheetId = String(sheet.id || "");
      const componentCount = Number(componentCountByRootId.get(rootSheetId) || 0);
      return {
        rootSheetId,
        itemId: String(sheet.itemId || ""),
        itemName: String(sheet.Item?.name || "Item sem nome"),
        sheetName:
          String(sheet.name || "").trim() ||
          `Ficha tecnica ${String(sheet.Item?.name || "Item")}`,
        isActive: Boolean(sheet.isActive),
        componentCount,
        variationCount: Number(variationCountByRootId.get(rootSheetId) || 1),
        costAmount: Number(sheet.costAmount || 0),
        updatedAt: new Date(sheet.updatedAt),
      };
    })
    .filter((sheet) => (onlyWithComponents ? sheet.componentCount > 0 : true));

  return {
    totalSheets: sheets.length,
    activeSheets: sheets.filter((sheet) => sheet.isActive).length,
    sheetsWithComponents: sheets.filter((sheet) => sheet.componentCount > 0).length,
    totalComponents: sheets.reduce(
      (acc, sheet) => acc + Number(sheet.componentCount || 0),
      0
    ),
    sheets,
  };
}

export async function recalculateItemCostSheetsInBulk(
  rootSheetIds: string[]
): Promise<ItemCostSheetBulkRecalculateResult> {
  const db = prismaClient as any;
  const uniqueRootIds = Array.from(
    new Set(rootSheetIds.map((value) => String(value || "").trim()).filter(Boolean))
  );

  if (uniqueRootIds.length === 0) {
    return {
      results: [],
      totals: { updated: 0, skipped: 0, errors: 0, publishedSnapshots: 0 },
    };
  }

  const roots = await db.itemCostSheet.findMany({
    where: {
      id: { in: uniqueRootIds },
      baseItemCostSheetId: null,
    },
    select: {
      id: true,
      itemId: true,
      name: true,
      Item: {
        select: {
          name: true,
        },
      },
    },
  });

  const rootById = new Map<string, any>(
    roots.map((sheet: any) => [String(sheet.id || ""), sheet])
  );

  const results: ItemCostSheetBulkRecalculateRow[] = [];
  const totals = {
    updated: 0,
    skipped: 0,
    errors: 0,
    publishedSnapshots: 0,
  };

  for (const rootSheetId of uniqueRootIds) {
    const root = rootById.get(rootSheetId);
    const baseRow = {
      rootSheetId,
      itemId: String(root?.itemId || ""),
      itemName: String(root?.Item?.name || "Item sem nome"),
      sheetName:
        String(root?.name || "").trim() ||
        `Ficha tecnica ${String(root?.Item?.name || "Item")}`,
    };

    if (!root) {
      totals.errors += 1;
      results.push({
        ...baseRow,
        updatedSheets: 0,
        publishedSnapshots: 0,
        skipped: false,
        errors: 1,
        log: ["Ficha raiz nao encontrada ou nao elegivel para recálculo."],
      });
      continue;
    }

    try {
      const recalc = await recalcItemCostSheetTotals(db, rootSheetId);
      const updatedSheets = Number(recalc?.updatedSheets || 0);
      const publishedSnapshots = Number(recalc?.publishedSnapshots || 0);
      const skipped = updatedSheets === 0;

      totals.updated += updatedSheets;
      totals.publishedSnapshots += publishedSnapshots;
      if (skipped) totals.skipped += 1;

      const log = [
        `${updatedSheets} ficha(s) de variacao recalculada(s).`,
        `${publishedSnapshots} snapshot(s) ativo(s) republicado(s).`,
      ];

      results.push({
        ...baseRow,
        updatedSheets,
        publishedSnapshots,
        skipped,
        errors: 0,
        log,
      });
    } catch (error: any) {
      totals.errors += 1;
      results.push({
        ...baseRow,
        updatedSheets: 0,
        publishedSnapshots: 0,
        skipped: false,
        errors: 1,
        log: [String(error?.message || "Erro ao recalcular ficha de custo.")],
      });
    }
  }

  return { results, totals };
}
