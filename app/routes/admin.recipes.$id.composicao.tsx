import { Form, Link, useOutletContext } from "@remix-run/react";
import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
import { ALPHABET_FILTERS, normalizeInitialLetter } from "./admin.recipes.$id";

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
        .slice(0, 80)

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
                        <input
                            value={builderSearch}
                            onChange={(event) => setBuilderSearch(event.target.value)}
                            placeholder="Buscar ingrediente..."
                            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                        />
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
                            {builderItems.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-slate-400">
                                    Nenhum ingrediente encontrado para os filtros atuais.
                                </div>
                            ) : (
                                builderItems.map((item) => {
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
                                                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">na receita</span>
                                            ) : null}
                                            {item.classification ? (
                                                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{item.classification}</span>
                                            ) : null}
                                        </label>
                                    )
                                })
                            )}
                        </div>
                    </div>
                    <Form method="post" action=".." preventScrollReset className="mt-4 flex items-center justify-between gap-3">
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <input type="hidden" name="tab" value="composicao" />
                        <input type="hidden" name="targetItemIds" value={builderSelectedItemIds.join(",")} />
                        <span className="text-xs text-slate-400">{builderSelectedItemIds.length} selecionado(s)</span>
                        <Button type="submit" name="_action" value="recipe-ingredient-batch-add" size="sm" disabled={builderSelectedItemIds.length === 0}>
                            Adicionar selecionados
                        </Button>
                    </Form>
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
