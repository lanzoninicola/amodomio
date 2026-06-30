import type {
  RecipeChatGptPromptItem,
  RecipeChatGptPromptLinkedVariation,
  RecipeChatGptPromptRecipe,
} from "./recipe-composition-chatgpt-assistant";

export type ExternalRecipeChatGptPromptParams = {
  recipe: RecipeChatGptPromptRecipe;
  items: RecipeChatGptPromptItem[];
  linkedVariations: RecipeChatGptPromptLinkedVariation[];
};

export function buildExternalRecipeChatGptPrompt(
  params: ExternalRecipeChatGptPromptParams
) {
  const { recipe, items, linkedVariations } = params;
  const allowedVariations = linkedVariations
    .filter((variation) => variation.itemVariationId)
    .map((variation) => ({
      itemVariationId: variation.itemVariationId,
      variationId: variation.variationId,
      variationName: variation.variationName || "Base",
      isReference: Boolean(variation.isReference),
    }));
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
    recipe: {
      name: recipe.name || "Nome da receita",
      description: "Descricao tecnica curta",
      type: recipe.type || "semiFinished",
      isVegetarian: false,
      isGlutenFree: false,
    },
    ingredients: [
      {
        itemId: "item_id_existente_ou_null",
        itemName: "Nome do ingrediente quando precisar criar item",
        classification: "insumo",
        unit: "UN",
        defaultLossPct: 0,
        variationQuantities: Object.fromEntries(
          allowedVariations.map((variation) => [variation.itemVariationId, 0])
        ),
      },
    ],
    missingIngredients: [
      {
        name: "ingrediente_sem_dados_suficientes",
        unit: "UN",
        notes: "motivo ou observacao opcional",
      },
    ],
  };

  return [
    "Voce esta convertendo uma receita culinaria criada no ChatGPT para o formato tecnico do sistema Amodomio.",
    "Use como fonte a receita que o usuario colou na conversa antes deste prompt.",
    "Responda somente com um bloco ```json``` valido, sem texto antes ou depois.",
    "O objetivo e preencher a receita aberta no sistema e criar itens de ingredientes quando eles ainda nao existirem.",
    "Use itemId somente quando houver correspondencia clara no CATALOGO_DE_ITENS_EXISTENTES.",
    "Quando o ingrediente necessario nao existir no catalogo, deixe itemId como null e preencha itemName com o nome limpo do item que deve ser criado.",
    "Nao invente IDs. Nao use itemId parecido se o ingrediente for diferente.",
    "Para todo ingrediente, retorne unit, defaultLossPct e variationQuantities para todas as variacoes permitidas.",
    "Se uma variacao nao usa o ingrediente, informe quantidade 0.",
    "Use classification 'insumo' para ingredientes comprados e 'semi_acabado' quando o ingrediente for uma preparacao intermediaria.",
    "Quando faltar informacao suficiente para criar/importar um ingrediente, liste em missingIngredients e nao inclua em ingredients.",
    "Nao inclua comentarios, markdown extra, explicacoes nem chaves adicionais.",
    "",
    "RECEITA_ABERTA_NO_SISTEMA",
    JSON.stringify(
      {
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipeType: recipe.type,
        recipeDescription: recipe.description || "",
      },
      null,
      2
    ),
    "",
    "VARIACOES_PERMITIDAS",
    JSON.stringify(allowedVariations, null, 2),
    "",
    "CATALOGO_DE_ITENS_EXISTENTES",
    JSON.stringify(allowedItems, null, 2),
    "",
    "REGRAS_DE_IMPORTACAO",
    JSON.stringify(
      {
        currentRecipeEffect:
          "A importacao preenche a receita aberta. O usuario escolhe no sistema se substitui a composicao atual ou apenas soma/atualiza os ingredientes do JSON.",
        newItemDefaults: {
          active: true,
          canPurchase: true,
          canTransform: false,
          canSell: false,
          canStock: true,
        },
        allowedRecipeTypes: ["semiFinished", "pizzaTopping"],
        allowedItemClassifications: ["insumo", "semi_acabado"],
      },
      null,
      2
    ),
    "",
    "FORMATO_OBRIGATORIO_DA_RESPOSTA",
    JSON.stringify(responseTemplate, null, 2),
  ].join("\n");
}

export function buildExternalRecipeRequestPrompt(
  params: Pick<ExternalRecipeChatGptPromptParams, "recipe">
) {
  const recipeName = params.recipe.name || "esta receita";

  return [
    `Crie uma receita para "${recipeName}" em formato culinario claro e operacional.`,
    "",
    "Depois da descricao da receita, inclua obrigatoriamente uma tabela Markdown de ingredientes com exatamente estas duas colunas:",
    "",
    "| Ingrediente | Quantidade |",
    "| --- | ---: |",
    "| Nome do ingrediente | quantidade + unidade |",
    "",
    "Regras para a tabela:",
    "- Use uma linha por ingrediente.",
    "- Escreva o ingrediente em nome simples, sem marca, salvo quando a marca for tecnicamente necessaria.",
    "- Escreva a quantidade com unidade na mesma celula, por exemplo: 12 g, 1 g (2 folhas), 15 ml, 1 L.",
    "- Quando um ingrediente for opcional, mantenha '(opcional)' no nome do ingrediente.",
    "- Nao misture modo de preparo dentro da tabela.",
    "- Depois da tabela, pode incluir modo de preparo, observacoes e rendimento.",
    "",
    "Exemplo do formato esperado:",
    "",
    "| Ingrediente | Quantidade |",
    "| --- | ---: |",
    "| Cerveja Pilsen | 1 L |",
    "| Sal | 12 g |",
    "| Louro seco | 1 g (2 folhas) |",
    "| Alecrim seco | 1 g |",
    "| Paprica defumada | 3 g |",
    "| Alho temperado amassado | 8 g |",
    "| Acucar mascavo ou mel | 8 g |",
    "| Pimenta-do-reino moida | 1 g |",
    "| Molho ingles (opcional) | 15 g |",
  ].join("\n");
}
