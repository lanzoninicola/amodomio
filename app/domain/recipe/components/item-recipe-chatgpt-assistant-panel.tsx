import { useFetcher } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import GptAssistantPanel from "~/components/gpt-assistant-panel";

type ItemRecipeChatGptAssistantPanelProps = {
  item: any;
  ingredientsCatalog: Array<{
    id: string;
    name: string;
    classification?: string | null;
    consumptionUm?: string | null;
  }>;
  externalUrl?: string;
  formAction?: string;
};

function buildItemRecipeChatGptPrompt(params: {
  item: any;
  ingredientsCatalog: ItemRecipeChatGptAssistantPanelProps["ingredientsCatalog"];
}) {
  const { item, ingredientsCatalog } = params;
  const sellingIngredientsRaw = String(item?.ItemSellingInfo?.ingredients || "").trim();
  const sellingLongDescription = String(item?.ItemSellingInfo?.longDescription || "").trim();
  const sellingNotesPublic = String(item?.ItemSellingInfo?.notesPublic || "").trim();
  const itemVariations = (item.ItemVariation || []).map((variation: any) => ({
    itemVariationId: variation.id,
    variationId: variation.variationId || null,
    variationName: variation?.Variation?.name || "Base",
    variationCode: variation?.Variation?.code || null,
    additionalInformation: variation?.Variation?.additionalInformation || null,
    isReference: Boolean(variation?.isReference),
  }));

  const allowedIngredients = ingredientsCatalog
    .filter((catalogItem) => String(catalogItem.id) !== String(item.id))
    .map((catalogItem) => ({
      itemId: catalogItem.id,
      name: catalogItem.name,
      classification: catalogItem.classification || null,
      consumptionUm: String(catalogItem.consumptionUm || "UN").trim().toUpperCase() || "UN",
    }));

  const responseTemplate = {
    recipe: {
      name: `Receita ${item.name}`,
      description: "Descricao curta opcional",
      type: "semiFinished",
      isVegetarian: false,
      isGlutenFree: false,
    },
    ingredients: [
      {
        itemId: "item_id_obrigatorio",
        unit: "UN",
        defaultLossPct: 0,
        variationQuantities: Object.fromEntries(
          itemVariations.map((variation: any) => [variation.itemVariationId, 0])
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
    "Voce esta montando uma receita tecnica de pizza no sistema Amodomio.",
    "O objetivo e criar automaticamente a receita vinculada ao item e a ficha tecnica de custo.",
    "Responda somente com um bloco ```json``` valido, sem texto antes ou depois.",
    "Use como fonte principal a LISTA_COMERCIAL_DE_INGREDIENTES_DO_SABOR.",
    "Essa lista comercial pode estar separada por virgula e, no final, por ' e '.",
    "Interprete essa lista como enumeracao de ingredientes do sabor de pizza.",
    "Use apenas itemId e itemVariationId permitidos abaixo.",
    "Nao invente ingredientes nem IDs.",
    "Retorne variationQuantities para todas as variacoes do item, mesmo quando a quantidade for 0.",
    "As quantidades devem representar o consumo sugerido por variacao.",
    "Se faltar componente estrutural de pizza, seja opinativo e complete a formulacao com bom senso tecnico.",
    "Considere explicitamente massa, molho, queijo base e cobertura principal do sabor.",
    "Molho de tomate e muçarela devem seguir a base fixa por tamanho definida abaixo, salvo impossibilidade tecnica clara no catalogo.",
    "Considere perdas por tamanho quando fizer sentido, principalmente em ingredientes de cobertura.",
    "Para pizzas, a quantidade de molho e queijo pode variar por tamanho, mantendo proporcionalidade tecnica.",
    "Quando a lista comercial citar ingredientes agregados ou ambiguos, mapeie para os insumos e semiacabados mais adequados do catalogo.",
    "Prefira semiacabados existentes do sistema quando eles substituirem uma combinacao manual de insumos.",
    "Quando faltar um ingrediente no catalogo, liste em missingIngredients e nao force itemId incorreto.",
    "Nao inclua comentarios, markdown extra, explicacoes nem chaves adicionais.",
    "",
    "ITEM_ALVO",
    JSON.stringify({
      itemId: item.id,
      itemName: item.name,
      itemDescription: item.description || "",
      classification: item.classification || null,
      consumptionUm: item.consumptionUm || null,
      recipeCount: Number(item.Recipe?.length || 0),
      itemCostSheetCount: Number(item.ItemCostSheet?.length || 0),
    }, null, 2),
    "",
    "LISTA_COMERCIAL_DE_INGREDIENTES_DO_SABOR",
    JSON.stringify({
      rawIngredientsText: sellingIngredientsRaw,
      parsingRule: "A lista pode vir separada por virgulas e o ultimo separador pode ser a palavra 'e'.",
      examples: [
        "calabresa, cebola roxa, azeitona e oregano",
        "molho de tomate, muçarela, parmesao e manjericao",
      ],
    }, null, 2),
    sellingLongDescription ? [
      "",
      "DESCRICAO_COMERCIAL_EXTENSA",
      JSON.stringify({ longDescription: sellingLongDescription }, null, 2),
    ].join("\n") : "",
    sellingNotesPublic ? [
      "",
      "OBSERVACOES_COMERCIAIS_PUBLICAS",
      JSON.stringify({ notesPublic: sellingNotesPublic }, null, 2),
    ].join("\n") : "",
    "",
    "VARIACOES_DO_ITEM",
    JSON.stringify(itemVariations, null, 2),
    "",
    "BASE_FIXA_POR_TAMANHO_PARA_MOLHO_E_MUCARELA",
    JSON.stringify({
      instruction: "Use estas quantidades como base obrigatoria para molho de tomate e muçarela nas variacoes de tamanho da pizza.",
      sizeRules: {
        medio: {
          molhoDeTomateG: 200,
          mucarelaG: 150,
        },
        familia: {
          rule: "x2 tamanho medio",
          molhoDeTomateG: 400,
          mucarelaG: 300,
        },
        pequena: {
          rule: "0.5 tamanho medio",
          molhoDeTomateG: 100,
          mucarelaG: 75,
        },
        individual: {
          rule: "0.5 tamanho pequena",
          molhoDeTomateG: 50,
          mucarelaG: 37.5,
        },
      },
      matchingRule: "Associe cada variacao pelo nome, codigo ou additionalInformation quando indicarem medio, familia, pequena ou individual.",
    }, null, 2),
    "",
    "CATALOGO_DE_INGREDIENTES_PERMITIDOS",
    JSON.stringify(allowedIngredients, null, 2),
    "",
    "REGRAS_DE_NEGOCIO",
    JSON.stringify({
      recipeNameSuggestion: `Receita ${item.name}`,
      itemCostSheetNameSuggestion: `Ficha tecnica ${item.name}`,
      allowedRecipeTypes: ["semiFinished", "pizzaTopping"],
      instruction: "A receita deve representar a composicao completa da pizza por variacao.",
      pizzaGuidance: [
        "identificar a base da pizza e seus componentes estruturais",
        "usar a lista comercial do sabor como referencia principal para a cobertura",
        "respeitar a base fixa de molho de tomate e muçarela por tamanho",
        "sugerir quantidades coerentes por tamanho",
        "aplicar defaultLossPct coerente para itens com perda tipica de manipulacao",
      ],
    }, null, 2),
    "",
    "FORMATO_OBRIGATORIO_DA_RESPOSTA",
    JSON.stringify(responseTemplate, null, 2),
  ].join("\n");
}

function extractMissingIngredientsPreview(value: string): Array<{
  name: string;
  unit: string | null;
  notes: string | null;
}> {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fencedMatch?.[1]?.trim() || raw;

  try {
    const parsed = JSON.parse(payload);
    const missingIngredients = Array.isArray(parsed?.missingIngredients) ? parsed.missingIngredients : [];
    return missingIngredients
      .map((ingredient) => ({
        name: String(ingredient?.name || "").trim(),
        unit: String(ingredient?.unit || "").trim().toUpperCase() || null,
        notes: String(ingredient?.notes || "").trim() || null,
      }))
      .filter((ingredient) => ingredient.name);
  } catch (_error) {
    return [];
  }
}

export default function ItemRecipeChatGptAssistantPanel(props: ItemRecipeChatGptAssistantPanelProps) {
  const { item, ingredientsCatalog, externalUrl, formAction = ".." } = props;
  const previewFetcher = useFetcher<any>();
  const [promptDraft, setPromptDraft] = useState("");
  const [chatGptResponse, setChatGptResponse] = useState("");
  const [lastPreviewedResponse, setLastPreviewedResponse] = useState("");
  const [existingRecipeImportMode, setExistingRecipeImportMode] = useState<"merge_existing" | "replace_existing">("replace_existing");
  const existingRecipes = Array.isArray(item?.Recipe) ? item.Recipe : [];
  const hasSingleExistingRecipe = existingRecipes.length === 1;
  const hasMultipleExistingRecipes = existingRecipes.length > 1;

  const chatGptPrompt = useMemo(
    () => buildItemRecipeChatGptPrompt({ item, ingredientsCatalog }),
    [item, ingredientsCatalog]
  );

  useEffect(() => {
    setPromptDraft(chatGptPrompt);
  }, [chatGptPrompt]);

  useEffect(() => {
    if (previewFetcher.state === "idle" && previewFetcher.data?.status === 200) {
      setLastPreviewedResponse(chatGptResponse.trim());
    }
  }, [previewFetcher.state, previewFetcher.data, chatGptResponse]);

  const hasUpToDatePreview =
    Boolean(chatGptResponse.trim()) &&
    lastPreviewedResponse === chatGptResponse.trim() &&
    previewFetcher.data?.status === 200;
  const previewPayload = previewFetcher.data?.payload;
  const pastedMissingIngredients = extractMissingIngredientsPreview(chatGptResponse);

  const handlePreviewImport = () => {
    const formData = new FormData();
    formData.set("_action", "item-recipe-chatgpt-preview");
    formData.set("chatGptResponse", chatGptResponse);
    formData.set("existingRecipeImportMode", existingRecipeImportMode);
    previewFetcher.submit(formData, { method: "post", action: formAction });
  };

  return (
    <GptAssistantPanel
      title="Assistente de receita"
      description="Monte um JSON para o ChatGPT sugerir a receita por variação, valide o retorno e gere automaticamente a receita vinculada e a ficha técnica."
      prompt={promptDraft}
      defaultPrompt={chatGptPrompt}
      onPromptChange={setPromptDraft}
      response={chatGptResponse}
      onResponseChange={setChatGptResponse}
      onPreview={handlePreviewImport}
      previewButtonLabel="Pré-visualizar criação"
      previewLoadingLabel="Validando..."
      previewDisabled={!chatGptResponse.trim() || previewFetcher.state !== "idle" || hasMultipleExistingRecipes}
      previewLoading={previewFetcher.state !== "idle"}
      submitActionName="item-recipe-chatgpt-import"
      submitButtonLabel="Criar receita e ficha"
      submitDisabled={!hasUpToDatePreview || hasMultipleExistingRecipes}
      formAction={formAction}
      hiddenFields={[
        { name: "existingRecipeImportMode", value: existingRecipeImportMode },
      ]}
      externalUrl={externalUrl}
      externalLabel="Abrir projeto"
      flowDescription="1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole o JSON retornado. 4. Gere a pré-visualização. 5. Confirme a criação automática."
      responsePlaceholder="Cole aqui a resposta do ChatGPT em JSON ou em bloco ```json```."
      responseHelperText={
        <>
          O import cria ou reaproveita a receita vinculada do item e cria ou reaproveita a ficha técnica principal. Ingredientes em <code>missingIngredients</code> não são importados.
        </>
      }
      copyToastTitle="Prompt copiado"
      copyToastContent="Cole o prompt no projeto de receitas do ChatGPT."
      beforeResponseContent={
        <>
          {hasMultipleExistingRecipes ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Este item já tem mais de uma receita vinculada. O assistente foi bloqueado para evitar atualização ambígua. Use o módulo de receitas para decidir manualmente qual receita deve continuar.
            </div>
          ) : null}

          {hasSingleExistingRecipe ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">A receita já existe</p>
                <p className="text-xs text-slate-500">
                  Escolha o efeito desejado antes de pré-visualizar ou importar. Receita atual: {existingRecipes[0]?.name || "Receita vinculada"}.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <input
                    type="radio"
                    name="existingRecipeImportModeVisual"
                    value="replace_existing"
                    checked={existingRecipeImportMode === "replace_existing"}
                    onChange={() => setExistingRecipeImportMode("replace_existing")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">Substituir composição atual</div>
                    <div className="text-xs text-slate-500">
                      Apaga os ingredientes atuais da receita e recria a composição com base apenas no JSON novo.
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <input
                    type="radio"
                    name="existingRecipeImportModeVisual"
                    value="merge_existing"
                    checked={existingRecipeImportMode === "merge_existing"}
                    onChange={() => setExistingRecipeImportMode("merge_existing")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">Atualizar sem apagar ingredientes antigos</div>
                    <div className="text-xs text-slate-500">
                      Atualiza cadastro e ingredientes citados no JSON, mas mantém ingredientes antigos que não vierem na resposta.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ) : null}
        </>
      }
      responseMetaContent={pastedMissingIngredients.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Ingredientes ainda não cadastrados detectados na resposta
          </p>
          <div className="space-y-2">
            {pastedMissingIngredients.map((ingredient, index) => (
              <div key={`${ingredient.name}-${index}`} className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-950">
                <div className="font-medium">{ingredient.name}</div>
                <div className="text-xs text-amber-800">
                  {ingredient.unit || "UM não informada"}{ingredient.notes ? ` · ${ingredient.notes}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      afterResponseContent={
        <>
          {previewFetcher.data?.status && previewFetcher.data.status >= 400 ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {previewFetcher.data.message}
            </div>
          ) : null}

          {hasUpToDatePreview && previewPayload ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="font-medium">
                  Receita: {previewPayload.recipe.mode === "create" ? "será criada" : "será atualizada"}
                </span>
                {previewPayload.recipe.effectDescription ? (
                  <span>{previewPayload.recipe.effectDescription}</span>
                ) : null}
                <span>
                  Ficha técnica: {previewPayload.itemCostSheet.mode === "create" ? "será criada" : "será reaproveitada"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="font-medium">{previewPayload.totals.importableIngredients} ingrediente(s) importável(eis)</span>
                <span>{previewPayload.totals.variationCells} célula(s) de variação</span>
                <span>{previewPayload.totals.missingIngredients} ingrediente(s) faltante(s)</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Importáveis</p>
                <div className="space-y-2">
                  {previewPayload.importableIngredients.map((ingredient: any) => (
                    <div key={ingredient.itemId} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-900">{ingredient.itemName}</div>
                        <div className="text-xs text-slate-500">
                          {ingredient.unit} · perda {ingredient.defaultLossPct}% · {ingredient.variationCount} variação(ões)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      }
    />
  );
}
