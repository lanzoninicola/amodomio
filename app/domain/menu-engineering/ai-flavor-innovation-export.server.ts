import prismaClient from "~/lib/prisma/client.server";

const SALES_WINDOW_DAYS = 365;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function latestActiveSheet(sheets: any[]) {
  return (
    [...sheets]
      .filter((sheet) => sheet.isActive && sheet.status === "active")
      .sort((left, right) => {
        const leftDate = left.activatedAt
          ? new Date(left.activatedAt).getTime()
          : 0;
        const rightDate = right.activatedAt
          ? new Date(right.activatedAt).getTime()
          : 0;
        return (
          rightDate - leftDate || Number(right.version) - Number(left.version)
        );
      })[0] || null
  );
}

function currentIngredientCost(item: any) {
  const variations = (item.ItemVariation || [])
    .filter((variation: any) => variation.ItemCostVariation)
    .sort(
      (left: any, right: any) =>
        Number(right.isReference) - Number(left.isReference)
    );
  const variation = variations[0] || null;
  if (!variation) return null;
  return {
    amount: round(Number(variation.ItemCostVariation.costAmount || 0), 4),
    unit: variation.ItemCostVariation.unit || item.consumptionUm || null,
    source: variation.ItemCostVariation.source || null,
    variation: variation.Variation?.name || null,
    updatedAt: variation.ItemCostVariation.updatedAt
      ? new Date(variation.ItemCostVariation.updatedAt).toISOString()
      : null,
  };
}

const ingredientItemSelect = {
  id: true,
  name: true,
  classification: true,
  active: true,
  canPurchase: true,
  canStock: true,
  purchaseUm: true,
  consumptionUm: true,
  purchaseToConsumptionFactor: true,
  ItemVariation: {
    where: { deletedAt: null },
    select: {
      isReference: true,
      Variation: { select: { name: true } },
      ItemCostVariation: {
        select: {
          costAmount: true,
          unit: true,
          source: true,
          updatedAt: true,
        },
      },
    },
  },
} as const;

export async function buildAiFlavorInnovationExport() {
  const db = prismaClient as any;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SALES_WINDOW_DAYS);

  const [cardapioChannel, imports] = await Promise.all([
    db.itemSellingChannel.findFirst({
      where: { key: "cardapio" },
      select: { id: true, key: true, name: true },
    }),
    db.menuEngineeringImport.findMany({
      where: { periodEnd: { gte: cutoff } },
      select: {
        periodStart: true,
        periodEnd: true,
        items: { select: { topping: true, quantity: true, value: true } },
      },
      orderBy: { periodStart: "asc" },
    }),
  ]);

  if (!cardapioChannel) {
    throw new Error("O canal Cardápio não foi encontrado.");
  }

  const flavors = await db.item.findMany({
    where: {
      ItemSellingChannelItem: {
        some: {
          itemSellingChannelId: cardapioChannel.id,
          visible: true,
        },
      },
      ItemVariation: {
        some: {
          deletedAt: null,
          Recipe: { is: { type: "pizzaTopping" } },
        },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      classification: true,
      Category: { select: { name: true } },
      ItemSellingInfo: {
        select: {
          longDescription: true,
          ingredients: true,
          baseIngredients: true,
          notesPublic: true,
          Category: { select: { name: true } },
        },
      },
      ItemVariation: {
        where: {
          deletedAt: null,
          Recipe: { is: { type: "pizzaTopping" } },
        },
        select: {
          id: true,
          isReference: true,
          Variation: { select: { name: true } },
          Recipe: {
            select: {
              id: true,
              name: true,
              status: true,
              version: true,
              isVegetarian: true,
              isGlutenFree: true,
              RecipeIngredient: {
                orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  defaultLossPct: true,
                  notes: true,
                  sortOrderIndex: true,
                  IngredientItem: { select: ingredientItemSelect },
                  RecipeVariationIngredient: {
                    select: {
                      itemVariationId: true,
                      unit: true,
                      quantity: true,
                      lossPct: true,
                    },
                  },
                },
              },
            },
          },
          ItemCostSheet: {
            where: { isActive: true, status: "active" },
            select: {
              id: true,
              version: true,
              status: true,
              isActive: true,
              costAmount: true,
              activatedAt: true,
              updatedAt: true,
            },
          },
          ItemSellingPriceVariation: {
            where: { itemSellingChannelId: cardapioChannel.id },
            select: { priceAmount: true, updatedAt: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const salesByFlavor = new Map<
    string,
    { quantity: number; revenue: number }
  >();
  for (const reportImport of imports) {
    for (const row of reportImport.items) {
      const key = normalize(row.topping);
      const current = salesByFlavor.get(key) || { quantity: 0, revenue: 0 };
      current.quantity += Number(row.quantity || 0);
      current.revenue += Number(row.value || 0);
      salesByFlavor.set(key, current);
    }
  }

  const ingredientUsage = new Map<
    string,
    { item: any; flavorNames: Set<string>; recipeQuantityLines: number }
  >();
  const warnings = new Set<string>();

  const exportedFlavors = flavors.map((flavor: any) => {
    const missing = new Set<string>();
    const sales = salesByFlavor.get(normalize(flavor.name)) || null;
    if (!sales) missing.add("historico_de_vendas");

    const variations = flavor.ItemVariation.map((variation: any) => {
      const recipe = variation.Recipe;
      const sheet = latestActiveSheet(variation.ItemCostSheet || []);
      const priceRow = variation.ItemSellingPriceVariation?.[0] || null;
      const price = priceRow ? Number(priceRow.priceAmount || 0) : null;
      const cost = sheet ? Number(sheet.costAmount || 0) : null;
      if (!recipe) missing.add("receita");
      if (!sheet)
        missing.add(
          `ficha_de_custo:${variation.Variation?.name || "sem_variacao"}`
        );
      if (!priceRow)
        missing.add(`preco:${variation.Variation?.name || "sem_variacao"}`);

      const ingredients = (recipe?.RecipeIngredient || []).map((row: any) => {
        const item = row.IngredientItem;
        const quantityLine = (row.RecipeVariationIngredient || []).find(
          (line: any) => String(line.itemVariationId) === String(variation.id)
        );
        const usage = ingredientUsage.get(String(item.id)) || {
          item,
          flavorNames: new Set<string>(),
          recipeQuantityLines: 0,
        };
        usage.flavorNames.add(flavor.name);
        if (quantityLine) usage.recipeQuantityLines += 1;
        ingredientUsage.set(String(item.id), usage);
        if (!quantityLine) {
          missing.add(
            `quantidade:${item.name}:${
              variation.Variation?.name || "sem_variacao"
            }`
          );
        }
        if (!currentIngredientCost(item)) {
          missing.add(`custo_ingrediente:${item.name}`);
        }

        return {
          itemId: String(item.id),
          name: item.name,
          classification: item.classification,
          quantity: quantityLine
            ? round(Number(quantityLine.quantity || 0), 4)
            : null,
          unit: quantityLine?.unit || item.consumptionUm || null,
          lossPct:
            quantityLine?.lossPct == null
              ? round(Number(row.defaultLossPct || 0), 2)
              : round(Number(quantityLine.lossPct), 2),
          notes: row.notes || null,
          currentUnitCost: currentIngredientCost(item),
        };
      });

      const grossMarginAmount =
        price != null && cost != null ? round(price - cost) : null;
      const grossMarginPct =
        price != null && price > 0 && cost != null
          ? round(((price - cost) / price) * 100)
          : null;

      return {
        itemVariationId: String(variation.id),
        name: variation.Variation?.name || null,
        isReference: Boolean(variation.isReference),
        sellingPrice: price == null ? null : round(price),
        activeCostSheet: sheet
          ? {
              id: String(sheet.id),
              version: Number(sheet.version),
              costAmount: round(cost!),
              activatedAt: sheet.activatedAt
                ? new Date(sheet.activatedAt).toISOString()
                : null,
              updatedAt: new Date(sheet.updatedAt).toISOString(),
            }
          : null,
        estimatedGrossMargin: {
          amount: grossMarginAmount,
          percentage: grossMarginPct,
          note: "Preço menos custo da ficha ativa; não desconta impostos, taxas ou custos fixos adicionais.",
        },
        recipe: recipe
          ? {
              id: String(recipe.id),
              name: recipe.name,
              status: recipe.status,
              version: Number(recipe.version),
              isVegetarian: Boolean(recipe.isVegetarian),
              isGlutenFree: Boolean(recipe.isGlutenFree),
              ingredients,
            }
          : null,
      };
    });

    if (missing.size)
      warnings.add(`${flavor.name}: ${Array.from(missing).join(", ")}`);

    return {
      itemId: String(flavor.id),
      name: flavor.name,
      description: flavor.description || null,
      longDescription: flavor.ItemSellingInfo?.longDescription || null,
      category:
        flavor.ItemSellingInfo?.Category?.name || flavor.Category?.name || null,
      publicIngredients: flavor.ItemSellingInfo?.ingredients || null,
      baseIngredients: flavor.ItemSellingInfo?.baseIngredients || null,
      publicNotes: flavor.ItemSellingInfo?.notesPublic || null,
      recentSales: sales
        ? { quantity: round(sales.quantity, 2), revenue: round(sales.revenue) }
        : null,
      variations,
      incompleteData: Array.from(missing),
    };
  });

  const usedIngredientIds = Array.from(ingredientUsage.keys());
  const unusedPurchasableIngredients = await db.item.findMany({
    where: {
      active: true,
      archivedAt: null,
      canPurchase: true,
      ...(usedIngredientIds.length ? { id: { notIn: usedIngredientIds } } : {}),
      ItemVariation: {
        some: { deletedAt: null, ItemCostVariation: { isNot: null } },
      },
    },
    select: ingredientItemSelect,
    orderBy: { name: "asc" },
  });

  const usedIngredients = Array.from(ingredientUsage.values())
    .map(({ item, flavorNames, recipeQuantityLines }) => ({
      itemId: String(item.id),
      name: item.name,
      classification: item.classification,
      active: Boolean(item.active),
      canPurchase: Boolean(item.canPurchase),
      canStock: Boolean(item.canStock),
      purchaseUnit: item.purchaseUm || null,
      consumptionUnit: item.consumptionUm || null,
      purchaseToConsumptionFactor: item.purchaseToConsumptionFactor,
      currentUnitCost: currentIngredientCost(item),
      usage: {
        flavorCount: flavorNames.size,
        flavors: Array.from(flavorNames).sort((a, b) =>
          a.localeCompare(b, "pt-BR")
        ),
        recipeQuantityLines,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const availableUnusedIngredients = unusedPurchasableIngredients.map(
    (item: any) => ({
      itemId: String(item.id),
      name: item.name,
      classification: item.classification,
      purchaseUnit: item.purchaseUm || null,
      consumptionUnit: item.consumptionUm || null,
      purchaseToConsumptionFactor: item.purchaseToConsumptionFactor,
      currentUnitCost: currentIngredientCost(item),
    })
  );

  const generatedAt = new Date().toISOString();
  return {
    meta: {
      dataset: "A Modo Mio — inovação de sabores",
      generatedAt,
      sourceRoute: "/admin/vendas/ingredientes-sabores/brainstorming",
      channel: { key: cardapioChannel.key, name: cardapioChannel.name },
      selectionRule:
        "Somente sabores visíveis no canal Cardápio com receita do tipo pizzaTopping.",
      salesPeriod: {
        requestedWindowDays: SALES_WINDOW_DAYS,
        start: imports[0]?.periodStart?.toISOString() || null,
        end: imports[imports.length - 1]?.periodEnd?.toISOString() || null,
      },
      totals: {
        flavors: exportedFlavors.length,
        usedIngredients: usedIngredients.length,
        availableUnusedIngredients: availableUnusedIngredients.length,
        flavorsWithIncompleteData: exportedFlavors.filter(
          (flavor: any) => flavor.incompleteData.length > 0
        ).length,
      },
      financialDisclaimer:
        "As margens são estimativas baseadas no preço atual do Cardápio e no custo da ficha ativa. Não representam margem líquida realizada.",
    },
    aiInstructions: {
      role: "Atue como especialista em desenvolvimento de produtos, engenharia de cardápio e rentabilidade de pizzarias artesanais.",
      objective:
        "Sugira novos sabores especiais, comercialmente distintos e coerentes com a identidade da A Modo Mio, priorizando boa margem e aproveitamento inteligente dos ingredientes já comprados.",
      rules: [
        "Não invente custos, quantidades ou disponibilidade. Declare claramente qualquer hipótese.",
        "Priorize ingredientes já usados; use ingredientes disponíveis não usados somente quando agregarem diferenciação real.",
        "Evite reproduzir sabores ou combinações já presentes no cardápio ativo.",
        "Considere popularidade dos sabores existentes, recorrência das combinações, custo e potencial de preço percebido.",
        "Trate estimatedGrossMargin como margem bruta estimada, não como lucro líquido.",
        "Quando os dados forem insuficientes, proponha um teste controlado em vez de afirmar a rentabilidade.",
      ],
      requestedOutput: [
        "Apresente de 8 a 12 propostas ranqueadas.",
        "Para cada proposta informe nome, conceito, ingredientes, inspiração, diferencial e público provável.",
        "Indique quais ingredientes já existem e quais precisariam ser comprados.",
        "Estime custo, faixa de preço e margem somente quando os dados permitirem, mostrando as premissas.",
        "Atribua notas de 0 a 10 para originalidade, aderência à marca, viabilidade operacional e potencial de margem.",
        "Escolha as três melhores propostas e sugira um teste de produção e venda.",
      ],
    },
    flavors: exportedFlavors,
    usedIngredients,
    availableUnusedIngredients,
    dataQualityWarnings: Array.from(warnings),
  };
}
