import { useFetcher, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import GptAssistantPanel from "~/components/gpt-assistant-panel";
import type { AdminRecipeOutletContext } from "~/routes/admin.recipes.$id";
import MissingIngredientsPreview, { extractMissingIngredientsPreview } from "./missing-ingredients-preview";

export type RecipeChatGptAssistantContext = {
    recipe: AdminRecipeOutletContext["recipe"]
    items: AdminRecipeOutletContext["items"]
    recipeLines: AdminRecipeOutletContext["recipeLines"]
    linkedVariations: AdminRecipeOutletContext["linkedVariations"]
    chatGptProjectUrl: string
}

type RecipeChatGptAssistantPanelProps = {
    context?: RecipeChatGptAssistantContext
    formAction?: string
    backTo?: string
    backLabel?: string
}

function buildRecipeChatGptPrompt(params: {
    recipe: RecipeChatGptAssistantContext["recipe"]
    items: RecipeChatGptAssistantContext["items"]
    baseIngredients: Array<{
        recipeIngredientId: string | null
        itemId: string
        itemName: string
    }>
    recipeLines: RecipeChatGptAssistantContext["recipeLines"]
    linkedVariations: RecipeChatGptAssistantContext["linkedVariations"]
}) {
    const { recipe, items, baseIngredients, recipeLines, linkedVariations } = params

    const allowedVariations = linkedVariations.length > 0
        ? linkedVariations
            .filter((variation) => variation.itemVariationId)
            .map((variation) => ({
                itemVariationId: variation.itemVariationId,
                variationId: variation.variationId,
                variationName: variation.variationName || "Base",
                isReference: Boolean(variation.isReference),
            }))
        : Array.from(new Map(
            recipeLines
                .filter((line) => line.ItemVariation?.id)
                .map((line) => [
                    String(line.ItemVariation.id),
                    {
                        itemVariationId: String(line.ItemVariation.id),
                        variationId: line.ItemVariation?.variationId || null,
                        variationName: line.ItemVariation?.Variation?.name || "Base",
                        isReference: false,
                    },
                ])
        ).values())

    const currentComposition = baseIngredients.map((ingredient) => {
        const lines = recipeLines.filter((line) => String(line.itemId) === ingredient.itemId)
        const firstLine = lines[0]
        const variationQuantities = lines.reduce((acc, line) => {
            const itemVariationId = String(line.ItemVariation?.id || "")
            if (itemVariationId) {
                acc[itemVariationId] = Number(line.quantity || 0)
            }
            return acc
        }, {} as Record<string, number>)

        return {
            recipeIngredientId: ingredient.recipeIngredientId,
            itemId: ingredient.itemId,
            itemName: ingredient.itemName,
            unit: String(firstLine?.unit || "UN").trim().toUpperCase() || "UN",
            defaultLossPct: Number(firstLine?.defaultLossPct || 0),
            variationQuantities,
        }
    })

    const allowedItems = items.map((item) => ({
        itemId: item.id,
        name: item.name,
        consumptionUm: String(item.consumptionUm || "UN").trim().toUpperCase() || "UN",
        classification: item.classification || null,
    }))

    const responseTemplate = {
        recipeId: recipe.id,
        ingredients: [
            {
                itemId: "item_id_obrigatorio",
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
    }

    return [
        "Voce esta preenchendo a composicao tecnica de uma receita no sistema Amodomio.",
        "Responda somente com um bloco ```json``` valido, sem texto antes ou depois.",
        "Nao invente itemId nem itemVariationId. Use apenas os IDs permitidos abaixo.",
        "Se um ingrediente for usado, retorne unit, defaultLossPct e quantity para todas as variacoes listadas.",
        "Quando um ingrediente nao entrar em uma variacao, use 0.",
        "Se faltar algum ingrediente no catalogo do sistema, nao force um itemId incorreto.",
        "Ingredientes nao cadastrados devem ir em missingIngredients com name, unit e notes.",
        "Nao inclua comentarios, markdown extra, explicacoes nem chaves adicionais.",
        "",
        "RECEITA_ATUAL",
        JSON.stringify({
            recipeId: recipe.id,
            recipeName: recipe.name,
            recipeType: recipe.type,
            recipeDescription: recipe.description || "",
        }, null, 2),
        "",
        "VARIACOES_PERMITIDAS",
        JSON.stringify(allowedVariations, null, 2),
        "",
        "CATALOGO_DE_INGREDIENTES_PERMITIDOS",
        JSON.stringify(allowedItems, null, 2),
        "",
        "REGRA_PARA_INGREDIENTES_NAO_CADASTRADOS",
        JSON.stringify({
            instruction: "Quando o ingrediente necessario nao existir no catalogo permitido, liste-o em missingIngredients e nao o inclua em ingredients.",
        }, null, 2),
        "",
        "COMPOSICAO_ATUAL",
        JSON.stringify(currentComposition, null, 2),
        "",
        "FORMATO_OBRIGATORIO_DA_RESPOSTA",
        JSON.stringify(responseTemplate, null, 2),
    ].join("\n")
}



export default function RecipeChatGptAssistantPanel(props: RecipeChatGptAssistantPanelProps) {
    const outletContext = useOutletContext<AdminRecipeOutletContext | undefined>()
    const resolvedContext = props.context || outletContext

    if (!resolvedContext) {
        throw new Error("RecipeChatGptAssistantPanel requires context via props or outlet context")
    }

    const {
        recipe,
        items,
        recipeLines,
        linkedVariations,
        chatGptProjectUrl,
    } = resolvedContext
    const formAction = props.formAction || ".."
    const backTo = props.backTo || `/admin/recipes/${recipe.id}/composicao`
    const backLabel = props.backLabel || "Voltar para composição"
    const previewFetcher = useFetcher<any>()
    const [promptDraft, setPromptDraft] = useState("")
    const [chatGptResponse, setChatGptResponse] = useState("")
    const [lastPreviewedResponse, setLastPreviewedResponse] = useState("")

    const groupedLines = recipeLines.reduce((acc, line) => {
        const key = String(line.recipeIngredientId || line.id)
        const current = acc.get(key) || {
            key,
            recipeIngredientId: line.recipeIngredientId || null,
            itemName: line.Item?.name || "-",
            itemId: line.itemId,
        }
        acc.set(key, current)
        return acc
    }, new Map<string, {
        key: string
        recipeIngredientId: string | null
        itemName: string
        itemId: string
    }>())

    const baseIngredients = Array.from(groupedLines.values()).map((row: {
        key: string
        recipeIngredientId: string | null
        itemName: string
        itemId: string
    }, idx) => ({
        sortOrderIndex: idx + 1,
        recipeIngredientId: row.recipeIngredientId,
        itemId: row.itemId,
        itemName: row.itemName,
    }))

    const chatGptPrompt = buildRecipeChatGptPrompt({
        recipe,
        items,
        baseIngredients,
        recipeLines,
        linkedVariations,
    })

    useEffect(() => {
        setPromptDraft(chatGptPrompt)
    }, [chatGptPrompt])

    useEffect(() => {
        if (previewFetcher.state === "idle" && previewFetcher.data?.status === 200) {
            setLastPreviewedResponse(chatGptResponse.trim())
        }
    }, [previewFetcher.state, previewFetcher.data, chatGptResponse])

    const previewPayload = previewFetcher.data?.payload
    const hasUpToDatePreview = Boolean(chatGptResponse.trim()) && lastPreviewedResponse === chatGptResponse.trim() && previewFetcher.data?.status === 200
    const pastedMissingIngredients = extractMissingIngredientsPreview(chatGptResponse)

    const handlePreviewImport = () => {
        const formData = new FormData()
        formData.set("recipeId", recipe.id)
        formData.set("tab", "composicao")
        formData.set("chatGptResponse", chatGptResponse)
        formData.set("_action", "recipe-chatgpt-preview")
        previewFetcher.submit(formData, { method: "post", action: formAction })
    }

    return (
        <GptAssistantPanel
            title="Assistente ChatGPT"
            description="Gere um prompt com a receita atual, envie para o projeto de receitas do ChatGPT e valide o JSON antes de importar."
            prompt={promptDraft}
            defaultPrompt={chatGptPrompt}
            onPromptChange={setPromptDraft}
            response={chatGptResponse}
            onResponseChange={setChatGptResponse}
            onPreview={handlePreviewImport}
            previewButtonLabel="Pré-visualizar importação"
            previewLoadingLabel="Validando..."
            previewDisabled={!chatGptResponse.trim() || previewFetcher.state !== "idle"}
            previewLoading={previewFetcher.state !== "idle"}
            submitActionName="recipe-chatgpt-import"
            submitButtonLabel="Importar resposta"
            submitDisabled={!hasUpToDatePreview}
            formAction={formAction}
            hiddenFields={[
                { name: "recipeId", value: recipe.id },
                { name: "tab", value: "composicao" },
            ]}
            backTo={backTo}
            backLabel={backLabel}
            externalUrl={chatGptProjectUrl}
            externalLabel="Abrir projeto"
            flowDescription="1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole a resposta JSON. 4. Gere a pré-visualização. 5. Confirme a importação."
            responsePlaceholder={"Cole aqui a resposta do ChatGPT em JSON ou em bloco ```json```."}
            responseHelperText={(
                <>
                    O import faz upsert dos ingredientes cadastrados e ignora <code>missingIngredients</code>, que servem para apontar itens ainda não cadastrados.
                </>
            )}
            copyToastTitle="Prompt copiado"
            copyToastContent="Cole o prompt no projeto Receitas Builder."
            responseMetaContent={<MissingIngredientsPreview ingredients={pastedMissingIngredients} />}
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

                            {previewPayload.missingIngredients.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Não cadastrados</p>
                                    <div className="space-y-2">
                                        {previewPayload.missingIngredients.map((ingredient: any, index: number) => (
                                            <div key={`${ingredient.name}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                <div className="font-medium">{ingredient.name}</div>
                                                <div className="text-xs text-amber-800">
                                                    {ingredient.unit || "UM não informada"}{ingredient.notes ? ` · ${ingredient.notes}` : ""}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </>
            }
        />
    )
}
