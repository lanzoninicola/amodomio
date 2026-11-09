export type RecipeChatGptPromptRecipe = {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  costingMode?: string | null;
  yieldQuantity?: unknown;
  yieldUnit?: string | null;
};

export type RecipeChatGptPromptItem = {
  id: string;
  name: string;
  consumptionUm?: string | null;
  classification?: string | null;
};

export type RecipeChatGptPromptBaseIngredient = {
  recipeIngredientId: string | null;
  itemId: string;
  itemName: string;
};

export type RecipeChatGptPromptLine = {
  id: string;
  recipeIngredientId?: string | null;
  itemId: string;
  quantity?: unknown;
  unit?: unknown;
  defaultLossPct?: unknown;
  ItemVariation?: {
    id?: string | null;
    variationId?: string | null;
    Variation?: {
      name?: string | null;
    } | null;
  } | null;
};

export type RecipeChatGptPromptLinkedVariation = {
  itemVariationId?: string | null;
  variationId?: string | null;
  variationName?: string | null;
  variationKind?: string | null;
  variationCode?: string | null;
  isReference?: boolean | null;
};

export type RecipeChatGptPromptParams = {
  recipe: RecipeChatGptPromptRecipe;
  items: RecipeChatGptPromptItem[];
  baseIngredients: RecipeChatGptPromptBaseIngredient[];
  recipeLines: RecipeChatGptPromptLine[];
  linkedVariations: RecipeChatGptPromptLinkedVariation[];
};

export function resolveRecipeBuilderContext(params: {
  recipe: RecipeChatGptPromptRecipe;
  linkedVariations: RecipeChatGptPromptLinkedVariation[];
  recipeLines?: RecipeChatGptPromptLine[];
}) {
  const { recipe, linkedVariations, recipeLines = [] } = params;
  const isYieldMode = String(recipe.costingMode || "") === "yield";
  const availableVariations =
    linkedVariations.length > 0
      ? linkedVariations
          .filter((variation) => variation.itemVariationId)
          .map((variation) => ({
            itemVariationId: variation.itemVariationId,
            variationId: variation.variationId,
            variationName: variation.variationName || "Base",
            variationKind: variation.variationKind || null,
            variationCode: variation.variationCode || null,
            isReference: Boolean(variation.isReference),
          }))
      : Array.from(
          new Map(
            recipeLines
              .filter((line) => line.ItemVariation?.id)
              .map((line) => [
                String(line.ItemVariation?.id),
                {
                  itemVariationId: String(line.ItemVariation?.id),
                  variationId: line.ItemVariation?.variationId || null,
                  variationName: line.ItemVariation?.Variation?.name || "Base",
                  variationKind: null,
                  variationCode: null,
                  isReference: false,
                },
              ])
          ).values()
        );
  const yieldVariation =
    availableVariations.find(
      (variation) =>
        variation.variationKind === "base" && variation.variationCode === "base"
    ) ||
    availableVariations.find((variation) => variation.isReference) ||
    availableVariations[0];
  const allowedVariations = isYieldMode
    ? yieldVariation
      ? [{ ...yieldVariation, variationName: "Lote por rendimento" }]
      : []
    : availableVariations;

  return {
    isYieldMode,
    mode: isYieldMode ? "yield" : "per_variation",
    modeLabel: isYieldMode ? "Por rendimento" : "Por variação/tamanho",
    yieldQuantity: isYieldMode ? Number(recipe.yieldQuantity || 0) : null,
    yieldUnit: isYieldMode
      ? String(recipe.yieldUnit || "")
          .trim()
          .toUpperCase()
      : null,
    allowedVariations,
  };
}

export function buildRecipeChatGptPrompt(params: RecipeChatGptPromptParams) {
  const { recipe, items, baseIngredients, recipeLines, linkedVariations } =
    params;

  const builderContext = resolveRecipeBuilderContext({
    recipe,
    linkedVariations,
    recipeLines,
  });
  const { allowedVariations } = builderContext;
  const allowedVariationIds = new Set(
    allowedVariations.map((variation) => String(variation.itemVariationId))
  );

  const currentComposition = baseIngredients.map((ingredient) => {
    const lines = recipeLines.filter(
      (line) => String(line.itemId) === ingredient.itemId
    );
    const firstLine = lines[0];
    const variationQuantities = lines.reduce((acc, line) => {
      const itemVariationId = String(line.ItemVariation?.id || "");
      if (itemVariationId && allowedVariationIds.has(itemVariationId)) {
        acc[itemVariationId] = Number(line.quantity || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      recipeIngredientId: ingredient.recipeIngredientId,
      itemId: ingredient.itemId,
      itemName: ingredient.itemName,
      unit:
        String(firstLine?.unit || "UN")
          .trim()
          .toUpperCase() || "UN",
      defaultLossPct: Number(firstLine?.defaultLossPct || 0),
      variationQuantities,
    };
  });

  const allowedItems = items.map((item) => ({
    itemId: item.id,
    name: item.name,
    consumptionUm:
      String(item.consumptionUm || "UN")
        .trim()
        .toUpperCase() || "UN",
    classification: item.classification || null,
  }));

  const responseTemplate = {
    recipeId: recipe.id,
    ingredients: [
      {
        itemId: "item_id_obrigatorio",
        action: "upsert",
        unit: "UN",
        defaultLossPct: 0,
        variationQuantities: Object.fromEntries(
          allowedVariations.map((variation) => [variation.itemVariationId, 0])
        ),
      },
    ],
    missingIngredients: [
      {
        name: "ingrediente_nao_cadastrado",
        unit: "UN",
        notes: "motivo ou observacao opcional",
      },
    ],
  };

  return [
    "Voce esta preenchendo a composicao tecnica de uma receita no sistema Amodomio.",
    "Responda somente com um bloco ```json``` valido, sem texto antes ou depois.",
    "Nao invente itemId nem itemVariationId. Use apenas os IDs permitidos abaixo.",
    `MODALIDADE DA RECEITA: ${builderContext.modeLabel}.`,
    builderContext.isYieldMode
      ? `As quantidades representam o consumo total do lote que rende ${
          builderContext.yieldQuantity
        } ${
          builderContext.yieldUnit || "UM"
        }. Use somente a coluna tecnica \"Lote por rendimento\".`
      : "As quantidades devem ser informadas separadamente para cada variacao/tamanho permitido.",
    "defaultLossPct representa a perda eventual do ingrediente em percentual. Use 0 quando nao houver perda; quando houver limpeza, descarte, evaporacao ou outra quebra previsivel, informe o percentual estimado.",
    "A quantidade informada deve ser a quantidade bruta usada no preparo. O rendimento cadastrado e o resultado liquido esperado do lote.",
    "REGRA ABSOLUTA: quando COMPOSICAO_ATUAL nao estiver vazia, cada itemId presente nela DEVE aparecer na lista ingredients com action upsert.",
    "PROIBIDO usar action delete para qualquer itemId presente em COMPOSICAO_ATUAL. A decisao de eliminar e feita pelo usuario no sistema.",
    "Para cada ingrediente de COMPOSICAO_ATUAL, sugira a quantidade adequada para cada variacao. Se nao entrar em uma variacao, use 0.",
    "Depois de incluir todos os ingredientes de COMPOSICAO_ATUAL, voce pode adicionar ingredientes extras do catalogo com action upsert.",
    "O usuario avaliara os extras e eliminara o que nao quiser diretamente no sistema.",
    "Para todo ingrediente com action upsert, retorne unit, defaultLossPct e variationQuantities para todas as variacoes listadas.",
    "Se faltar algum ingrediente no catalogo do sistema, nao force um itemId incorreto.",
    "Ingredientes nao cadastrados devem ir em missingIngredients com name, unit e notes.",
    "Nao inclua comentarios, markdown extra, explicacoes nem chaves adicionais.",
    "VERIFICACAO FINAL antes de responder: confirme que cada itemId de COMPOSICAO_ATUAL esta presente em ingredients com action upsert e variationQuantities preenchidas.",
    "",
    "RECEITA_ATUAL",
    JSON.stringify(
      {
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipeType: recipe.type,
        recipeDescription: recipe.description || "",
        costingMode: builderContext.mode,
        costingModeLabel: builderContext.modeLabel,
        yieldQuantity: builderContext.yieldQuantity,
        yieldUnit: builderContext.yieldUnit,
      },
      null,
      2
    ),
    "",
    "VARIACOES_PERMITIDAS",
    JSON.stringify(allowedVariations, null, 2),
    "",
    "CATALOGO_DE_INGREDIENTES_PERMITIDOS",
    JSON.stringify(allowedItems, null, 2),
    "",
    "REGRA_PARA_INGREDIENTES_NAO_CADASTRADOS",
    JSON.stringify(
      {
        instruction:
          "Quando o ingrediente necessario nao existir no catalogo permitido, liste-o em missingIngredients e nao o inclua em ingredients.",
      },
      null,
      2
    ),
    "",
    "COMPOSICAO_ATUAL",
    JSON.stringify(currentComposition, null, 2),
    "",
    "FORMATO_OBRIGATORIO_DA_RESPOSTA",
    JSON.stringify(responseTemplate, null, 2),
  ].join("\n");
}
