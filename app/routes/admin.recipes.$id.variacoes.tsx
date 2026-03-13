import { Form, Link, useOutletContext } from "@remix-run/react";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
import { formatMoney, IngredientLossEditor, IngredientUnitEditor, InlineVariationCellEditor } from "./admin.recipes.$id";

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
            lastUnitCostAmount: Number(firstLine?.lastUnitCostAmount || 0),
            avgUnitCostAmount: Number(firstLine?.avgUnitCostAmount || 0),
        }
    })

    const variationMetrics = effectiveVariationColumns.map((variation) => {
        let totalLast = 0
        let totalAvg = 0
        let filledQtyCells = 0
        let zeroCostCells = 0
        for (const row of compositionRowsWithUnit) {
            const line = row.linesByVariation.get(String(variation.itemVariationId))
            if (!line) continue
            totalLast += Number(line.lastTotalCostAmount || 0)
            totalAvg += Number(line.avgTotalCostAmount || 0)
            if (String(line.unit || "").trim() && Number(line.quantity || 0) > 0) {
                filledQtyCells += 1
            }
            if (Number(line.lastTotalCostAmount || 0) <= 0 && Number(line.quantity || 0) > 0) {
                zeroCostCells += 1
            }
        }
        return {
            itemVariationId: variation.itemVariationId,
            filledQtyCells,
            zeroCostCells,
            totalLast,
            totalAvg,
        }
    })

    const requiredCellCount = compositionRowsWithUnit.length
    const hasVariationPendingCells = variationMetrics.some((metric) => metric.filledQtyCells < requiredCellCount)
    const hasVariationCostZero = variationMetrics.some((metric) => metric.zeroCostCells > 0)

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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${(hasVariationPendingCells || hasVariationCostZero) ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <span className="text-sm text-slate-500">
                        {(hasVariationPendingCells || hasVariationCostZero)
                            ? "Células sem UM/QTD ou com custo 0"
                            : "Todas as variações completas"}
                    </span>
                </div>
                <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300"
                            checked={showVariationLoss}
                            onChange={(event) => setShowVariationLoss(event.target.checked)}
                        />
                        Perda por variação
                    </label>
                    <Form method="post" action=".." preventScrollReset>
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <input type="hidden" name="tab" value="variacoes" />
                        <button type="submit" name="_action" value="recipe-lines-recalc" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                            <RefreshCw size={13} />
                            Recalcular
                        </button>
                    </Form>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-slate-100 pb-4">
                <span className="mr-2 text-[11px] uppercase tracking-widest text-slate-400">Colunas</span>
                {columnToggleVariations.length === 0 ? (
                    <span className="text-sm text-slate-400">Nenhuma variação disponível.</span>
                ) : (
                    columnToggleVariations.map((variation, idx) => {
                        const visible = !hiddenVariationIds.includes(variation.itemVariationId)
                        return (
                            <span key={`toggle-${variation.itemVariationId}`} className="flex items-center gap-1">
                                {idx > 0 && <span className="mx-1 text-slate-200">·</span>}
                                <button
                                    type="button"
                                    onClick={() => toggleVariationColumn(variation.itemVariationId)}
                                    className={cn(
                                        "text-sm transition-colors",
                                        visible ? "font-medium text-slate-900" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {variation.variationName || "Variação"}
                                    {variation.isReference && visible ? <span className="ml-1 text-slate-400">★</span> : null}
                                </button>
                            </span>
                        )
                    })
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b-2 border-slate-100">
                            <th className="px-3 pb-3 pt-1 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">Ingrediente</th>
                            <th className="w-24 px-3 pb-3 pt-1 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">UM</th>
                            <th className="w-32 px-3 pb-3 pt-1 text-left">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger className="flex cursor-default items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
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
                                const hasZero = metric.zeroCostCells > 0
                                return (
                                    <th key={variation.itemVariationId} className={`min-w-[200px] px-3 pb-3 pt-1 text-left ${variation.isReference ? "bg-blue-50/30" : ""}`}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-700">
                                                {variation.variationName || "Base"}
                                            </span>
                                            {variation.isReference ? <span className="text-[11px] text-slate-400">★</span> : null}
                                            {missing ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Campos pendentes" /> : null}
                                            {!missing && hasZero ? <span className="h-1.5 w-1.5 rounded-full bg-orange-400" title="Custo 0" /> : null}
                                        </div>
                                        <div className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-slate-400">
                                            {formatMoney(metric.totalLast)} · {formatMoney(metric.totalAvg)}
                                        </div>
                                    </th>
                                )
                            })}
                            <th className="w-8 px-3 pb-3 pt-1" />
                        </tr>
                    </thead>
                    <tbody>
                        {compositionRows.length === 0 ? (
                            <tr>
                                <td colSpan={effectiveVariationColumns.length + 4} className="px-3 py-12 text-center text-sm text-slate-400">
                                    Nenhum item na composição. Primeiro monte a base na página Composição.
                                </td>
                            </tr>
                        ) : (
                            compositionRowsWithUnit.map((row) => (
                                <tr key={row.key} className="group border-t border-slate-100 align-top hover:bg-slate-50/40">
                                    <td className="px-3 py-4 align-top">
                                        <Link
                                            to={`/admin/items/${row.itemId}/main`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block max-w-[220px] cursor-pointer truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                                            title={row.itemName}
                                        >
                                            {row.itemName}
                                        </Link>
                                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                                            <span>{formatMoney(row.lastUnitCostAmount, 4)}</span>
                                            <span className="text-slate-200">·</span>
                                            <span>{formatMoney(row.avgUnitCostAmount, 4)} médio</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 align-top">
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
                                    <td className="px-3 py-4 align-top">
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
                                            return <td key={`${row.key}-${variation.itemVariationId}`} className={`px-3 py-4 align-top text-sm text-slate-300 ${variation.isReference ? "bg-blue-50/30" : ""}`}>—</td>
                                        }
                                        return (
                                            <td key={`${row.key}-${variation.itemVariationId}`} className={`px-3 py-4 align-top ${variation.isReference ? "bg-blue-50/30" : ""}`}>
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
                                    <td className="px-3 py-4 align-top text-right">
                                        <Form method="post" action=".." preventScrollReset className="inline">
                                            <input type="hidden" name="recipeId" value={recipe.id} />
                                            <input type="hidden" name="tab" value="variacoes" />
                                            <input type="hidden" name="recipeIngredientId" value={row.recipeIngredientId || ""} />
                                            <input type="hidden" name="recipeLineId" value={row.linesByVariation.values().next().value?.id || ""} />
                                            <button
                                                type="submit"
                                                name="_action"
                                                value="recipe-ingredient-delete"
                                                className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:text-red-400"
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
        </div>
    )
}
