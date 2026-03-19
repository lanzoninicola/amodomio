import { resolveItemCostSnapshot } from "~/domain/costs/item-cost-snapshot.server";
import {
  listRecipeCompositionLines,
  updateRecipeCompositionLine,
} from "~/domain/recipe/recipe-composition.server";

export type RecipeLineCostInfo = {
  itemVariationId: string | null;
  lastUnitCostAmount: number;
  avgUnitCostAmount: number;
};

export function buildRecipeLineCostSnapshot(
  costInfo: RecipeLineCostInfo,
  quantity: number,
  lossPct: number = 0
) {
  const safeLossPct = Math.min(99.9999, Math.max(0, Number(lossPct || 0)));
  const grossQuantity =
    safeLossPct > 0
      ? Number((quantity / (1 - safeLossPct / 100)).toFixed(6))
      : Number(quantity || 0);

  return {
    itemVariationId: costInfo.itemVariationId,
    lastUnitCostAmount: Number(costInfo.lastUnitCostAmount || 0),
    avgUnitCostAmount: Number(costInfo.avgUnitCostAmount || 0),
    lastTotalCostAmount: Number(
      ((costInfo.lastUnitCostAmount || 0) * grossQuantity).toFixed(6)
    ),
    avgTotalCostAmount: Number(
      ((costInfo.avgUnitCostAmount || 0) * grossQuantity).toFixed(6)
    ),
  };
}

export async function resolveRecipeLineCosts(
  db: any,
  itemId: string,
  variationId?: string | null
): Promise<RecipeLineCostInfo> {
  return await resolveItemCostSnapshot({
    db,
    itemId,
    variationId,
  });
}

export async function recalcRecipeCosts(db: any, recipeId: string) {
  const lines = await listRecipeCompositionLines(db, recipeId);

  for (const line of lines) {
    const variationId = line.ItemVariation?.variationId || null;
    const effectiveLossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0);
    const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId);
    const snapshot = buildRecipeLineCostSnapshot(
      costInfo,
      Number(line.quantity || 0),
      effectiveLossPct
    );

    await updateRecipeCompositionLine({
      db,
      lineId: line.id,
      recipeId,
      unit: line.unit,
      quantity: Number(line.quantity || 0),
      lossPct: effectiveLossPct,
      snapshot,
    });
  }

  return { updatedLines: lines.length };
}
