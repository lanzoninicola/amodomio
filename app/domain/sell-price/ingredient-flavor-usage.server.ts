import type { LoaderFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import type {
  FlavorUsage,
  IngredientFlavorUsagePayload,
  IngredientRankingRow,
  RecipeTabFilter,
  SellingChannelOption,
  UsageFilter,
} from "./ingredient-flavor-usage";

function parseUsageFilter(raw: string | null): UsageFilter {
  const normalized = String(raw || "").trim();
  if (normalized === "1" || normalized === "2" || normalized === "3") return normalized;
  return "all";
}

function parseTabFilter(raw: string | null): RecipeTabFilter {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "future") return "future";
  return "visible";
}

function buildRecipeItemWhere(params: { channelId: string; tab: RecipeTabFilter }) {
  return {
    canSell: true,
    active: true,
    ItemSellingInfo: {
      is: {
        upcoming: params.tab === "future",
      },
    },
    ItemSellingChannelItem: {
      some: {
        itemSellingChannelId: params.channelId,
        ...(params.tab === "visible" ? { visible: true } : {}),
      },
    },
    ItemVariation: {
      some: {
        deletedAt: null,
        Recipe: {
          is: {
            type: "pizzaTopping",
          },
        },
      },
    },
  };
}

function mapPublishedPizzaIngredientRows(items: any[]): IngredientRankingRow[] {
  const ingredientMap = new Map<
    string,
    {
      ingredientId: string;
      ingredientName: string;
      classification: string;
      active: boolean;
      itemIds: Set<string>;
      recipeIds: Set<string>;
      variationIds: Set<string>;
      flavorsByKey: Map<string, FlavorUsage>;
    }
  >();

  for (const item of items || []) {
    for (const itemVariation of item.ItemVariation || []) {
      const recipe = itemVariation.Recipe;
      if (!recipe || recipe.type !== "pizzaTopping") continue;

      const variationName = itemVariation.Variation?.name || null;
      for (const recipeIngredient of recipe.RecipeIngredient || []) {
        const ingredient = recipeIngredient.IngredientItem;
        if (!ingredient?.id) continue;

        const ingredientId = String(ingredient.id);
        const ingredientName = ingredient.name || "Ingrediente sem nome";
        const existing =
          ingredientMap.get(ingredientId) ||
          {
            ingredientId,
            ingredientName,
            classification: ingredient.classification || "",
            active: Boolean(ingredient.active),
            itemIds: new Set<string>(),
            recipeIds: new Set<string>(),
            variationIds: new Set<string>(),
            flavorsByKey: new Map<string, FlavorUsage>(),
          };

        const variationIngredient = (recipeIngredient.RecipeVariationIngredient || []).find(
          (row: any) => String(row.itemVariationId || "") === String(itemVariation.id)
        );
        const flavorKey = `${item.id}:${itemVariation.id}:${recipe.id}`;

        existing.active = existing.active || Boolean(ingredient.active);
        if (!existing.classification && ingredient.classification) {
          existing.classification = ingredient.classification;
        }
        existing.itemIds.add(String(item.id));
        existing.recipeIds.add(String(recipe.id));
        existing.variationIds.add(String(itemVariation.id));
        existing.flavorsByKey.set(flavorKey, {
          itemId: String(item.id),
          itemName: item.name || "Sabor sem nome",
          variationName,
          recipeName: recipe.name || null,
          quantity: variationIngredient ? Number(variationIngredient.quantity || 0) : null,
          unit: variationIngredient?.unit || null,
        });

        ingredientMap.set(ingredientId, existing);
      }
    }
  }

  return Array.from(ingredientMap.values())
    .map((row) => ({
      ingredientId: row.ingredientId,
      ingredientName: row.ingredientName,
      classification: row.classification,
      active: row.active,
      usageCount: row.recipeIds.size,
      recipeCount: row.recipeIds.size,
      variationCount: row.variationIds.size,
      flavors: Array.from(row.flavorsByKey.values()).sort((a, b) => a.itemName.localeCompare(b.itemName, "pt-BR")),
    }))
    .sort((a, b) => a.usageCount - b.usageCount || a.ingredientName.localeCompare(b.ingredientName, "pt-BR"));
}

export async function loadIngredientFlavorUsage({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    if (typeof db.item?.findMany !== "function" || typeof db.itemSellingChannel?.findMany !== "function") {
      return badRequest("Modelo Item não disponível no Prisma Client desta execução.");
    }

    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const usage = parseUsageFilter(url.searchParams.get("usage"));
    const tab = parseTabFilter(url.searchParams.get("tab"));
    const requestedChannelKey = String(url.searchParams.get("channel") || "cardapio").trim().toLowerCase();

    const channels = await db.itemSellingChannel.findMany({
      select: { id: true, key: true, name: true, sortOrderIndex: true },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });
    const selectedChannel =
      channels.find((channel: any) => String(channel.key || "").toLowerCase() === requestedChannelKey) ||
      channels.find((channel: any) => String(channel.key || "").toLowerCase() === "cardapio") ||
      channels[0] ||
      null;
    const channelOptions: SellingChannelOption[] = (channels || []).map((channel: any) => ({
      id: String(channel.id),
      key: String(channel.key || "").toLowerCase(),
      name: channel.name || String(channel.key || "").toUpperCase(),
    }));

    if (!selectedChannel?.id) {
      return ok({
        filters: { q, usage, channel: requestedChannelKey, tab },
        channels: [],
        tabCounts: {
          visible: 0,
          future: 0,
        },
        rows: [],
        summary: {
          flavorItems: 0,
          flavorVariations: 0,
          ingredients: 0,
          leastUsedIngredients: 0,
        },
      } satisfies IngredientFlavorUsagePayload);
    }

    const selectedWhere = buildRecipeItemWhere({
      channelId: String(selectedChannel.id),
      tab,
    });

    const [visibleCount, futureCount] = await Promise.all([
      db.item.count({
        where: buildRecipeItemWhere({
          channelId: String(selectedChannel.id),
          tab: "visible",
        }),
      }),
      db.item.count({
        where: buildRecipeItemWhere({
          channelId: String(selectedChannel.id),
          tab: "future",
        }),
      }),
    ]);

    const items = await db.item.findMany({
      where: selectedWhere,
      select: {
        id: true,
        name: true,
        ItemVariation: {
          where: {
            deletedAt: null,
            Recipe: {
              is: {
                type: "pizzaTopping",
              },
            },
          },
          select: {
            id: true,
            Variation: {
              select: {
                name: true,
              },
            },
            Recipe: {
              select: {
                id: true,
                name: true,
                type: true,
                RecipeIngredient: {
                  orderBy: [{ sortOrderIndex: "asc" }],
                  select: {
                    id: true,
                    IngredientItem: {
                      select: {
                        id: true,
                        name: true,
                        classification: true,
                        active: true,
                      },
                    },
                    RecipeVariationIngredient: {
                      select: {
                        itemVariationId: true,
                        quantity: true,
                        unit: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const rankingRows = mapPublishedPizzaIngredientRows(items);
    const filteredRows = rankingRows.filter((row) => {
      if (usage !== "all" && row.usageCount > Number(usage)) return false;
      if (!q) return true;
      const needle = q.toLocaleLowerCase("pt-BR");
      return (
        row.ingredientName.toLocaleLowerCase("pt-BR").includes(needle) ||
        row.flavors.some((flavor) => flavor.itemName.toLocaleLowerCase("pt-BR").includes(needle))
      );
    });

    const flavorVariations = (items || []).reduce(
      (total: number, item: any) => total + (item.ItemVariation || []).length,
      0
    );

    return ok({
      filters: {
        q,
        usage,
        channel: String(selectedChannel.key || "").toLowerCase(),
        tab,
      },
      channels: channelOptions,
      tabCounts: {
        visible: visibleCount,
        future: futureCount,
      },
      rows: filteredRows,
      summary: {
        flavorItems: items.length,
        flavorVariations,
        ingredients: rankingRows.length,
        leastUsedIngredients: rankingRows.filter((row) => row.usageCount <= 2).length,
      },
    } satisfies IngredientFlavorUsagePayload);
  } catch (error) {
    return serverError(error);
  }
}
