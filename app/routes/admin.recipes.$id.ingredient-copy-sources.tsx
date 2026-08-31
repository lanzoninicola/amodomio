import { type LoaderFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok } from "~/utils/http-response.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const recipeId = String(params.id || "").trim();
  const ingredientItemId = String(
    new URL(request.url).searchParams.get("ingredientItemId") || ""
  ).trim();

  if (!recipeId || !ingredientItemId) {
    return badRequest("Ingrediente inválido");
  }

  try {
    const db = prismaClient as any;
    const [targetIngredient, rows] = await Promise.all([
      db.recipeIngredient.findFirst({
        where: { recipeId, ingredientItemId },
        select: {
          RecipeVariationIngredient: {
            select: {
              ItemVariation: { select: { variationId: true } },
            },
          },
        },
      }),
      db.recipeIngredient.findMany({
        where: {
          ingredientItemId,
          recipeId: { not: recipeId },
          Recipe: { itemId: { not: null } },
        },
        select: {
          id: true,
          Recipe: {
            select: {
              id: true,
              name: true,
              status: true,
              version: true,
              updatedAt: true,
              Item: { select: { id: true, name: true } },
            },
          },
          RecipeVariationIngredient: {
            select: {
              quantity: true,
              ItemVariation: {
                select: {
                  Variation: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!targetIngredient) return badRequest("Ingrediente não encontrado");
    const targetVariationIds = new Set(
      targetIngredient.RecipeVariationIngredient.map((line: any) =>
        String(line.ItemVariation.variationId)
      )
    );

    const candidatesByItemId = new Map<string, any>();
    for (const row of rows) {
      const item = row.Recipe?.Item;
      const matchingQuantities = row.RecipeVariationIngredient.filter(
        (line: any) =>
          targetVariationIds.has(String(line.ItemVariation?.Variation?.id))
      );
      if (!item?.id || matchingQuantities.length === 0) continue;
      const candidate = {
        itemId: item.id,
        itemName: item.name,
        recipeId: row.Recipe.id,
        recipeName: row.Recipe.name,
        recipeIngredientId: row.id,
        recipeStatus: row.Recipe.status,
        recipeVersion: row.Recipe.version,
        updatedAt: row.Recipe.updatedAt,
        quantities: matchingQuantities.map((line: any) => ({
          variationId: line.ItemVariation?.Variation?.id || null,
          variationName: line.ItemVariation?.Variation?.name || "Base",
          quantity: Number(line.quantity || 0),
        })),
      };
      const current = candidatesByItemId.get(item.id);
      const candidatePriority = candidate.recipeStatus === "active" ? 1 : 0;
      const currentPriority = current?.recipeStatus === "active" ? 1 : 0;
      if (
        !current ||
        candidatePriority > currentPriority ||
        (candidatePriority === currentPriority &&
          new Date(candidate.updatedAt).getTime() >
            new Date(current.updatedAt).getTime())
      ) {
        candidatesByItemId.set(item.id, candidate);
      }
    }

    const candidates = Array.from(candidatesByItemId.values())
      .map(({ updatedAt: _updatedAt, ...candidate }) => candidate)
      .sort((a, b) => a.itemName.localeCompare(b.itemName, "pt-BR"));

    return ok({ candidates });
  } catch (error) {
    return badRequest(
      (error as Error)?.message || "Erro ao buscar receitas para copiar"
    );
  }
}
