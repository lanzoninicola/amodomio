import prismaClient from "~/lib/prisma/client.server";
import { buildCostImpactGraphForItem } from "~/domain/costs/cost-impact-graph.server";
import { recalcItemCostSheetTotals } from "~/domain/costs/item-cost-sheet-recalc.server";

const DEFAULT_COST_CHANGE_WINDOW_DAYS = 60;

export interface ItemCostSheetBulkScanFilters {
  rootSheetId?: string;
  itemId?: string;
  search?: string;
  onlyActive?: boolean;
  onlyWithComponents?: boolean;
}

export interface ItemCostSheetBulkScanReason {
  code: "costChange" | "eligible" | "noComponents";
  label: string;
  detail: string;
  count: number;
}

export interface ItemCostSheetBulkCostChange {
  itemId: string;
  itemName: string;
  costAmount: number;
  previousCostAmount: number;
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
  reasonSummary: string;
  reasons: ItemCostSheetBulkScanReason[];
  costChanges: ItemCostSheetBulkCostChange[];
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

function summarizeNames(values: string[], fallback: string) {
  const names = values.map((value) => String(value || "").trim()).filter(Boolean);
  if (names.length === 0) return fallback;
  const visible = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;
  return remaining > 0 ? `${visible} +${remaining}` : visible;
}

function hasMeaningfulCostChange(currentCostAmount: number, previousCostAmount: number) {
  return (
    Number(currentCostAmount || 0).toFixed(4) !==
    Number(previousCostAmount || 0).toFixed(4)
  );
}

function formatCostChange(change: ItemCostSheetBulkCostChange) {
  const previous = Number(change.previousCostAmount || 0).toFixed(2);
  const current = Number(change.costAmount || 0).toFixed(2);
  return `${change.itemName} (${previous} -> ${current})`;
}

async function getCostChangeWindowDays(db: any) {
  if (typeof db.setting?.findFirst !== "function") return DEFAULT_COST_CHANGE_WINDOW_DAYS;

  const setting = await db.setting.findFirst({
    where: {
      context: "items.cost",
      name: "averageWindowDays",
    },
    orderBy: [{ createdAt: "desc" }],
    select: { value: true },
  });
  const parsed = Number(setting?.value ?? DEFAULT_COST_CHANGE_WINDOW_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_COST_CHANGE_WINDOW_DAYS;
  return Math.max(Math.round(parsed), DEFAULT_COST_CHANGE_WINDOW_DAYS);
}

async function findRecentCostChangesByAffectedSheetId(
  db: any,
  candidateRootIds: string[]
): Promise<Map<string, ItemCostSheetBulkCostChange[]>> {
  const rootIds = new Set(candidateRootIds.map((id) => String(id || "").trim()).filter(Boolean));
  const changesBySheetId = new Map<string, ItemCostSheetBulkCostChange[]>();
  if (rootIds.size === 0 || typeof db.itemCostVariationHistory?.findMany !== "function") {
    return changesBySheetId;
  }

  const windowDays = await getCostChangeWindowDays(db);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const recentHistory = await db.itemCostVariationHistory.findMany({
    where: {
      OR: [{ validFrom: { gte: since } }, { createdAt: { gte: since } }],
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    select: {
      costAmount: true,
      previousCostAmount: true,
      ItemVariation: {
        select: {
          Item: { select: { id: true, name: true } },
        },
      },
    },
  });

  const latestByItemId = new Map<string, ItemCostSheetBulkCostChange>();
  for (const row of recentHistory) {
    const itemId = String(row.ItemVariation?.Item?.id || "").trim();
    if (!itemId || latestByItemId.has(itemId)) continue;

    const change = {
      itemId,
      itemName: String(row.ItemVariation?.Item?.name || itemId),
      costAmount: Number(row.costAmount || 0),
      previousCostAmount: Number(row.previousCostAmount || 0),
    };
    if (hasMeaningfulCostChange(change.costAmount, change.previousCostAmount)) {
      latestByItemId.set(itemId, change);
    }
  }

  for (const change of latestByItemId.values()) {
    const graph = await buildCostImpactGraphForItem(db, change.itemId);
    for (const affectedSheetId of graph.affectedItemCostSheetIds) {
      const rootSheetId = String(affectedSheetId || "").trim();
      if (!rootIds.has(rootSheetId)) continue;

      const existing = changesBySheetId.get(rootSheetId) || [];
      if (!existing.some((row) => row.itemId === change.itemId)) {
        existing.push(change);
        changesBySheetId.set(rootSheetId, existing);
      }
    }
  }

  return changesBySheetId;
}

function buildRecalculationReasons(params: {
  componentCount: number;
  isActive: boolean;
  costChanges: ItemCostSheetBulkCostChange[];
}): ItemCostSheetBulkScanReason[] {
  const reasons: ItemCostSheetBulkScanReason[] = [];
  const costChangeCount = params.costChanges.length;

  if (costChangeCount > 0) {
    reasons.push({
      code: "costChange",
      label: "Reajuste de insumo",
      detail: `Insumo(s) com custo alterado: ${summarizeNames(
        params.costChanges.map(formatCostChange),
        "historico recente de custo"
      )}`,
      count: costChangeCount,
    });
  }

  if (params.componentCount > 0) {
    reasons.push({
      code: "eligible",
      label: "Elegível",
      detail: params.isActive
        ? "Aparece porque é uma ficha raiz ativa com composição recalculável."
        : "Aparece porque é uma ficha raiz com composição recalculável.",
      count: 1,
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: "noComponents",
      label: "Sem composição",
      detail: "Sem componentes cadastrados; recálculo normalmente não altera custo",
      count: 0,
    });
  }

  return reasons;
}

export async function scanItemCostSheetsForBulkRecalculation(
  filters: ItemCostSheetBulkScanFilters = {}
): Promise<ItemCostSheetBulkScanResult> {
  const db = prismaClient as any;
  const rootSheetId = String(filters.rootSheetId || "").trim();
  const itemId = String(filters.itemId || "").trim();
  const search = String(filters.search || "").trim();
  const onlyActive = Boolean(filters.onlyActive);
  const onlyWithComponents = Boolean(filters.onlyWithComponents);

  const roots = await db.itemCostSheet.findMany({
    where: {
      baseItemCostSheetId: null,
      ...(rootSheetId ? { id: rootSheetId } : {}),
      ...(!rootSheetId && itemId ? { itemId } : {}),
      ...(onlyActive ? { isActive: true } : {}),
      ...(!rootSheetId && !itemId && search
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

  const costChangesBySheetId = await findRecentCostChangesByAffectedSheetId(db, rootIds);

  const variationCountByRootId = new Map<string, number>();
  for (const row of allSheets) {
    if (!row.baseItemCostSheetId) continue;
    const rootSheetId = String(row.baseItemCostSheetId);
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
      const isActive = Boolean(sheet.isActive);
      const costChanges = costChangesBySheetId.get(rootSheetId) || [];
      const reasons = buildRecalculationReasons({
        componentCount,
        isActive,
        costChanges,
      });
      return {
        rootSheetId,
        itemId: String(sheet.itemId || ""),
        itemName: String(sheet.Item?.name || "Item sem nome"),
        sheetName:
          String(sheet.name || "").trim() ||
          `Ficha tecnica ${String(sheet.Item?.name || "Item")}`,
        isActive,
        componentCount,
        variationCount: Number(variationCountByRootId.get(rootSheetId) || 1),
        costAmount: Number(sheet.costAmount || 0),
        updatedAt: new Date(sheet.updatedAt),
        reasonSummary: reasons.map((reason) => reason.label).join(", "),
        reasons,
        costChanges,
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
