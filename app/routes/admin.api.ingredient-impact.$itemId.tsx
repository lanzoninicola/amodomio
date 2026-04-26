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
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { name: true, consumptionUm: true },
  });

  return json<IngredientImpactData>({
    itemId: itemId!,
    itemName: item?.name ?? "",
    consumptionUm: item?.consumptionUm ?? null,
    recipes: [],
  });
}
