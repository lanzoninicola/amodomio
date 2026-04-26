import { listMenuItemMarginImpactRows } from "~/domain/costs/menu-item-margin-impact.server";
import { syncMenuItemCostsForItems } from "~/domain/costs/menu-item-cost-sync.server";
import { recalcItemCostSheetTotals } from "~/domain/costs/item-cost-sheet-recalc.server";
import { buildCostImpactGraphForItem } from "~/domain/costs/cost-impact-graph.server";

export type CostImpactPipelineResult = {
  sourceItemId: string;
  affectedRecipeIds: string[];
  affectedItemCostSheetIds: string[];
  affectedMenuItemIds: string[];
  menuItemImpactRows: Awaited<ReturnType<typeof listMenuItemMarginImpactRows>>;
  updatedRecipes: number;
  updatedItemCostSheets: number;
};

export async function runCostImpactPipelineForItemChange(params: {
  db: any;
  itemId: string;
  sourceType?: string;
  sourceRefId?: string | null;
  updatedBy?: string | null;
}): Promise<CostImpactPipelineResult> {
  const graph = await buildCostImpactGraphForItem(params.db, params.itemId);

  for (const itemCostSheetId of graph.affectedItemCostSheetIds) {
    await recalcItemCostSheetTotals(params.db, itemCostSheetId);
  }

  const syncResult = await syncMenuItemCostsForItems({
    db: params.db,
    itemIds: graph.affectedItemIds,
    updatedBy: params.updatedBy || "system:cost-impact",
  });

  const menuItemImpactRows = await listMenuItemMarginImpactRows(
    syncResult.updatedMenuItems.length > 0
      ? syncResult.updatedMenuItems
      : graph.affectedMenuItemIds
  );

  await persistCostImpactRun(params.db, {
    sourceType: params.sourceType || "item-cost-change",
    sourceRefId: params.sourceRefId || null,
    sourceItemId: graph.sourceItemId,
    affectedRecipeIds: graph.affectedRecipeIds,
    affectedItemCostSheetIds: graph.affectedItemCostSheetIds,
    affectedMenuItemIds: graph.affectedMenuItemIds,
    menuItemImpactRows,
  });

  return {
    sourceItemId: graph.sourceItemId,
    affectedRecipeIds: graph.affectedRecipeIds,
    affectedItemCostSheetIds: graph.affectedItemCostSheetIds,
    affectedMenuItemIds: graph.affectedMenuItemIds,
    menuItemImpactRows,
    updatedRecipes: graph.affectedRecipeIds.length,
    updatedItemCostSheets: graph.affectedItemCostSheetIds.length,
  };
}

export function resolvePriority(row: {
  marginGapPerc: number;
  priceGapAmount: number;
}) {
  if (row.marginGapPerc >= 10 || row.priceGapAmount >= 15) return "critical";
  if (row.marginGapPerc >= 5 || row.priceGapAmount >= 7) return "high";
  if (row.marginGapPerc >= 2 || row.priceGapAmount >= 3) return "medium";
  return "low";
}

async function persistCostImpactRun(
  db: any,
  params: {
    sourceType: string;
    sourceRefId: string | null;
    sourceItemId: string;
    affectedRecipeIds: string[];
    affectedItemCostSheetIds: string[];
    affectedMenuItemIds: string[];
    menuItemImpactRows: Awaited<ReturnType<typeof listMenuItemMarginImpactRows>>;
  }
) {
  if (
    typeof db.costImpactRun?.create !== "function" ||
    typeof db.costImpactMenuItem?.create !== "function"
  ) {
    return null;
  }

  const run = await db.costImpactRun.create({
    data: {
      sourceType: params.sourceType,
      sourceRefId: params.sourceRefId,
      sourceItemId: params.sourceItemId,
      status: "completed",
      affectedRecipes: params.affectedRecipeIds.length,
      affectedSheets: params.affectedItemCostSheetIds.length,
      affectedMenuItems: params.affectedMenuItemIds.length,
      summary: {
        affectedRecipeIds: params.affectedRecipeIds,
        affectedItemCostSheetIds: params.affectedItemCostSheetIds,
        affectedMenuItemIds: params.affectedMenuItemIds,
      },
    },
  });

  for (const row of params.menuItemImpactRows) {
    await db.costImpactMenuItem.create({
      data: {
        runId: run.id,
        menuItemId: row.menuItemId,
        menuItemSizeId: row.sizeId || null,
        menuItemChannelId: row.channelId || null,
        currentCostAmount: row.currentCostAmount,
        previousCostAmount: row.previousCostAmount,
        sellingPriceAmount: row.sellingPriceAmount,
        profitActualPerc: row.profitActualPerc,
        profitExpectedPerc: row.profitExpectedPerc,
        recommendedPriceAmount: row.recommendedPriceAmount,
        priceGapAmount: row.priceGapAmount,
        marginGapPerc: row.marginGapPerc,
        priority: resolvePriority(row),
        metadata: {
          menuItemName: row.menuItemName,
          sizeKey: row.sizeKey,
          sizeName: row.sizeName,
          channelKey: row.channelKey,
          channelName: row.channelName,
          priceExpectedAmount: row.priceExpectedAmount,
        },
      },
    });
  }

  return run.id;
}
