import { Form, Link, useOutletContext } from "@remix-run/react";
import { AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
import { IngredientLossEditor, IngredientUnitEditor, InlineVariationCellEditor } from "./admin.recipes.$id";

export default function AdminRecipeVariacoesTab() {
    const { recipe, items, recipeLines, linkedVariations } = useOutletContext<AdminRecipeOutletContext>()
    const [showVariationLoss, setShowVariationLoss] = useState(false)
    const [hiddenVariationIds, setHiddenVariationIds] = useState<string[]>([])

    const itemById = new Map(items.map((item) => [item.id, item]))
    const baseVariationIds = linkedVariations
        .filter((variation) => variation.variationKind === "base" && variation.variationCode === "base")
        .map((variation) => variation.itemVariationId)
    const hasAnyLinkedVariation = linkedVariations.some((variation) => Boolean(variation.variationId))
    const variationColumns = linkedVariations.filter((variation) =>
        variation.variationId &&
        !hiddenVariationIds.includes(variation.itemVariationId)
    )
    const columnToggleVariations = linkedVariations
        .filter((variation) => variation.variationId)
        .sort((a, b) => Number(Boolean(b.isReference)) - Number(Boolean(a.isReference)))
    const orderedVariationColumns = [...variationColumns]
        .sort((a, b) => Number(Boolean(b.isReference)) - Number(Boolean(a.isReference)))
    const effectiveVariationColumns = orderedVariationColumns.length > 0
        ? orderedVariationColumns
        : (hasAnyLinkedVariation ? [] : [{ itemVariationId: "__base__", variationId: null, variationName: "Base/auto" }])

    const groupedLines = recipeLines.reduce((acc, line) => {
        const key = String(line.recipeIngredientId || line.id)
        const current = acc.get(key) || {
            key,
            recipeIngredientId: line.recipeIngredientId || null,
            itemName: line.Item?.name || "-",
            itemId: line.itemId,
            linesByVariation: new Map<string, any>(),
        }
        const mapKey = String(line.ItemVariation?.id || "__base__")
        current.linesByVariation.set(mapKey, line)
        acc.set(key, current)
        return acc
    }, new Map<string, {
        key: string
        recipeIngredientId: string | null
        itemName: string
        itemId: string
        linesByVariation: Map<string, any>
    }>())

    const compositionRows = Array.from(groupedLines.values())
    const compositionRowsWithUnit = compositionRows.map((row) => {
        const firstVisibleLine = effectiveVariationColumns
            .map((variation) => row.linesByVariation.get(String(variation.itemVariationId)))
            .find(Boolean)
        const firstLine = firstVisibleLine || row.linesByVariation.values().next().value
        const itemConsumptionUm = String(itemById.get(row.itemId)?.consumptionUm || "").trim().toUpperCase()
        const currentLineUnit = String(firstLine?.unit || "").trim().toUpperCase()
        const resolvedUnit = itemConsumptionUm || currentLineUnit || "UN"
        const defaultLossPct = Number(firstLine?.defaultLossPct || 0)
        return {
            ...row,
            unit: resolvedUnit,
            itemConsumptionUm,
            defaultLossPct,
        }
    })

    const variationMetrics = effectiveVariationColumns.map((variation) => {
        let filledQtyCells = 0
        for (const row of compositionRowsWithUnit) {
            const line = row.linesByVariation.get(String(variation.itemVariationId))
            if (!line) continue
            if (String(line.unit || "").trim() && Number(line.quantity || 0) > 0) {
                filledQtyCells += 1
            }
        }
        return {
            itemVariationId: variation.itemVariationId,
            filledQtyCells,
        }
    })

    const requiredCellCount = compositionRowsWithUnit.length
    const hasVariationPendingCells = variationMetrics.some((metric) => metric.filledQtyCells < requiredCellCount)

    const toggleVariationColumn = (itemVariationId: string) => {
        if (baseVariationIds.includes(itemVariationId)) return
        setHiddenVariationIds((current) =>
            current.includes(itemVariationId)
                ? current.filter((id) => id !== itemVariationId)
                : [...current, itemVariationId]
        )
    }

    return (
        <div className="space-y-4">
            <section className="">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 py-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${hasVariationPendingCells ? "bg-amber-400" : "bg-emerald-400"}`} />
                            <span className="text-sm text-slate-500">
                                {hasVariationPendingCells
                                    ? "Células sem UM ou quantidade"
                                    : "Todas as variações completas"}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Colunas</span>
                            {columnToggleVariations.length === 0 ? (
                                <span className="text-sm text-slate-400">Nenhuma variação disponível.</span>
                            ) : (
                                columnToggleVariations.map((variation) => {
                                    const visible = !hiddenVariationIds.includes(variation.itemVariationId)
                                    return (
                                        <button
                                            key={`toggle-${variation.itemVariationId}`}
                                            type="button"
                                            onClick={() => toggleVariationColumn(variation.itemVariationId)}
                                            className={cn(
                                                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                                visible
                                                    ? "border-slate-200 bg-slate-100 text-slate-900"
                                                    : "border-transparent bg-white text-slate-400 hover:border-slate-200 hover:text-slate-600"
                                            )}
                                        >
                                            {variation.variationName || "Variação"}
                                            {variation.isReference ? <span className="ml-1 text-slate-400">★</span> : null}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300"
                                checked={showVariationLoss}
                                onChange={(event) => setShowVariationLoss(event.target.checked)}
                            />
                            Perda por variação
                        </label>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ingrediente</th>
                                <th className="w-24 bg-white px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">UM</th>
                                <th className="w-32 bg-white px-3 py-3 text-left">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger className="flex cursor-default items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                Perda
                                                <AlertCircle size={11} className="text-slate-300" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs text-[12px]">
                                                A perda (%) representa o que se perde no preparo (evaporação, redução etc). Exemplo: 20% de perda em 1 kg resulta em 1,250 kg bruto a comprar.
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </th>
                                {effectiveVariationColumns.map((variation, index) => {
                                    const metric = variationMetrics[index]
                                    const missing = metric.filledQtyCells < requiredCellCount
                                    return (
                                        <th key={variation.itemVariationId} className={`min-w-[200px] px-3 py-3 text-left ${variation.isReference ? "bg-slate-50" : "bg-white"}`}>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                                                    {variation.variationName || "Base"}
                                                </span>
                                                {variation.isReference ? <span className="text-[11px] text-slate-400">★</span> : null}
                                                {missing ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Campos pendentes" /> : null}
                                            </div>
                                        </th>
                                    )
                                })}
                                <th className="w-8 bg-white px-3 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {compositionRows.length === 0 ? (
                                <tr>
                                    <td colSpan={effectiveVariationColumns.length + 4} className="px-4 py-12 text-center text-sm text-slate-400">
                                        Nenhum item na composição. Primeiro monte a base na página Composição.
                                    </td>
                                </tr>
                            ) : (
                                compositionRowsWithUnit.map((row) => (
                                    <tr key={row.key} className="align-top">
                                        <td className="sticky left-0 border-t border-slate-100 bg-white px-4 py-4 align-top">
                                            <Link
                                                to={`/admin/items/${row.itemId}/main`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block max-w-[220px] truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                                                title={row.itemName}
                                            >
                                                {row.itemName}
                                            </Link>
                                        </td>
                                        <td className="border-t border-slate-100 px-3 py-4 align-top">
                                            <IngredientUnitEditor
                                                recipeId={recipe.id}
                                                section="variacoes"
                                                recipeIngredientId={row.recipeIngredientId}
                                                currentUnit={row.unit}
                                                options={(() => {
                                                    const options = Array.from(new Set([
                                                        String(row.itemConsumptionUm || "").trim().toUpperCase(),
                                                        String(row.unit || "").trim().toUpperCase(),
                                                    ].filter(Boolean)))
                                                    return options.length > 0 ? options : ["UN"]
                                                })()}
                                            />
                                        </td>
                                        <td className="border-t border-slate-100 px-3 py-4 align-top">
                                            <IngredientLossEditor
                                                recipeId={recipe.id}
                                                section="variacoes"
                                                recipeIngredientId={row.recipeIngredientId}
                                                defaultLossPct={Number(row.defaultLossPct || 0)}
                                            />
                                        </td>
                                        {effectiveVariationColumns.map((variation) => {
                                            const line = row.linesByVariation.get(String(variation.itemVariationId))
                                            if (!line) {
                                                return (
                                                    <td
                                                        key={`${row.key}-${variation.itemVariationId}`}
                                                        className={`border-t border-slate-100 px-3 py-4 align-top text-sm text-slate-300 ${variation.isReference ? "bg-slate-50" : ""}`}
                                                    >
                                                        —
                                                    </td>
                                                )
                                            }
                                            return (
                                                <td key={`${row.key}-${variation.itemVariationId}`} className={`border-t border-slate-100 px-3 py-4 align-top ${variation.isReference ? "bg-slate-50" : ""}`}>
                                                    <InlineVariationCellEditor
                                                        recipeId={recipe.id}
                                                        section="variacoes"
                                                        line={line}
                                                        lineUnit={row.unit}
                                                        showVariationLoss={showVariationLoss}
                                                        globalLossPct={Number(row.defaultLossPct || 0)}
                                                    />
                                                </td>
                                            )
                                        })}
                                        <td className="border-t border-slate-100 px-3 py-4 align-top text-right">
                                            <Form method="post" action=".." preventScrollReset className="inline">
                                                <input type="hidden" name="recipeId" value={recipe.id} />
                                                <input type="hidden" name="tab" value="variacoes" />
                                                <input type="hidden" name="recipeIngredientId" value={row.recipeIngredientId || ""} />
                                                <input type="hidden" name="recipeLineId" value={row.linesByVariation.values().next().value?.id || ""} />
                                                <button
                                                    type="submit"
                                                    name="_action"
                                                    value="recipe-ingredient-delete"
                                                    className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-100 hover:text-red-400"
                                                    title="Remover ingrediente"
                                                    aria-label="Remover ingrediente"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </Form>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
