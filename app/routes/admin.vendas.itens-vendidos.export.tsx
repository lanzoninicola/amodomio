import { redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";

const ITEM_STATUS_FILTERS = ["active", "inactive", "all"] as const;
const EXPORT_VISIBILITY_FILTERS = ["all", "visible", "hidden"] as const;

export const meta: MetaFunction = () => [
  { title: "Vendas | Exportar itens vendidos" },
];

type ExportVisibilityFilter = (typeof EXPORT_VISIBILITY_FILTERS)[number];

function toSafeFilenameSegment(value: string | null | undefined) {
  const normalized = String(value || "canal")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "canal";
}

function parseExportVisibilityFilter(raw: string | null): ExportVisibilityFilter {
  const normalized = String(raw || "").trim().toLowerCase();
  return EXPORT_VISIBILITY_FILTERS.includes(normalized as ExportVisibilityFilter)
    ? (normalized as ExportVisibilityFilter)
    : "all";
}

function formatExportVisibilityLabel(value: ExportVisibilityFilter) {
  switch (value) {
    case "visible":
      return "somente visiveis";
    case "hidden":
      return "somente ocultos";
    default:
      return "todos os sabores";
  }
}

function splitIngredientText(value: string | null | undefined) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

function buildBaseItemWhere(params: { q: string; status: string; tagId: string }) {
  const where: any = { AND: [] as any[] };

  if (params.status === "active") where.active = true;
  if (params.status === "inactive") where.active = false;

  if (params.q) {
    where.AND.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
        { ItemSellingInfo: { is: { slug: { contains: params.q, mode: "insensitive" } } } },
      ],
    });
  }

  if (params.tagId) {
    where.AND.push({
      ItemTag: {
        some: {
          tagId: params.tagId,
        },
      },
    });
  }

  if (where.AND.length === 0) delete where.AND;

  return where;
}

function buildSoldItemWhere(cardapioChannelId: string) {
  return {
    canSell: true,
    active: true,
    ItemSellingInfo: {
      is: {
        upcoming: false,
      },
    },
    ItemSellingChannelItem: {
      some: {
        itemSellingChannelId: cardapioChannelId,
        visible: true,
      },
    },
    ItemSellingPriceVariation: {
      some: {
        itemSellingChannelId: cardapioChannelId,
      },
    },
  };
}

function mapSellingRow(item: any) {
  const channelLink = item.ItemSellingChannelItem?.[0] || null;
  const prices = item.ItemSellingPriceVariation || [];
  const referencePrice =
    prices.find((row: any) => row.ItemVariation?.isReference) ||
    prices[0] ||
    null;
  const upcoming = Boolean(item.ItemSellingInfo?.upcoming);
  const channelVisible = channelLink?.visible === true;
  const commerciallyReady = Boolean(item.canSell) && Boolean(item.active) && channelVisible && !upcoming && prices.length > 0;

  return {
    id: String(item.id),
    name: item.name || "Item sem nome",
    classification: item.classification || "",
    active: Boolean(item.active),
    canSell: Boolean(item.canSell),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
    categoryName: item.Category?.name || null,
    sellingCategoryName: item.ItemSellingInfo?.Category?.name || null,
    groupName: item.ItemSellingInfo?.ItemGroup?.name || null,
    slug: item.ItemSellingInfo?.slug || null,
    upcoming,
    channelVisible,
    totalVariations: (item.ItemVariation || []).length,
    totalPriceEntries: prices.length,
    channelPriceEntries: prices.length,
    referenceVariationName: referencePrice?.ItemVariation?.Variation?.name || null,
    referencePriceAmount: referencePrice ? Number(referencePrice.priceAmount || 0) : null,
    updatedBy: referencePrice?.updatedBy || null,
    commerciallyReady,
  };
}

function mapExportItem(item: any) {
  const row = mapSellingRow(item);
  const publicIngredientsText = item.ItemSellingInfo?.ingredients || null;
  const publicIngredients = splitIngredientText(publicIngredientsText);
  const priceEntries = (item.ItemSellingPriceVariation || []).map((price: any) => ({
    id: String(price.id),
    priceAmount: price.priceAmount == null ? null : Number(price.priceAmount),
    updatedAt: price.updatedAt ? new Date(price.updatedAt).toISOString() : null,
    updatedBy: price.updatedBy || null,
    variationName: price.ItemVariation?.Variation?.name || null,
    isReferenceVariation: Boolean(price.ItemVariation?.isReference),
  }));
  const variations = (item.ItemVariation || []).map((variation: any) => {
    const recipeIngredients = (variation.Recipe?.RecipeIngredient || []).map((ingredient: any) => ({
      id: String(ingredient.id),
      itemId: String(ingredient.IngredientItem?.id || ingredient.ingredientItemId || ""),
      name: ingredient.IngredientItem?.name || "Ingrediente sem nome",
      classification: ingredient.IngredientItem?.classification || null,
      notes: ingredient.notes || null,
    }));

    return {
      id: String(variation.id),
      name: variation.Variation?.name || null,
      isReference: Boolean(variation.isReference),
      recipe: variation.Recipe
        ? {
            id: String(variation.Recipe.id),
            name: variation.Recipe.name || null,
            isVegetarian: Boolean(variation.Recipe.isVegetarian),
            isGlutenFree: Boolean(variation.Recipe.isGlutenFree),
            ingredients: recipeIngredients,
          }
        : null,
    };
  });
  const recipeIngredients = variations
    .flatMap((variation) => variation.recipe?.ingredients || [])
    .filter((ingredient, index, all) => all.findIndex((candidate) => candidate.itemId === ingredient.itemId) === index);

  return {
    ...row,
    publicIngredientsText,
    publicIngredients,
    recipeIngredients,
    variations,
    priceEntries,
  };
}

function buildExportResponse(filename: string, payload: unknown) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect("/login");

  const db = prismaClient as any;
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const tagId = String(url.searchParams.get("tagId") || "").trim();
  const exportVisibility = parseExportVisibilityFilter(url.searchParams.get("exportVisibility"));
  const statusParam = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const status = ITEM_STATUS_FILTERS.includes(statusParam as (typeof ITEM_STATUS_FILTERS)[number])
    ? statusParam
    : "active";

  const channels = await db.itemSellingChannel.findMany({
    select: {
      id: true,
      key: true,
      name: true,
    },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
  });
  const tags = await db.tag.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });
  const selectedTag = tags.find((tag: any) => String(tag.id) === tagId) || null;

  const selectedChannelKeyParam = String(url.searchParams.get("channel") || "").trim().toLowerCase();
  const selectedChannel =
    channels.find((channel: any) => String(channel.key || "").toLowerCase() === selectedChannelKeyParam) ||
    channels[0] ||
    null;
  const cardapioChannel = channels.find((channel: any) => String(channel.key || "").toLowerCase() === "cardapio") || null;

  if (!selectedChannel) {
    return buildExportResponse("itens-vendidos-vazio.json", {
      meta: {
        source: "/admin/vendas/itens-vendidos",
        generatedAt: new Date().toISOString(),
        totals: { items: 0 },
      },
      items: [],
    });
  }

  const baseWhere = buildBaseItemWhere({ q, status, tagId: selectedTag ? String(selectedTag.id) : "" });
  const soldWhere = cardapioChannel ? buildSoldItemWhere(String(cardapioChannel.id)) : null;
  const where = {
    ...baseWhere,
    ...(soldWhere || {}),
    ItemSellingChannelItem: {
      some: {
        itemSellingChannelId: selectedChannel.id,
        ...(exportVisibility === "visible" ? { visible: true } : {}),
        ...(exportVisibility === "hidden" ? { visible: false } : {}),
      },
    },
  };

  const exportItems = await db.item.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      classification: true,
      active: true,
      canSell: true,
      updatedAt: true,
      Category: {
        select: {
          name: true,
        },
      },
      ItemSellingInfo: {
        select: {
          ingredients: true,
          slug: true,
          upcoming: true,
          Category: {
            select: {
              name: true,
            },
          },
          ItemGroup: {
            select: {
              name: true,
            },
          },
        },
      },
      ItemVariation: {
        where: { deletedAt: null },
        select: {
          id: true,
          isReference: true,
          Recipe: {
            select: {
              id: true,
              name: true,
              isVegetarian: true,
              isGlutenFree: true,
              RecipeIngredient: {
                select: {
                  id: true,
                  ingredientItemId: true,
                  notes: true,
                  sortOrderIndex: true,
                  IngredientItem: {
                    select: {
                      id: true,
                      name: true,
                      classification: true,
                    },
                  },
                },
                orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
              },
            },
          },
          Variation: {
            select: {
              name: true,
            },
          },
        },
      },
      ItemSellingChannelItem: {
        where: {
          itemSellingChannelId: selectedChannel.id,
        },
        select: {
          visible: true,
        },
        take: 1,
      },
      ItemSellingPriceVariation: {
        where: {
          itemSellingChannelId: selectedChannel.id,
        },
        select: {
          id: true,
          priceAmount: true,
          updatedAt: true,
          updatedBy: true,
          ItemVariation: {
            select: {
              isReference: true,
              Variation: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
  const generatedAt = new Date().toISOString();
  const filename = `itens-vendidos-${toSafeFilenameSegment(selectedChannel.key || selectedChannel.name)}-${exportVisibility}-${generatedAt.slice(0, 10)}.json`;

  return buildExportResponse(filename, {
    meta: {
      source: "/admin/vendas/itens-vendidos",
      generatedAt,
      purpose: "Exportacao JSON para analise no ChatGPT",
      filters: {
        q,
        status,
        tagId: selectedTag ? String(selectedTag.id) : null,
        tagName: selectedTag?.name || null,
        channelKey: String(selectedChannel.key || "").toLowerCase(),
        channelName: selectedChannel.name || String(selectedChannel.key || "").toUpperCase(),
        visibility: exportVisibility,
        visibilityLabel: formatExportVisibilityLabel(exportVisibility),
      },
      totals: {
        items: exportItems.length,
      },
      fieldNotes: {
        commerciallyReady: "true quando canSell, active, visivel no canal, nao upcoming e com preco no canal",
        referencePriceAmount: "preco da variacao marcada como referencia quando existir; fallback para o primeiro preco do canal",
        publicIngredientsText: "texto publico de ingredientes cadastrado na area comercial do item",
        publicIngredients: "lista derivada do texto publico de ingredientes, separada por virgula, ponto e virgula ou quebra de linha",
        recipeIngredients: "lista tecnica deduplicada de ingredientes vindos das receitas vinculadas as variacoes do item",
      },
    },
    aiContext: {
      instructionsForAI:
        "Leia este node aiContext antes de analisar items. Ele descreve o contexto, regras de visibilidade e significado dos campos. Nao trate aiContext como item/sabor exportado; os registros analisaveis estao em items.",
      datasetName: "Itens vendidos por canal",
      language: "pt-BR",
      businessContext:
        "Este JSON representa uma visao comercial dos itens/sabores vendidos em um canal de venda especifico da A Modo Mio. O objetivo e permitir analise por IA sobre disponibilidade, visibilidade no canal, precificacao e estrutura comercial dos itens.",
      routeContext:
        "A exportacao foi gerada a partir da pagina administrativa /admin/vendas/itens-vendidos. A pagina trabalha com o modelo nativo de Item, ItemVariation, ItemSellingChannelItem e ItemSellingPriceVariation.",
      selectedScope: {
        channel:
          "Todos os itens exportados pertencem ao canal informado em meta.filters.channelKey/channelName.",
        visibility:
          "meta.filters.visibility controla se o arquivo inclui todos os sabores do canal, somente os visiveis ou somente os ocultos.",
        activeFilters:
          "Os filtros de busca, status e tag selecionados na tela tambem foram aplicados antes da exportacao.",
      },
      visibilityRules: {
        channelVisible:
          "true quando existe vinculo ItemSellingChannelItem para o canal exportado com visible=true.",
        commerciallyReady:
          "true quando o item pode vender, esta ativo, esta visivel no canal, nao esta marcado como upcoming/lancamento e possui pelo menos um preco no canal.",
        hiddenItem:
          "Um item oculto no recorte de exportacao e aquele com vinculo ao canal selecionado, mas visible=false nesse canal.",
      },
      analysisHints: [
        "Use groupName, sellingCategoryName e categoryName para agrupar sabores por estrutura comercial.",
        "Use publicIngredients e recipeIngredients para avaliar se um sabor parece vegetariano ou vegano.",
        "Nao classifique um sabor como vegano apenas por isVegetarian=true; veganismo deve ser inferido pelos ingredientes e confirmado quando houver duvida.",
        "Use referencePriceAmount como preco principal quando quiser comparar preco por sabor.",
        "Use priceEntries para auditar todos os precos existentes no canal exportado.",
        "Use variations para entender quais variacoes existem e qual delas e a referencia.",
        "Use channelVisible e commerciallyReady para separar problema de visibilidade de problema de cadastro/preco.",
      ],
      importantFields: {
        id: "ID interno do Item.",
        name: "Nome comercial do item/sabor.",
        slug: "Slug publico quando configurado.",
        active: "Indica se o item esta ativo no cadastro.",
        canSell: "Indica se o item esta liberado para venda.",
        upcoming: "Indica item marcado como lancamento/proximamente.",
        channelVisible: "Visibilidade do item no canal exportado.",
        commerciallyReady: "Indicador derivado de prontidao comercial no canal.",
        referenceVariationName: "Nome da variacao usada como referencia de preco.",
        referencePriceAmount: "Preco principal usado para analise comparativa.",
        publicIngredientsText: "Texto livre de ingredientes visivel/comercial quando cadastrado.",
        publicIngredients: "Lista simples extraida do texto livre de ingredientes.",
        recipeIngredients: "Ingredientes tecnicos agregados das receitas das variacoes.",
        priceEntries: "Lista de precos cadastrados para o canal exportado.",
        variations: "Lista de variacoes ativas do item, incluindo receita e ingredientes quando vinculados.",
      },
    },
    items: exportItems.map(mapExportItem),
  });
}
