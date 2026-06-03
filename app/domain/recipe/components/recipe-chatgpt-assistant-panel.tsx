import { useFetcher, useOutletContext } from "@remix-run/react";
import { RotateCcw, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import GptAssistantPanel from "~/components/gpt-assistant-panel";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { AdminRecipeOutletContext } from "~/routes/admin.recipes.$id";
import { buildRecipeChatGptPrompt } from "../recipe-composition-chatgpt-assistant";
import MissingIngredientsPreview, {
  extractMissingIngredientsPreview,
} from "./missing-ingredients-preview";

export type RecipeChatGptAssistantContext = {
  recipe: AdminRecipeOutletContext["recipe"];
  items: AdminRecipeOutletContext["items"];
  recipeLines: AdminRecipeOutletContext["recipeLines"];
  linkedVariations: AdminRecipeOutletContext["linkedVariations"];
  chatGptProjectUrl: string;
};

type RecipeChatGptAssistantPanelProps = {
  context?: RecipeChatGptAssistantContext;
  formAction?: string;
  backTo?: string;
  backLabel?: string;
};

export default function RecipeChatGptAssistantPanel(
  props: RecipeChatGptAssistantPanelProps
) {
  const outletContext = useOutletContext<
    AdminRecipeOutletContext | undefined
  >();
  const resolvedContext = props.context || outletContext;

  if (!resolvedContext) {
    throw new Error(
      "RecipeChatGptAssistantPanel requires context via props or outlet context"
    );
  }

  const { recipe, items, recipeLines, linkedVariations, chatGptProjectUrl } =
    resolvedContext;
  const formAction = props.formAction || "..";
  const backTo = props.backTo || `/admin/recipes/${recipe.id}/composicao`;
  const backLabel = props.backLabel || "Voltar para composição";
  const previewFetcher = useFetcher<any>();
  const [promptDraft, setPromptDraft] = useState("");
  const [chatGptResponse, setChatGptResponse] = useState("");
  const [lastPreviewedResponse, setLastPreviewedResponse] = useState("");
  const referenceVariationId = useMemo(() => {
    const ref = linkedVariations.find((v) => v.isReference && v.itemVariationId);
    return ref?.itemVariationId ? String(ref.itemVariationId) : "__all";
  }, [linkedVariations]);
  const [previewVariationFilter, setPreviewVariationFilter] = useState(referenceVariationId);
  const [ignoredDeleteItemIds, setIgnoredDeleteItemIds] = useState<string[]>([]);
  const [manualDeleteItemIds, setManualDeleteItemIds] = useState<string[]>([]);

  const baseIngredients = useMemo(() => {
    const groupedLines = recipeLines.reduce(
      (acc, line) => {
        const key = String(line.recipeIngredientId || line.id);
        const current = acc.get(key) || {
          key,
          recipeIngredientId: line.recipeIngredientId || null,
          itemName: line.Item?.name || "-",
          itemId: line.itemId,
        };
        acc.set(key, current);
        return acc;
      },
      new Map<
        string,
        {
          key: string;
          recipeIngredientId: string | null;
          itemName: string;
          itemId: string;
        }
      >()
    );

    return Array.from(groupedLines.values()).map(
      (
        row: {
          key: string;
          recipeIngredientId: string | null;
          itemName: string;
          itemId: string;
        },
        idx
      ) => ({
        sortOrderIndex: idx + 1,
        recipeIngredientId: row.recipeIngredientId,
        itemId: row.itemId,
        itemName: row.itemName,
      })
    );
  }, [recipeLines]);

  const baseQtyByItemId = useMemo(() => {
    return recipeLines.reduce((acc: Map<string, number>, line: any) => {
      if (!line.ItemVariation?.id) {
        acc.set(String(line.itemId), Number(line.quantity || 0));
      }
      return acc;
    }, new Map<string, number>());
  }, [recipeLines]);

  const chatGptPrompt = useMemo(
    () =>
      buildRecipeChatGptPrompt({
        recipe,
        items,
        baseIngredients,
        recipeLines,
        linkedVariations,
      }),
    [baseIngredients, items, linkedVariations, recipe, recipeLines]
  );

  useEffect(() => {
    setPromptDraft(chatGptPrompt);
  }, [chatGptPrompt]);

  useEffect(() => {
    if (
      previewFetcher.state === "idle" &&
      previewFetcher.data?.status === 200
    ) {
      setLastPreviewedResponse(chatGptResponse.trim());
      setIgnoredDeleteItemIds([]);
      setManualDeleteItemIds([]);
      setPreviewVariationFilter(referenceVariationId);
    }
  }, [previewFetcher.state, previewFetcher.data, chatGptResponse]);

  const previewPayload = previewFetcher.data?.payload;
  const previewVariationOptions = Array.from(
    new Map<string, string>(
      ((previewPayload?.importableIngredients || []) as any[]).flatMap(
        (ingredient: any) =>
          Array.isArray(ingredient.variations)
            ? ingredient.variations.map((variation: any) => [
                String(variation.itemVariationId || ""),
                String(variation.variationName || "Variação"),
              ])
            : []
      )
    )
  ).filter(([variationId]) => variationId);
  const hasUpToDatePreview =
    Boolean(chatGptResponse.trim()) &&
    lastPreviewedResponse === chatGptResponse.trim() &&
    previewFetcher.data?.status === 200;
  const hasStalePreview =
    Boolean(chatGptResponse.trim()) &&
    Boolean(lastPreviewedResponse) &&
    lastPreviewedResponse !== chatGptResponse.trim();
  const pastedMissingIngredients =
    extractMissingIngredientsPreview(chatGptResponse);
  const variationCount =
    linkedVariations.length ||
    new Set(
      recipeLines
        .map((line) => line.ItemVariation?.id)
        .filter(Boolean)
        .map(String)
    ).size;
  const filledVariationCells = recipeLines.filter(
    (line) => Number(line.quantity || 0) > 0
  ).length;

  const handlePreviewImport = () => {
    const formData = new FormData();
    formData.set("recipeId", recipe.id);
    formData.set("tab", "composicao");
    formData.set("chatGptResponse", chatGptResponse);
    formData.set("_action", "recipe-chatgpt-preview");
    previewFetcher.submit(formData, { method: "post", action: formAction });
  };
  const toggleIgnoredDeleteItem = (itemId: string) => {
    setIgnoredDeleteItemIds((current) =>
      current.includes(itemId)
        ? current.filter((currentItemId) => currentItemId !== itemId)
        : [...current, itemId]
    );
  };

  const toggleManualDeleteItem = (itemId: string) => {
    setManualDeleteItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  };

  return (
    <GptAssistantPanel
      title="Assistente da composição"
      description="Gere um prompt com a receita atual, envie para o projeto de receitas do ChatGPT e valide o JSON antes de importar."
      prompt={promptDraft}
      defaultPrompt={chatGptPrompt}
      onPromptChange={setPromptDraft}
      response={chatGptResponse}
      onResponseChange={setChatGptResponse}
      onPreview={handlePreviewImport}
      previewButtonLabel="Gerar prévia"
      previewLoadingLabel="Validando..."
      previewDisabled={
        !chatGptResponse.trim() || previewFetcher.state !== "idle"
      }
      previewLoading={previewFetcher.state !== "idle"}
      submitActionName="recipe-chatgpt-import"
      submitButtonLabel="Importar composição"
      submitLoadingLabel="Importando receita..."
      submitDisabled={!hasUpToDatePreview}
      formAction={formAction}
      hiddenFields={[
        { name: "recipeId", value: recipe.id },
        { name: "tab", value: "composicao" },
        {
          name: "ignoredDeleteItemIds",
          value: JSON.stringify(ignoredDeleteItemIds),
        },
        {
          name: "manualDeleteItemIds",
          value: JSON.stringify(manualDeleteItemIds),
        },
      ]}
      backTo={backTo}
      backLabel={backLabel}
      externalUrl={chatGptProjectUrl}
      externalLabel="Abrir projeto"
      flowDescription="1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole a resposta JSON. 4. Gere a prévia. 5. Confirme a importação."
      responsePlaceholder={
        "Cole aqui a resposta do ChatGPT em JSON ou em bloco ```json```."
      }
      copyToastTitle="Prompt copiado"
      copyToastContent="Cole o prompt no projeto Receitas Builder."
      beforeResponseContent={
        <div className="space-y-3">
          {hasStalePreview ? (
            <div className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A resposta foi alterada depois da última prévia. Gere
              uma nova prévia antes de importar.
            </div>
          ) : null}
        </div>
      }
      previewActionsContent={
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="flex gap-x-2">
                <Settings size={14} />
                Contexto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Contexto enviado no prompt</DialogTitle>
                <DialogDescription>
                  Resumo dos dados usados para montar o prompt desta receita.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 text-xs text-slate-600 md:grid-cols-4">
                <div>
                  <div className="font-semibold text-slate-500">Receita</div>
                  <div className="mt-1 truncate font-medium text-slate-900">
                    {recipe.name}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">
                    Ingredientes atuais
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {baseIngredients.length}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Variações</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {variationCount}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">
                    Catálogo no prompt
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {items.length} itens
                  </div>
                </div>
              </div>

              {filledVariationCells > 0 ? (
                <p className="border-t border-slate-200 pt-3 text-xs text-slate-600">
                  A composição atual tem {filledVariationCells} célula(s) com
                  quantidade. A importação atualiza os ingredientes enviados no
                  JSON e mantém os não citados.
                </p>
              ) : null}
            </DialogContent>
          </Dialog>
      }
      responseMetaContent={
        <MissingIngredientsPreview ingredients={pastedMissingIngredients} />
      }
      afterResponseContent={
        <>
          {previewFetcher.data?.status && previewFetcher.data.status >= 400 ? (
            <div className="border-l-2 border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700">
              {previewFetcher.data.message}
            </div>
          ) : null}

          {hasUpToDatePreview && previewPayload ? (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
                <span className="font-medium">
                  {previewPayload.totals.importableIngredients} ingrediente(s)
                  importável(eis)
                </span>
                <span>
                  {previewPayload.totals.variationCells} célula(s) de variação
                </span>
                <span>
                  {previewPayload.totals.missingIngredients} ingrediente(s)
                  faltante(s)
                </span>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Importáveis
                  </p>
                  {previewVariationOptions.length > 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Variação</span>
                      <Select
                        value={previewVariationFilter}
                        onValueChange={setPreviewVariationFilter}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Todas</SelectItem>
                          {previewVariationOptions.map(
                            ([variationId, variationName]) => (
                              <SelectItem key={variationId} value={variationId}>
                                {variationName}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Ingrediente
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Situação
                        </th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Ação
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Variação
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                          UM
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                          Quantidade
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                          Perda
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewPayload.importableIngredients.flatMap(
                        (ingredient: any) => {
                          const isAiDelete = ingredient.previewAction === "delete";
                          const isManual = manualDeleteItemIds.includes(ingredient.itemId);
                          const isIgnored = ignoredDeleteItemIds.includes(ingredient.itemId);
                          const isEffectiveDelete = (isAiDelete && !isIgnored) || isManual;

                          const statusCell = (
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {isAiDelete ? (
                                isIgnored ? (
                                  <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                    Mantido
                                  </span>
                                ) : (
                                  <span className="w-fit rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                    Eliminado
                                  </span>
                                )
                              ) : isManual ? (
                                <span className="w-fit rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                  Eliminado
                                </span>
                              ) : ingredient.previewAction === "add" ? (
                                <span className="w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  Adicionado
                                </span>
                              ) : null}
                            </td>
                          );

                          const actionCell = (
                            <td className="px-2 py-2.5 whitespace-nowrap">
                              {isAiDelete ? (
                                isIgnored ? (
                                  <button
                                    type="button"
                                    title="Desfazer — marcar para eliminar novamente"
                                    onClick={() => toggleIgnoredDeleteItem(ingredient.itemId)}
                                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="Manter ingrediente"
                                    onClick={() => toggleIgnoredDeleteItem(ingredient.itemId)}
                                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )
                              ) : isManual ? (
                                <button
                                  type="button"
                                  title="Manter ingrediente"
                                  onClick={() => toggleManualDeleteItem(ingredient.itemId)}
                                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Marcar para eliminar"
                                  onClick={() => toggleManualDeleteItem(ingredient.itemId)}
                                  className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </td>
                          );

                          const variations = Array.isArray(ingredient.variations)
                            ? ingredient.variations
                            : [];
                          if (variations.length === 0) {
                            if (previewVariationFilter !== "__all") return [];
                            return [
                              <tr
                                key={`${ingredient.itemId}-no-variation`}
                                className="hover:bg-slate-50/50"
                              >
                                <td className="px-4 py-2.5 font-semibold text-slate-900">
                                  {ingredient.itemName}
                                </td>
                                {statusCell}
                                {actionCell}
                                <td className="px-4 py-2.5 text-xs text-slate-400">
                                  Sem variação
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                                  {ingredient.unit}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                                  {isEffectiveDelete
                                    ? (baseQtyByItemId.get(ingredient.itemId) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })
                                    : 0}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                                  {ingredient.defaultLossPct}%
                                </td>
                              </tr>,
                            ];
                          }

                          return variations.map((variation: any) => (
                            String(variation.itemVariationId || "") ===
                              previewVariationFilter ||
                            previewVariationFilter === "__all" ? (
                              <tr
                                key={`${ingredient.itemId}-${variation.itemVariationId}`}
                                className="hover:bg-slate-50/50"
                              >
                                <td className="px-4 py-2.5 font-semibold text-slate-900">
                                  {ingredient.itemName}
                                </td>
                                {statusCell}
                                {actionCell}
                                <td className="px-4 py-2.5 text-xs text-slate-500">
                                  {variation.variationName}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                                  {ingredient.unit}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                                  {Number(
                                    variation.quantity || 0
                                  ).toLocaleString("pt-BR", {
                                    maximumFractionDigits: 3,
                                  })}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                                  {ingredient.defaultLossPct}%
                                </td>
                              </tr>
                            ) : null
                          ));
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {previewPayload.missingIngredients.length > 0 ? (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Não cadastrados
                  </p>
                  <div className="divide-y divide-amber-200">
                    {previewPayload.missingIngredients.map(
                      (ingredient: any, index: number) => (
                        <div
                          key={`${ingredient.name}-${index}`}
                          className="py-2 text-sm text-amber-900"
                        >
                          <div className="font-medium">{ingredient.name}</div>
                          <div className="text-xs text-amber-800">
                            {ingredient.unit || "UM não informada"}
                            {ingredient.notes ? ` · ${ingredient.notes}` : ""}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      }
    />
  );
}
