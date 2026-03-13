import { Form, Link, useFetcher, useOutletContext } from "@remix-run/react";
import { ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
import type { AdminRecipeOutletContext } from "~/routes/admin.recipes.$id";

function buildRecipeChatGptPrompt(params: {
    recipe: AdminRecipeOutletContext["recipe"]
    items: AdminRecipeOutletContext["items"]
    baseIngredients: Array<{
        recipeIngredientId: string | null
        itemId: string
        itemName: string
    }>
    recipeLines: AdminRecipeOutletContext["recipeLines"]
    linkedVariations: AdminRecipeOutletContext["linkedVariations"]
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

function extractJsonPayloadFromText(value: string) {
    const raw = String(value || "").trim()
    if (!raw) return ""

    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim()
    }

    const firstBraceIndex = raw.indexOf("{")
    const lastBraceIndex = raw.lastIndexOf("}")
    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
        return raw.slice(firstBraceIndex, lastBraceIndex + 1).trim()
    }

    return raw
}

function extractMissingIngredientsPreview(value: string): Array<{
    name: string
    unit: string | null
    notes: string | null
}> {
    const jsonPayload = extractJsonPayloadFromText(value)
    if (!jsonPayload) return []

    try {
        const parsed = JSON.parse(jsonPayload)
        const missingIngredients = Array.isArray(parsed?.missingIngredients) ? parsed.missingIngredients : []
        return missingIngredients
            .map((ingredient) => ({
                name: String(ingredient?.name || "").trim(),
                unit: String(ingredient?.unit || "").trim().toUpperCase() || null,
                notes: String(ingredient?.notes || "").trim() || null,
            }))
            .filter((ingredient) => ingredient.name)
    } catch (_error) {
        return []
    }
}

export default function RecipeChatGptAssistantPanel() {
    const { recipe, items, recipeLines, linkedVariations, chatGptProjectUrl } = useOutletContext<AdminRecipeOutletContext>()
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
        previewFetcher.submit(formData, { method: "post", action: ".." })
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-slate-900">
                        <Sparkles size={15} />
                        <h2 className="text-base font-semibold">Assistente ChatGPT</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        Gere um prompt com a receita atual, envie para o projeto de receitas do ChatGPT e valide o JSON antes de importar.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                        <Link to={`/admin/recipes/${recipe.id}/composicao`}>Voltar para composição</Link>
                    </Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                        <a href={chatGptProjectUrl} target="_blank" rel="noreferrer">
                            Abrir projeto
                            <ExternalLink size={13} />
                        </a>
                    </Button>
                    <CopyButton
                        textToCopy={promptDraft}
                        label="Copiar prompt"
                        variant="outline"
                        classNameButton="h-9 px-3 hover:bg-white"
                        classNameLabel="text-sm"
                        classNameIcon="text-slate-700"
                        toastTitle="Prompt copiado"
                        toastContent="Cole o prompt no projeto Receitas Builder."
                    />
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fluxo</p>
                <p className="mt-1">
                    1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole a resposta JSON. 4. Gere a pré-visualização. 5. Confirme a importação.
                </p>
            </div>

            <Form method="post" action=".." preventScrollReset className="space-y-4">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="tab" value="composicao" />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <section className="rounded-lg border border-slate-200">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Prompt</p>
                            <p className="text-xs text-slate-500">Revise, ajuste e copie o prompt antes de abrir o ChatGPT.</p>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-slate-500">O prompt pode ser editado manualmente antes da cópia.</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-slate-600"
                                    onClick={() => setPromptDraft(chatGptPrompt)}
                                >
                                    Restaurar padrão
                                </Button>
                            </div>
                            <textarea
                                value={promptDraft}
                                onChange={(event) => setPromptDraft(event.target.value)}
                                className="min-h-[560px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-3 font-mono text-[12px] leading-5 text-slate-800 outline-none transition-colors focus:border-slate-500"
                            />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="rounded-lg border border-slate-200">
                            <div className="border-b border-slate-200 px-4 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Resposta do ChatGPT</p>
                                        <p className="text-xs text-slate-500">Cole aqui o JSON retornado pelo assistente.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePreviewImport}
                                            disabled={!chatGptResponse.trim() || previewFetcher.state !== "idle"}
                                        >
                                            {previewFetcher.state !== "idle" ? "Validando..." : "Pré-visualizar importação"}
                                        </Button>
                                        <Button
                                            type="submit"
                                            name="_action"
                                            value="recipe-chatgpt-import"
                                            size="sm"
                                            disabled={!hasUpToDatePreview}
                                        >
                                            Importar resposta
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 px-4 py-4">
                                <textarea
                                    name="chatGptResponse"
                                    value={chatGptResponse}
                                    onChange={(event) => setChatGptResponse(event.target.value)}
                                    placeholder={'Cole aqui a resposta do ChatGPT em JSON ou em bloco ```json```.'}
                                    className="min-h-[360px] w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                                />
                                <p className="text-xs text-slate-500">
                                    O import faz upsert dos ingredientes cadastrados e ignora `missingIngredients`, que servem para apontar itens ainda não cadastrados.
                                </p>
                            </div>
                        </div>

                        {pastedMissingIngredients.length > 0 ? (
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
                    </section>
                </div>
            </Form>
        </div>
    )
}
