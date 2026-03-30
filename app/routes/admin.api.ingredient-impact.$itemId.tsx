import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";

// ─── public types ─────────────────────────────────────────────────────────────

export type IngredientImpactVariation = {
  variationId: string;
  variationName: string;
  variationCode: string;
  variationKind: string | null;
  quantity: number;
  unit: string;
  lossPct: number;
  grossQuantity: number;
  costBefore: number;
  costAfter: number;
  delta: number;
};

export type IngredientImpactRecipe = {
  recipeId: string;
  recipeName: string;
  recipeType: string;
  variations: IngredientImpactVariation[];
};

export type IngredientImpactData = {
  itemId: string;
  itemName: string;
  consumptionUm: string | null;
  recipes: IngredientImpactRecipe[];
};

// ─── loader ───────────────────────────────────────────────────────────────────

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { itemId } = params;
  const url = new URL(request.url);
  const previous = Number(url.searchParams.get("previous") ?? "NaN");
  const current = Number(url.searchParams.get("current") ?? "NaN");

  if (!itemId || !Number.isFinite(previous) || !Number.isFinite(current) || current === 0) {
    return json<IngredientImpactData>({ itemId: itemId ?? "", itemName: "", consumptionUm: null, recipes: [] });
  }

  const db = prismaClient as any;

  const [item, ingredientRows] = await Promise.all([
    db.item.findUnique({
      where: { id: itemId },
      select: { name: true, consumptionUm: true },
    }),
    db.recipeIngredient.findMany({
      where: { ingredientItemId: itemId },
      include: {
        Recipe: {
          select: {
            id: true,
            name: true,
            type: true,
            Item: { select: { name: true } },
          },
        },
        RecipeVariationIngredient: {
          include: {
            ItemVariation: {
              include: {
                Variation: { select: { id: true, name: true, code: true, kind: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const consumptionUm = item?.consumptionUm ?? null;

  const recipes: IngredientImpactRecipe[] = ingredientRows
    .map((row: any) => {
      const recipe = row.Recipe;
      if (!recipe) return null;

      const variations: IngredientImpactVariation[] = (row.RecipeVariationIngredient ?? [])
        .map((rvi: any) => {
          const variation = rvi.ItemVariation?.Variation;
          if (!variation) return null;

          const quantity = Number(rvi.quantity ?? 0);
          const lossPct = Number(rvi.lossPct ?? row.defaultLossPct ?? 0);
          const safeLoss = Math.min(99.9999, Math.max(0, lossPct));
          const grossQuantity = safeLoss > 0 ? quantity / (1 - safeLoss / 100) : quantity;

          let costBefore: number;
          let costAfter: number;

          const recipeUnit = String(rvi.unit ?? "").trim().toUpperCase();
          const itemCUnit = String(consumptionUm ?? "").trim().toUpperCase();
          const lastTotal = Number(rvi.lastTotalCostAmount ?? 0);

          if (!recipeUnit || !itemCUnit || recipeUnit === itemCUnit) {
            // Units match (or unknown) — direct calculation using the normalised prices
            costBefore = previous * grossQuantity;
            costAfter = current * grossQuantity;
          } else if (lastTotal > 0) {
            // Units differ — scale the last stored total by the price ratio
            costBefore = lastTotal * (previous / current);
            costAfter = lastTotal;
          } else {
            costBefore = previous * grossQuantity;
            costAfter = current * grossQuantity;
          }

          return {
            variationId: variation.id,
            variationName: variation.name,
            variationCode: variation.code,
            variationKind: variation.kind ?? null,
            quantity,
            unit: rvi.unit ?? "",
            lossPct,
            grossQuantity,
            costBefore,
            costAfter,
            delta: costAfter - costBefore,
          } satisfies IngredientImpactVariation;
        })
        .filter(Boolean);

      if (variations.length === 0) return null;

      return {
        recipeId: recipe.id,
        recipeName: recipe.name ?? recipe.Item?.name ?? "Receita",
        recipeType: recipe.type ?? "",
        variations,
      } satisfies IngredientImpactRecipe;
    })
    .filter(Boolean) as IngredientImpactRecipe[];

  return json<IngredientImpactData>({ itemId: itemId!, itemName: item?.name ?? "", consumptionUm, recipes });
}
