import { Form, Link, useOutletContext } from "@remix-run/react";
import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { ItemClassification } from "~/domain/item/item.prisma.entity.server";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
import { ALPHABET_FILTERS, normalizeInitialLetter } from "./admin.recipes.$id";

const ITEM_CLASSIFICATION_ORDER: ItemClassification[] = [
    "insumo",
    "semi_acabado",
    "produto_final",
    "embalagem",
    "servico",
    "outro",
]

function formatClassificationLabel(value?: string | null) {
    if (!value) return "sem classificação"
    return value.replaceAll("_", " ")
}

function getClassificationBadgeClass(value?: string | null) {
    switch (value) {
        case "insumo":
            return "border-sky-200 bg-sky-50 text-sky-700"
        case "semi_acabado":
            return "border-amber-200 bg-amber-50 text-amber-700"
        case "produto_final":
            return "border-emerald-200 bg-emerald-50 text-emerald-700"
        case "embalagem":
            return "border-violet-200 bg-violet-50 text-violet-700"
        case "servico":
            return "border-rose-200 bg-rose-50 text-rose-700"
        default:
            return "border-slate-200 bg-slate-50 text-slate-700"
    }
}

export default function AdminRecipeComposicaoTab() {
    const { recipe, items, recipeLines } = useOutletContext<AdminRecipeOutletContext>()
    const [builderSearch, setBuilderSearch] = useState("")
    const [builderLetter, setBuilderLetter] = useState<string>("")
    const [builderSelectedItemIds, setBuilderSelectedItemIds] = useState<string[]>([])

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

    const selectedBaseIngredientIds = new Set(baseIngredients.map((ingredient) => ingredient.itemId))
    const selectedBaseIngredientKey = baseIngredients.map((ingredient) => ingredient.itemId).join("|")

    const builderItems = items
        .filter((item) => {
            const q = builderSearch.trim().toLowerCase()
            const matchesSearch = !q || `${item.name} ${item.classification || ""}`.toLowerCase().includes(q)
            const matchesLetter = !builderLetter || normalizeInitialLetter(item.name) === builderLetter
            return matchesSearch && matchesLetter
        })
        .slice(0, 120)

    const groupedBuilderItems = useMemo(() => {
        const grouped = new Map<string, typeof builderItems>()

        for (const classification of ITEM_CLASSIFICATION_ORDER) {
            grouped.set(classification, [])
        }

        grouped.set("__unclassified__", [])

        for (const item of builderItems) {
            const key = item.classification && grouped.has(item.classification)
                ? item.classification
                : "__unclassified__"
            grouped.get(key)?.push(item)
        }

        return [
            ...ITEM_CLASSIFICATION_ORDER.map((classification) => ({
                key: classification,
                label: formatClassificationLabel(classification),
                items: grouped.get(classification) || [],
            })),
            {
                key: "__unclassified__",
                label: "sem classificação",
                items: grouped.get("__unclassified__") || [],
            },
        ].filter((group) => group.items.length > 0)
    }, [builderItems])

    const availableBuilderLetters = new Set(
        items
            .map((item) => normalizeInitialLetter(item.name))
            .filter(Boolean)
    )

    useEffect(() => {
        setBuilderSelectedItemIds((current) => current.filter((id) => !selectedBaseIngredientIds.has(id)))
    }, [selectedBaseIngredientKey])

    const toggleBuilderItem = (itemId: string) => {
        setBuilderSelectedItemIds((current) =>
            current.includes(itemId)
                ? current.filter((id) => id !== itemId)
                : [...current, itemId]
        )
    }

    return (
        <div className="grid gap-8 xl:grid-cols-2">
            <div className="xl:sticky xl:top-4 xl:self-start">
                <div className="flex min-h-[calc(100vh-14rem)] flex-col">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Montador rápido</h2>
                            <p className="mt-0.5 text-sm text-slate-500">Selecione ingredientes e vincule na receita sem quantidade/custo.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" asChild>
                                <Link to={`/admin/recipes/${recipe.id}/composition-builder`} className="gap-1.5">
                                    <Sparkles size={14} />
                                    Assistente
                                </Link>
                            </Button>
                            <Button type="button" variant="outline" size="sm" asChild>
                                <Link to="/admin/items/new">Criar item</Link>
                            </Button>
                        </div>
                    </div>
                    <div className="mt-4 space-y-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <input
                                value={builderSearch}
                                onChange={(event) => setBuilderSearch(event.target.value)}
                                placeholder="Buscar item..."
                                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm lg:flex-1"
                            />
                            <Form method="post" action=".." preventScrollReset className="flex items-center gap-3">
                                <input type="hidden" name="recipeId" value={recipe.id} />
                                <input type="hidden" name="tab" value="composicao" />
                                <input type="hidden" name="targetItemIds" value={builderSelectedItemIds.join(",")} />
                                <span className="text-xs text-slate-400">{builderSelectedItemIds.length} selecionado(s)</span>
                                <Button type="submit" name="_action" value="recipe-ingredient-batch-add" size="sm" disabled={builderSelectedItemIds.length === 0}>
                                    Adicionar selecionados
                                </Button>
                            </Form>
                        </div>
                        <div className="overflow-x-auto border-b border-slate-200 pb-3">
                            <div className="flex min-w-max items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setBuilderLetter("")}
                                    className={cn(
                                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                                        builderLetter === ""
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-900 hover:bg-slate-100"
                                    )}
                                >
                                    Todos
                                </button>
                                {ALPHABET_FILTERS.map((letter) => (
                                    availableBuilderLetters.has(letter) ? (
                                        <button
                                            key={letter}
                                            type="button"
                                            onClick={() => setBuilderLetter((current) => current === letter ? "" : letter)}
                                            className={cn(
                                                "rounded px-1.5 py-1 text-xs font-semibold uppercase transition-colors",
                                                builderLetter === letter
                                                    ? "bg-slate-900 text-white"
                                                    : "text-slate-900 hover:bg-slate-100"
                                            )}
                                        >
                                            {letter}
                                        </button>
                                    ) : (
                                        <span key={letter} className="px-1.5 py-1 text-xs font-semibold uppercase text-slate-300">
                                            {letter}
                                        </span>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 min-h-0 flex-1 overflow-hidden border border-slate-200">
                        <div className="h-[min(58vh,44rem)] overflow-y-auto bg-white">
                            {groupedBuilderItems.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-slate-400">
                                    Nenhum item encontrado para os filtros atuais.
                                </div>
                            ) : (
                                groupedBuilderItems.map((group) => (
                                    <div key={group.key} className="border-b border-slate-200 last:border-b-0">
                                        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
                                            <Badge variant="outline" className={cn("font-medium", getClassificationBadgeClass(group.key === "__unclassified__" ? null : group.key))}>
                                                {group.label}
                                            </Badge>
                                            <span className="text-xs text-slate-500">{group.items.length} item(ns)</span>
                                        </div>
                                        {group.items.map((item) => {
                                            const checked = builderSelectedItemIds.includes(item.id)
                                            const alreadyAdded = selectedBaseIngredientIds.has(item.id)
                                            return (
                                                <label
                                                    key={item.id}
                                                    className={cn(
                                                        "flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0",
                                                        alreadyAdded ? "bg-slate-50 text-slate-400" : "text-slate-700"
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked || alreadyAdded}
                                                        onChange={() => !alreadyAdded && toggleBuilderItem(item.id)}
                                                        disabled={alreadyAdded}
                                                        className="h-3.5 w-3.5 rounded border-slate-300"
                                                    />
                                                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                                    {alreadyAdded ? (
                                                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                                            na receita
                                                        </Badge>
                                                    ) : null}
                                                    <Badge variant="outline" className={cn("font-medium", getClassificationBadgeClass(item.classification))}>
                                                        {formatClassificationLabel(item.classification)}
                                                    </Badge>
                                                </label>
                                            )
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="pb-4">
                    <h2 className="text-base font-semibold text-slate-900">Composição base</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Organize os ingredientes principais da receita antes de detalhar as variações.</p>
                </div>
                <div className="overflow-x-auto border-t border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ordem</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ingrediente</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {baseIngredients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                                        Nenhum ingrediente base. Adicione no montador ao lado.
                                    </td>
                                </tr>
                            ) : (
                                baseIngredients.map((ingredient) => (
                                    <tr key={ingredient.recipeIngredientId || ingredient.itemId} className="border-t border-slate-100">
                                        <td className="px-4 py-3 text-slate-500">{ingredient.sortOrderIndex}</td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            <Link
                                                to={`/admin/items/${ingredient.itemId}/main`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="cursor-pointer underline-offset-2 hover:underline"
                                                title={ingredient.itemName}
                                            >
                                                {ingredient.itemName}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">Nota / obrigatório / substituível (em breve)</td>
                                        <td className="px-4 py-3 text-right">
                                            <Form method="post" action=".." preventScrollReset className="inline">
                                                <input type="hidden" name="recipeId" value={recipe.id} />
                                                <input type="hidden" name="tab" value="composicao" />
                                                <input type="hidden" name="recipeIngredientId" value={ingredient.recipeIngredientId || ""} />
                                                <button
                                                    type="submit"
                                                    name="_action"
                                                    value="recipe-ingredient-delete"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
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
        </div>
    )
}
