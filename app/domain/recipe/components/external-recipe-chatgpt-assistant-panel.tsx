import { useFetcher, useOutletContext } from "@remix-run/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import GptAssistantPanel from "~/components/gpt-assistant-panel";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
import { ExternalLink, Eye, PlusCircle, RotateCcw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { AdminRecipeOutletContext } from "~/routes/admin.recipes.$id";
import {
  buildExternalRecipeChatGptPrompt,
  buildExternalRecipeRequestPrompt,
} from "../recipe-external-chatgpt-assistant";
import MissingIngredientsPreview, {
  extractMissingIngredientsPreview,
} from "./missing-ingredients-preview";

type ExternalRecipeChatGptAssistantPanelProps = {
  context?: AdminRecipeOutletContext;
  formAction?: string;
  backTo?: string;
  backLabel?: string;
  assistantChoiceContent?: ReactNode;
  assistantChoiceLabel?: string;
  promptTabLabel?: string;
};

function formatPreviewQuantity(value: unknown) {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity)) return "0";
  return quantity.toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

export default function ExternalRecipeChatGptAssistantPanel(
  props: ExternalRecipeChatGptAssistantPanelProps
) {
  const outletContext = useOutletContext<
    AdminRecipeOutletContext | undefined
  >();
  const resolvedContext = props.context || outletContext;

  if (!resolvedContext) {
    throw new Error(
      "ExternalRecipeChatGptAssistantPanel requires context via props or outlet context"
    );
  }

  const { recipe, items, linkedVariations, chatGptProjectUrl } =
    resolvedContext;
  const formAction = props.formAction || "..";
  const previewFetcher = useFetcher<any>();
  const [promptDraft, setPromptDraft] = useState("");
  const [chatGptResponse, setChatGptResponse] = useState("");
  const [lastPreviewedResponse, setLastPreviewedResponse] = useState("");
  const [importMode, setImportMode] = useState<
    "replace_current" | "merge_current"
  >("replace_current");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [excludedIngredientIndexes, setExcludedIngredientIndexes] = useState<
    Set<number>
  >(new Set());
  const importFormId = `external-recipe-chatgpt-import-${recipe.id}`;

  const chatGptPrompt = useMemo(
    () =>
      buildExternalRecipeChatGptPrompt({
        recipe,
        items,
        linkedVariations,
      }),
    [items, linkedVariations, recipe]
  );
  const recipeRequestPrompt = useMemo(
    () => buildExternalRecipeRequestPrompt({ recipe }),
    [recipe]
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
      setExcludedIngredientIndexes(new Set());
    }
  }, [previewFetcher.state, previewFetcher.data, chatGptResponse]);

  const previewPayload = previewFetcher.data?.payload;
  const previewImportableIngredients = Array.isArray(
    previewPayload?.importableIngredients
  )
    ? previewPayload.importableIngredients
    : [];
  const includedImportableIngredients = previewImportableIngredients.filter(
    (ingredient: any) =>
      !excludedIngredientIndexes.has(Number(ingredient.sourceIndex))
  );
  const adjustedPreviewTotals = previewPayload
    ? {
        importableIngredients: includedImportableIngredients.length,
        itemsToCreate: includedImportableIngredients.filter(
          (ingredient: any) => ingredient.itemMode === "create"
        ).length,
        missingIngredients: previewPayload.missingIngredients.length,
        variationCells: includedImportableIngredients.reduce(
          (acc: number, ingredient: any) => acc + ingredient.variationCount,
          0
        ),
      }
    : null;
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

  const handlePreviewImport = () => {
    const formData = new FormData();
    formData.set("recipeId", recipe.id);
    formData.set("tab", "composicao");
    formData.set("chatGptResponse", chatGptResponse);
    formData.set("externalRecipeImportMode", importMode);
    formData.set(
      "externalRecipeExcludedIngredientIndexes",
      JSON.stringify(Array.from(excludedIngredientIndexes))
    );
    formData.set("_action", "external-recipe-chatgpt-preview");
    previewFetcher.submit(formData, { method: "post", action: formAction });
  };

  const handleResponseChange = (value: string) => {
    setChatGptResponse(value);
    setExcludedIngredientIndexes(new Set());
  };

  const handleExcludeIngredient = (sourceIndex: number) => {
    setExcludedIngredientIndexes((current) => {
      const next = new Set(current);
      next.add(sourceIndex);
      return next;
    });
  };

  const handleIncludeIngredient = (sourceIndex: number) => {
    setExcludedIngredientIndexes((current) => {
      const next = new Set(current);
      next.delete(sourceIndex);
      return next;
    });
  };

  return (
    <>
      <GptAssistantPanel
        title="Assistente de receita externa"
        description="Transforme uma receita criada no ChatGPT em JSON técnico, criando os itens faltantes e preenchendo a receita aberta."
        prompt={promptDraft}
        defaultPrompt={chatGptPrompt}
        onPromptChange={setPromptDraft}
        response={chatGptResponse}
        onResponseChange={handleResponseChange}
        onPreview={handlePreviewImport}
        previewButtonLabel="Gerar prévia"
        previewLoadingLabel="Validando..."
        previewDisabled={
          !chatGptResponse.trim() || previewFetcher.state !== "idle"
        }
        previewLoading={previewFetcher.state !== "idle"}
        submitActionName="external-recipe-chatgpt-import"
        submitButtonLabel="Preencher composição da receita"
        submitLoadingLabel="Importando..."
        submitDisabled={
          !hasUpToDatePreview || includedImportableIngredients.length === 0
        }
        onSubmitButtonClick={(event) => {
          event.preventDefault();
          setImportDialogOpen(true);
        }}
        formAction={formAction}
        formId={importFormId}
        hiddenFields={[
          { name: "recipeId", value: recipe.id },
          { name: "tab", value: "composicao" },
          { name: "externalRecipeImportMode", value: importMode },
          {
            name: "externalRecipeExcludedIngredientIndexes",
            value: JSON.stringify(Array.from(excludedIngredientIndexes)),
          },
        ]}
        backTo={props.backTo || `/admin/recipes/${recipe.id}/composicao`}
        backLabel={props.backLabel || "Voltar para composição"}
        externalUrl={chatGptProjectUrl}
        externalLabel="Abrir projeto"
        flowDescription="1. Copie o modelo de receita e peça a receita no ChatGPT. 2. Copie a receita com a tabela de ingredientes formatada. 3. Copie o prompt técnico e cole na mesma conversa. 4. Cole aqui o JSON retornado. 5. Gere a prévia e confirme a composição."
        responsePlaceholder="Cole aqui o JSON gerado pelo ChatGPT a partir da receita externa."
        responseHelperText={
          <>
            Ingredientes com <code>itemId</code> usam itens existentes.
            Ingredientes com <code>itemName</code> e sem <code>itemId</code>{" "}
            criam novos itens antes de preencher a composição.
          </>
        }
        copyToastTitle="Prompt copiado"
        copyToastContent="Cole o prompt na conversa em que o ChatGPT criou a receita."
        assistantChoiceContent={props.assistantChoiceContent}
        assistantChoiceLabel={props.assistantChoiceLabel}
        promptTabLabel={props.promptTabLabel}
        promptActionsContent={
          <>
            <CopyButton
              textToCopy={recipeRequestPrompt}
              label="Copiar prompt"
              variant="outline"
              classNameButton="h-9 px-3 text-slate-700 hover:bg-slate-50"
              classNameLabel="text-sm"
              classNameIcon="text-slate-600"
              toastTitle="Prompt copiado"
              toastContent="Use este prompt para pedir a receita antes de gerar o JSON técnico."
            />
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex h-9 gap-x-2 text-slate-600"
                >
                  <Eye size={14} />
                  Visualizar prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Prompt para pedir receita</DialogTitle>
                  <DialogDescription>
                    Use este modelo antes do prompt técnico para receber a
                    receita com ingredientes em tabela.
                  </DialogDescription>
                </DialogHeader>
                <textarea
                  readOnly
                  value={recipeRequestPrompt}
                  className="min-h-[420px] w-full rounded-md border-0 bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-800 outline-none ring-1 ring-slate-200"
                />
              </DialogContent>
            </Dialog>
            {chatGptProjectUrl ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={chatGptProjectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-x-2"
                >
                  Abrir projeto
                  <ExternalLink size={13} />
                </a>
              </Button>
            ) : null}
          </>
        }
        beforeResponseContent={
          <div className="space-y-3">
            {hasStalePreview ? (
              <div className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                A resposta foi alterada depois da última prévia. Gere uma nova
                prévia antes de importar.
              </div>
            ) : null}
          </div>
        }
        responseMetaContent={
          <MissingIngredientsPreview ingredients={pastedMissingIngredients} />
        }
        afterResponseContent={
          <>
            {previewFetcher.data?.status &&
            previewFetcher.data.status >= 400 ? (
              <div className="border-l-2 border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700">
                {previewFetcher.data.message}
              </div>
            ) : null}

            {hasUpToDatePreview && previewPayload && adjustedPreviewTotals ? (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
                  <span className="font-medium">
                    {adjustedPreviewTotals.importableIngredients} ingrediente(s)
                    importável(eis)
                  </span>
                  <span>
                    {adjustedPreviewTotals.itemsToCreate} item(ns) novo(s)
                  </span>
                  <span>
                    {adjustedPreviewTotals.variationCells} célula(s) de variação
                  </span>
                  <span>
                    {adjustedPreviewTotals.missingIngredients} ingrediente(s)
                    pendente(s)
                  </span>
                </div>

                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Importáveis
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                            Ingrediente
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                            Item
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                            UM
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                            Variações
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                            Perda
                          </th>
                          <th className="w-20 px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewImportableIngredients.map(
                          (ingredient: any, index: number) => {
                            const sourceIndex = Number(ingredient.sourceIndex);
                            const isExcluded =
                              excludedIngredientIndexes.has(sourceIndex);

                            return (
                              <tr
                                key={`${
                                  ingredient.sourceIndex ??
                                  ingredient.itemId ??
                                  ingredient.itemName
                                }-${index}`}
                                className={
                                  isExcluded
                                    ? "bg-slate-50 text-slate-400"
                                    : "hover:bg-slate-50/50"
                                }
                              >
                                <td className="px-4 py-2.5 font-semibold text-slate-900">
                                  {ingredient.itemName ||
                                    ingredient.requestedItemName}
                                </td>
                                <td className="px-4 py-2.5">
                                  {isExcluded ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                      eliminado
                                    </span>
                                  ) : ingredient.itemMode === "create" ? (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                      novo item
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                      usar existente
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-500">
                                  {ingredient.unit}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-700">
                                  {Array.isArray(ingredient.variations) &&
                                  ingredient.variations.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {ingredient.variations.map(
                                        (variation: any) => (
                                          <div
                                            key={
                                              variation.itemVariationId ||
                                              variation.variationName
                                            }
                                            className="whitespace-nowrap"
                                          >
                                            {ingredient.variations.length >
                                            1 ? (
                                              <span className="mr-1 text-xs text-slate-400">
                                                {variation.variationName}:
                                              </span>
                                            ) : null}
                                            <span className="font-medium text-slate-900">
                                              {formatPreviewQuantity(
                                                variation.quantity
                                              )}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">0</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                                  {ingredient.defaultLossPct}%
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex justify-end gap-1">
                                    {ingredient.itemMode === "create" ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-amber-700 hover:text-amber-800"
                                        title={`Cadastrar ${
                                          ingredient.itemName ||
                                          ingredient.requestedItemName ||
                                          "ingrediente"
                                        } como novo item`}
                                        aria-label={`Cadastrar ${
                                          ingredient.itemName ||
                                          ingredient.requestedItemName ||
                                          "ingrediente"
                                        } como novo item`}
                                        onClick={() =>
                                          handleIncludeIngredient(sourceIndex)
                                        }
                                      >
                                        <PlusCircle size={13} />
                                      </Button>
                                    ) : isExcluded ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                                        title={`Reincluir ${
                                          ingredient.itemName ||
                                          ingredient.requestedItemName ||
                                          "ingrediente"
                                        }`}
                                        aria-label={`Reincluir ${
                                          ingredient.itemName ||
                                          ingredient.requestedItemName ||
                                          "ingrediente"
                                        } na importação`}
                                        onClick={() =>
                                          handleIncludeIngredient(sourceIndex)
                                        }
                                      >
                                        <RotateCcw size={13} />
                                      </Button>
                                    ) : null}

                                    {!isExcluded ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-700"
                                        title={`Eliminar ${
                                          ingredient.itemName ||
                                          ingredient.requestedItemName ||
                                          "ingrediente"
                                        }`}
                                        aria-label={`Excluir ${
                                          ingredient.itemName ||
                                          ingredient.requestedItemName ||
                                          "ingrediente"
                                        } da importação`}
                                        onClick={() =>
                                          handleExcludeIngredient(sourceIndex)
                                        }
                                      >
                                        <Trash2 size={13} />
                                      </Button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        )}
                        {previewImportableIngredients.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-6 text-center text-sm text-slate-500"
                            >
                              Todas as linhas importáveis foram excluídas desta
                              importação.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                {previewPayload.missingIngredients.length > 0 ? (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Pendentes
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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preencher composição da receita</DialogTitle>
            <DialogDescription>
              Escolha como o JSON validado deve afetar os ingredientes atuais.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
              <input
                type="radio"
                name="externalRecipeImportModeVisual"
                value="replace_current"
                checked={importMode === "replace_current"}
                onChange={() => setImportMode("replace_current")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Substituir composição
                </div>
                <div className="text-xs text-slate-500">
                  Limpa os ingredientes atuais e recria a composição com o JSON.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
              <input
                type="radio"
                name="externalRecipeImportModeVisual"
                value="merge_current"
                checked={importMode === "merge_current"}
                onChange={() => setImportMode("merge_current")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Somar/atualizar
                </div>
                <div className="text-xs text-slate-500">
                  Cria ou atualiza os ingredientes do JSON sem apagar os demais.
                </div>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form={importFormId}
              name="_action"
              value="external-recipe-chatgpt-import"
              disabled={includedImportableIngredients.length === 0}
            >
              Preencher composição da receita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
