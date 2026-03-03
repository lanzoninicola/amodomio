import { useEffect, useRef, useState, useCallback } from "react"
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useFetcher, Link } from "@remix-run/react"
import {
    ChevronDown, ChevronRight, Plus, Trash2, Search, Check, X, ExternalLink,
} from "lucide-react"
import { cn } from "~/lib/utils"
import { ok, badRequest } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import prismaClient from "~/lib/prisma/client.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
    Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "~/components/ui/command"
import {
    Popover, PopoverContent, PopoverTrigger,
} from "~/components/ui/popover"
import RecipeBadge from "~/domain/recipe/components/recipe-badge/recipe-badge"
import { DecimalInput } from "~/components/inputs/inputs"

// ─── Types ───────────────────────────────────────────────────────────────────

type WorksheetRecipeLine = {
    id: string
    unit: string
    quantity: number
    lastUnitCostAmount: number
    avgUnitCostAmount: number
    lastTotalCostAmount: number
    avgTotalCostAmount: number
    sortOrderIndex: number
    notes: string | null
    Item: { id: string; name: string }
    ItemVariation: {
        id: string
        Variation: { id: string; name: string; kind: string | null; code: string | null }
    } | null
}

type WorksheetRecipe = {
    id: string
    name: string
    type: string
    itemId: string | null
    variationId: string | null
    Item: { id: string; name: string } | null
    Variation: { id: string; name: string; kind: string | null } | null
    RecipeLine: WorksheetRecipeLine[]
}

type WorksheetItem = { id: string; name: string; classification: string; consumptionUm: string | null }
type WorksheetVariation = { id: string; name: string; kind: string | null }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UNIT_FALLBACK = ["G", "KG", "L", "ML", "UN"]

async function getUnitOptions(db: any): Promise<string[]> {
    try {
        const rows = await db.measurementUnit?.findMany({
            where: { active: true },
            select: { code: true },
            orderBy: [{ code: "asc" }],
        })
        const merged = new Set<string>(UNIT_FALLBACK)
        for (const row of rows || []) {
            const code = String(row?.code || "").trim().toUpperCase()
            if (code) merged.add(code)
        }
        return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"))
    } catch {
        return [...UNIT_FALLBACK].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }
}

// Label exibida nos comboboxes de item: "Nome (Classificação) · UM"
function itemLabel(item: WorksheetItem): string {
    const parts = [item.name]
    if (item.classification) parts[0] += ` (${item.classification})`
    if (item.consumptionUm) parts.push(item.consumptionUm)
    return parts.join(" · ")
}

function filterItems(items: WorksheetItem[], search: string): WorksheetItem[] {
    const q = search.toLowerCase()
    return items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.classification.toLowerCase().includes(q) ||
        (i.consumptionUm ?? "").toLowerCase().includes(q)
    )
}

// Derives a computed name from item + variation
function calcNome(recipe: Pick<WorksheetRecipe, "Item" | "Variation">): string | null {
    if (!recipe.Item) return null
    return recipe.Variation
        ? `${recipe.Item.name} • ${recipe.Variation.name}`
        : recipe.Item.name
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
    const db = prismaClient as any

    const [err, result] = await tryit(Promise.all([
        db.recipe.findMany({
            include: {
                Item: { select: { id: true, name: true } },
                Variation: { select: { id: true, name: true, kind: true } },
                RecipeLine: {
                    include: {
                        Item: { select: { id: true, name: true } },
                        ItemVariation: {
                            select: {
                                id: true,
                                Variation: { select: { id: true, name: true, kind: true, code: true } },
                            },
                        },
                    },
                    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
                },
            },
            orderBy: [{ name: "asc" }],
        }),
        db.item.findMany({
            where: { active: true },
            select: { id: true, name: true, classification: true, consumptionUm: true },
            orderBy: [{ name: "asc" }],
            take: 500,
        }),
        getUnitOptions(db),
        db.variation.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, kind: true },
            orderBy: [{ kind: "asc" }, { name: "asc" }],
            take: 200,
        }),
    ]))

    if (err) return badRequest(err.message)
    const [recipes, items, unitOptions, variations] = result
    return ok({ recipes, items, unitOptions, variations })
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData()
    const { _action, ...values } = Object.fromEntries(formData)
    const db = prismaClient as any

    // ── Update recipe (name / item / variation) ────────────────────────────
    if (_action === "recipe-update") {
        const recipeId = String(values.recipeId || "").trim()
        if (!recipeId) return badRequest("ID da receita inválido")

        const data: Record<string, any> = {}
        if (values.recipeName !== undefined) {
            const name = String(values.recipeName).trim()
            if (!name) return badRequest("Nome não pode estar vazio")
            data.name = name
        }
        if (values.recipeItemId !== undefined)
            data.itemId = String(values.recipeItemId).trim() || null
        if (values.recipeVariationId !== undefined)
            data.variationId = String(values.recipeVariationId).trim() || null

        const [err] = await tryit(db.recipe.update({ where: { id: recipeId }, data }))
        if (err) return badRequest("Erro ao atualizar receita")
        return ok({ message: "Receita atualizada" })
    }

    // ── Create recipe ──────────────────────────────────────────────────────
    if (_action === "recipe-create") {
        const name = String(values.recipeName || "").trim()
        if (!name) return badRequest("Informe o nome da receita")

        const itemId = String(values.recipeItemId || "").trim() || null
        const variationId = String(values.recipeVariationId || "").trim() || null

        const [err] = await tryit(db.recipe.create({
            data: {
                name,
                type: "semiFinished",
                hasVariations: false,
                isVegetarian: false,
                isGlutenFree: false,
                ...(itemId ? { itemId } : {}),
                ...(variationId ? { variationId } : {}),
            },
        }))
        if (err) return badRequest("Erro ao criar receita")
        return ok({ message: "Receita criada" })
    }

    // ── Update recipe line ─────────────────────────────────────────────────
    if (_action === "recipe-line-update") {
        const lineId = String(values.lineId || "").trim()
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        const quantity = Number(String(values.lineQuantity || "0").replace(",", "."))

        if (!lineId) return badRequest("ID da linha inválido")
        if (!unit) return badRequest("Informe a unidade")
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Quantidade inválida")

        const line = await db.recipeLine.findUnique({
            where: { id: lineId },
            include: { ItemVariation: { include: { ItemCostVariation: true } } },
        })
        if (!line) return badRequest("Linha não encontrada")

        const lastUnitCost = Number(
            line.ItemVariation?.ItemCostVariation?.costAmount ?? line.lastUnitCostAmount ?? 0
        )
        const avgUnitCost = Number(line.avgUnitCostAmount || lastUnitCost)

        const [err] = await tryit(db.recipeLine.update({
            where: { id: lineId },
            data: {
                unit,
                quantity,
                lastTotalCostAmount: Number((lastUnitCost * quantity).toFixed(6)),
                avgTotalCostAmount: Number((avgUnitCost * quantity).toFixed(6)),
            },
        }))
        if (err) return badRequest("Erro ao atualizar linha")
        return ok({ message: "Linha atualizada" })
    }

    // ── Delete recipe line ─────────────────────────────────────────────────
    if (_action === "recipe-line-delete") {
        const lineId = String(values.lineId || "").trim()
        if (!lineId) return badRequest("ID inválido")
        const [err] = await tryit(db.recipeLine.delete({ where: { id: lineId } }))
        if (err) return badRequest("Erro ao remover linha")
        return ok({ message: "Linha removida" })
    }

    // ── Add recipe line ────────────────────────────────────────────────────
    if (_action === "recipe-line-add") {
        const recipeId = String(values.recipeId || "").trim()
        const itemId = String(values.lineItemId || "").trim()
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        const quantity = Number(String(values.lineQuantity || "0").replace(",", "."))

        if (!recipeId) return badRequest("Receita inválida")
        if (!itemId) return badRequest("Selecione o ingrediente")
        if (!unit) return badRequest("Informe a unidade")
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Informe uma quantidade válida")

        const itemVariation = await db.itemVariation.findFirst({
            where: { itemId, deletedAt: null },
            include: { ItemCostVariation: true },
            orderBy: [{ createdAt: "asc" }],
        })

        const itemVariationId = itemVariation?.id ?? null
        const lastUnitCostAmount = Number(itemVariation?.ItemCostVariation?.costAmount ?? 0)
        const lineCount = await db.recipeLine.count({ where: { recipeId } })

        const [err] = await tryit(db.recipeLine.create({
            data: {
                recipeId, itemId, itemVariationId, unit, quantity,
                lastUnitCostAmount, avgUnitCostAmount: lastUnitCostAmount,
                lastTotalCostAmount: Number((lastUnitCostAmount * quantity).toFixed(6)),
                avgTotalCostAmount: Number((lastUnitCostAmount * quantity).toFixed(6)),
                sortOrderIndex: lineCount, notes: null,
            },
        }))
        if (err) return badRequest("Erro ao adicionar ingrediente: " + err.message)
        return ok({ message: "Ingrediente adicionado" })
    }

    // ── Update recipe line item ────────────────────────────────────────────
    if (_action === "recipe-line-item-update") {
        const lineId = String(values.lineId || "").trim()
        const itemId = String(values.lineItemId || "").trim()
        if (!lineId || !itemId) return badRequest("IDs inválidos")

        const line = await db.recipeLine.findUnique({ where: { id: lineId } })
        if (!line) return badRequest("Linha não encontrada")

        const itemVariation = await db.itemVariation.findFirst({
            where: { itemId, deletedAt: null },
            include: { ItemCostVariation: true },
            orderBy: [{ createdAt: "asc" }],
        })
        const itemVariationId = itemVariation?.id ?? null
        const lastUnitCostAmount = Number(itemVariation?.ItemCostVariation?.costAmount ?? 0)
        const qty = Number(line.quantity ?? 0)

        const [err] = await tryit(db.recipeLine.update({
            where: { id: lineId },
            data: {
                itemId,
                itemVariationId,
                lastUnitCostAmount,
                avgUnitCostAmount: lastUnitCostAmount,
                lastTotalCostAmount: Number((lastUnitCostAmount * qty).toFixed(6)),
                avgTotalCostAmount: Number((lastUnitCostAmount * qty).toFixed(6)),
            },
        }))
        if (err) return badRequest("Erro ao atualizar ingrediente")
        return ok({ message: "Ingrediente atualizado" })
    }

    return null
}

// ─── Shared cell classes ──────────────────────────────────────────────────────

const CELL = "border border-slate-200 h-8"
const CELL_HDR = cn(CELL, "bg-slate-50")
const CELL_RECIPE = cn(CELL, "bg-slate-50/70")
const CELL_EDITABLE = cn(CELL, "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset focus-within:z-10 relative")
const CELL_RECIPE_EDITABLE = cn(CELL_RECIPE, "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset focus-within:z-10 relative")
const INPUT_BASE = "w-full h-full px-2 bg-transparent border-0 outline-none text-sm text-slate-700 placeholder:text-slate-300"

// ─── Column layout ────────────────────────────────────────────────────────────
//
//  Col │ Width  │ Recipe header row    │ Ingredient row
//  ────┼────────┼──────────────────────┼──────────────────
//   1  │  36px  │ expand/collapse      │ row #
//   2  │  flex  │ Nome Receita         │ Ingrediente
//   3  │ 160px  │ Item Vinculado       │ Variação Ing.
//   4  │  96px  │ Variante             │ UM
//   5  │ 106px  │ Nome Calculado       │ Quantidade
//   6  │ 112px  │ ──                   │ Custo Un.
//   7  │ 112px  │ Total                │ Total
//   8  │  36px  │ link / count         │ delete

// ─── Column widths (default px) — col 1 (name) is the widest / most flexible ──
const DEFAULT_COL_WIDTHS = [36, 240, 160, 96, 106, 112, 112, 36]
// Minimum widths per column (don't shrink below these)
const MIN_COL_WIDTHS    = [36,  80,  80, 60,  60,  80,  80, 36]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RecipeWorksheet() {
    const loaderData = useLoaderData<typeof loader>()
    const recipes = (loaderData?.payload?.recipes ?? []) as WorksheetRecipe[]
    const items = (loaderData?.payload?.items ?? []) as WorksheetItem[]
    const unitOptions = (loaderData?.payload?.unitOptions ?? UNIT_FALLBACK) as string[]
    const variations = (loaderData?.payload?.variations ?? []) as WorksheetVariation[]

    const [search, setSearch] = useState("")
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [isCreating, setIsCreating] = useState(false)

    // ── Column resizing ──────────────────────────────────────────────────────
    const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS)
    const resizeRef = useRef<{ col: number; startX: number; startW: number } | null>(null)
    const [isResizing, setIsResizing] = useState(false)

    const startResize = useCallback((col: number, clientX: number) => {
        resizeRef.current = { col, startX: clientX, startW: colWidths[col] }
        setIsResizing(true)
    }, [colWidths])

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!resizeRef.current) return
            const { col, startX, startW } = resizeRef.current
            const delta = e.clientX - startX
            setColWidths(prev => {
                const next = [...prev]
                next[col] = Math.max(MIN_COL_WIDTHS[col], startW + delta)
                return next
            })
        }
        const onUp = () => { resizeRef.current = null; setIsResizing(false) }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
        return () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
    }, [])

    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase())
    )
    const totalLines = filteredRecipes.reduce((acc, r) => acc + r.RecipeLine.length, 0)

    const toggleCollapse = (id: string) => {
        setCollapsed(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    let globalRowIndex = 0

    return (
        <div className="flex flex-col gap-2">
            {/* ── Toolbar ── */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    <span className="font-bold text-slate-700">{filteredRecipes.length}</span> receitas
                    {" · "}
                    <span className="font-bold text-slate-700">{totalLines}</span> ingredientes
                </span>
                <div className="flex-1" />
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Buscar receita..." className="pl-8 h-7 text-xs min-w-[200px]"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setCollapsed(new Set())}>Expandir tudo</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setCollapsed(new Set(filteredRecipes.map(r => r.id)))}>Recolher tudo</Button>
            </div>

            {/* ── Grid ── */}
            <div className={cn("rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm", isResizing && "select-none")}>
                <div className="overflow-x-auto">
                    <table
                        className="border-collapse"
                        style={{ tableLayout: "fixed", width: `${colWidths.reduce((a, b) => a + b, 0)}px`, minWidth: "100%" }}
                    >
                        <colgroup>
                            {colWidths.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
                        </colgroup>

                        {/* ── Header ── */}
                        <thead>
                            <tr>
                                <th className={CELL_HDR} />
                                <ColHeader colIndex={1} onStartResize={startResize}>Nome / Ingrediente</ColHeader>
                                <ColHeader colIndex={2} onStartResize={startResize}>Item Vinc. / Variação</ColHeader>
                                <ColHeader colIndex={3} onStartResize={startResize}>Variante / UM</ColHeader>
                                <ColHeader colIndex={4} onStartResize={startResize} align="right">Nome Calc. / Qtd</ColHeader>
                                <ColHeader colIndex={5} onStartResize={startResize} align="right">Custo Un.</ColHeader>
                                <ColHeader colIndex={6} onStartResize={startResize} align="right">Total</ColHeader>
                                <th className={CELL_HDR} />
                            </tr>
                        </thead>

                        <tbody>
                            {filteredRecipes.length === 0 && !isCreating && (
                                <tr>
                                    <td colSpan={8} className="border border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                                        Nenhuma receita encontrada.
                                    </td>
                                </tr>
                            )}

                            {filteredRecipes.map(recipe => {
                                const startIndex = globalRowIndex
                                globalRowIndex += recipe.RecipeLine.length
                                return (
                                    <RecipeGroup
                                        key={recipe.id}
                                        recipe={recipe}
                                        collapsed={collapsed.has(recipe.id)}
                                        onToggle={() => toggleCollapse(recipe.id)}
                                        items={items}
                                        unitOptions={unitOptions}
                                        variations={variations}
                                        rowStartIndex={startIndex}
                                    />
                                )
                            })}

                            {/* ── Create new recipe ── */}
                            {isCreating ? (
                                <CreatingRecipeRow
                                    items={items}
                                    variations={variations}
                                    onDone={() => setIsCreating(false)}
                                />
                            ) : (
                                <tr className="h-7 bg-slate-50/60">
                                    <td className="border border-slate-200" />
                                    <td colSpan={7} className="border border-slate-200 px-1">
                                        <Button type="button" variant="ghost" size="sm"
                                            onClick={() => setIsCreating(true)}
                                            className="h-6 px-2 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 gap-1.5">
                                            <Plus size={12} />
                                            Nova Receita
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColHeader({ children, align = "left", colIndex, onStartResize }: {
    children: React.ReactNode
    align?: "left" | "right"
    colIndex?: number
    onStartResize?: (col: number, clientX: number) => void
}) {
    return (
        <th className={cn(CELL_HDR, "px-2 font-medium text-xs text-slate-500 whitespace-nowrap relative",
            align === "right" ? "text-right" : "text-left")}>
            {children}
            {colIndex !== undefined && onStartResize && (
                <div
                    className="absolute right-0 top-1 bottom-1 w-1 cursor-col-resize rounded hover:bg-blue-400 active:bg-blue-500 transition-colors"
                    onMouseDown={e => { e.preventDefault(); onStartResize(colIndex, e.clientX) }}
                />
            )}
        </th>
    )
}

// ─── Recipe Group ─────────────────────────────────────────────────────────────

function RecipeGroup({ recipe, collapsed, onToggle, items, unitOptions, variations, rowStartIndex }: {
    recipe: WorksheetRecipe
    collapsed: boolean
    onToggle: () => void
    items: WorksheetItem[]
    unitOptions: string[]
    variations: WorksheetVariation[]
    rowStartIndex: number
}) {
    const [isAdding, setIsAdding] = useState(false)

    const handleStartAdd = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (collapsed) onToggle()
        setIsAdding(true)
    }

    return (
        <>
            {/* ── Recipe header row ── */}
            <RecipeHeaderRow
                recipe={recipe}
                collapsed={collapsed}
                onToggle={onToggle}
                items={items}
                variations={variations}
            />

            {/* ── Ingredient rows ── */}
            {!collapsed && recipe.RecipeLine.map((line, idx) => (
                <RecipeLineRow
                    key={line.id}
                    line={line}
                    unitOptions={unitOptions}
                    items={items}
                    rowNumber={rowStartIndex + idx + 1}
                />
            ))}

            {/* ── Inline add row ── */}
            {!collapsed && isAdding && (
                <AddingRow
                    recipeId={recipe.id}
                    items={items}
                    unitOptions={unitOptions}
                    onDone={() => setIsAdding(false)}
                    rowNumber={rowStartIndex + recipe.RecipeLine.length + 1}
                />
            )}

            {/* ── Add trigger ── */}
            {!collapsed && !isAdding && (
                <tr className="h-7">
                    <td className={cn(CELL)} />
                    <td colSpan={7} className={cn(CELL, "px-1")}>
                        <Button type="button" variant="ghost" size="sm"
                            onClick={handleStartAdd}
                            className="h-6 px-2 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 gap-1.5">
                            <Plus size={12} />
                            Adicionar ingrediente
                        </Button>
                    </td>
                </tr>
            )}
        </>
    )
}

// ─── Recipe Header Row ────────────────────────────────────────────────────────

function RecipeHeaderRow({ recipe, collapsed, onToggle, items, variations }: {
    recipe: WorksheetRecipe
    collapsed: boolean
    onToggle: () => void
    items: WorksheetItem[]
    variations: WorksheetVariation[]
}) {
    const fetcher = useFetcher()

    // Name editing
    const [isEditingName, setIsEditingName] = useState(false)
    const [name, setName] = useState(recipe.name)

    // Item combobox
    const [itemComboOpen, setItemComboOpen] = useState(false)
    const [itemSearch, setItemSearch] = useState("")

    // Sync name if server data changes
    useEffect(() => { setName(recipe.name) }, [recipe.name, recipe.id])

    const saveRecipe = (data: { recipeName?: string; recipeItemId?: string | null; recipeVariationId?: string | null }) => {
        fetcher.submit(
            { _action: "recipe-update", recipeId: recipe.id, ...data as any },
            { method: "post" }
        )
    }

    const totalCost = recipe.RecipeLine.reduce((acc, l) => acc + l.lastTotalCostAmount, 0)
    const nomeCalculado = calcNome(recipe)
    const filteredItems = filterItems(items, itemSearch).slice(0, 50)

    return (
        <tr className="h-9 border-t-2 border-slate-200">
            {/* Expand / collapse */}
            <td className={cn(CELL_RECIPE, "text-center cursor-pointer")} onClick={onToggle}>
                <span className="text-slate-400">
                    {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </span>
            </td>

            {/* Nome Receita — editable */}
            <td className={cn(CELL_RECIPE_EDITABLE, "p-0")} onClick={() => !isEditingName && setIsEditingName(true)}>
                {isEditingName ? (
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => { saveRecipe({ recipeName: name }); setIsEditingName(false) }}
                        onKeyDown={e => {
                            if (e.key === "Enter") { saveRecipe({ recipeName: name }); setIsEditingName(false) }
                            if (e.key === "Escape") { setName(recipe.name); setIsEditingName(false) }
                        }}
                        className="w-full h-full px-2 bg-transparent border-0 outline-none text-sm font-semibold text-slate-800"
                    />
                ) : (
                    <div className="flex items-center gap-2 h-full px-2 cursor-text">
                        <Link
                            to={`/admin/recipes/${recipe.id}`}
                            className="font-semibold text-sm text-slate-800 hover:underline truncate"
                            onClick={e => e.stopPropagation()}
                        >
                            {recipe.name}
                        </Link>
                        <RecipeBadge item={recipe as any} />
                    </div>
                )}
            </td>

            {/* Item Vinculado — combobox */}
            <td className={cn(CELL_RECIPE, "p-0")}>
                <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="w-full h-full px-2 text-left text-xs focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                        >
                            {recipe.Item
                                ? <span className="text-slate-700">{recipe.Item.name}</span>
                                : <span className="text-slate-300 italic">Item vinculado...</span>
                            }
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar item..." value={itemSearch} onValueChange={setItemSearch} />
                            <CommandList className="max-h-[180px]">
                                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                {recipe.itemId && (
                                    <CommandItem value="__clear__" onSelect={() => {
                                        saveRecipe({ recipeItemId: null, recipeVariationId: null })
                                        setItemComboOpen(false)
                                    }}>
                                        <X size={12} className="mr-1 text-slate-400" />
                                        <span className="text-slate-400 italic">Remover vínculo</span>
                                    </CommandItem>
                                )}
                                {filteredItems.map(item => (
                                    <CommandItem key={item.id} value={itemLabel(item)} onSelect={() => {
                                        saveRecipe({ recipeItemId: item.id })
                                        setItemComboOpen(false)
                                        setItemSearch("")
                                    }}>
                                        <div className="flex items-center justify-between w-full gap-2 min-w-0">
                                            <span className="font-medium truncate">{item.name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {item.classification && <span className="text-xs text-slate-400">{item.classification}</span>}
                                                {item.consumptionUm && <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1 rounded">{item.consumptionUm}</span>}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </td>

            {/* Variante — native select */}
            <td className={CELL_RECIPE_EDITABLE}>
                <select
                    value={recipe.variationId ?? ""}
                    onChange={e => saveRecipe({ recipeVariationId: e.target.value || null })}
                    className={cn(INPUT_BASE, "cursor-pointer text-xs")}
                >
                    <option value="">— variante</option>
                    {variations.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            </td>

            {/* Nome Calculado — read-only */}
            <td className={cn(CELL_RECIPE, "px-2")}>
                {nomeCalculado
                    ? <span className="text-xs text-slate-600 block truncate" title={nomeCalculado}>{nomeCalculado}</span>
                    : <span className="text-xs text-slate-300">—</span>
                }
            </td>

            {/* Custo Un. — empty for recipe */}
            <td className={CELL_RECIPE} />

            {/* Total */}
            <td className={cn(CELL_RECIPE, "px-2 text-right")}>
                {totalCost > 0
                    ? <span className="text-sm font-semibold text-slate-700 tabular-nums">R$ {totalCost.toFixed(2)}</span>
                    : <span className="text-xs text-slate-300">—</span>
                }
            </td>

            {/* Actions */}
            <td className={cn(CELL_RECIPE, "text-center")}>
                <Link
                    to={`/admin/recipes/${recipe.id}`}
                    title="Abrir receita"
                    className="text-slate-400 hover:text-slate-700 inline-flex p-1"
                    onClick={e => e.stopPropagation()}
                >
                    <ExternalLink size={12} />
                </Link>
            </td>
        </tr>
    )
}

// ─── Recipe Line Row ──────────────────────────────────────────────────────────

function RecipeLineRow({ line, unitOptions, items, rowNumber }: {
    line: WorksheetRecipeLine
    unitOptions: string[]
    items: WorksheetItem[]
    rowNumber: number
}) {
    const fetcher = useFetcher()
    const itemFetcher = useFetcher()

    // Item combobox state
    const [itemComboOpen, setItemComboOpen] = useState(false)
    const [itemSearch, setItemSearch] = useState("")

    const [unit, setUnit] = useState(line.unit)
    // currentQty: valor numérico atual (atualizado via onValueChange do DecimalInput)
    const [currentQty, setCurrentQty] = useState(line.quantity)
    // defaultQty: passado ao DecimalInput como defaultValue; mudar resets o display
    const [defaultQty, setDefaultQty] = useState(line.quantity)
    const savedUnit = useRef(line.unit)
    const savedQty = useRef(line.quantity)

    useEffect(() => {
        setUnit(line.unit)
        setCurrentQty(line.quantity)
        setDefaultQty(line.quantity)
        savedUnit.current = line.unit
        savedQty.current = line.quantity
    }, [line.unit, line.quantity, line.id])

    const isDirty = unit !== savedUnit.current || currentQty !== savedQty.current

    const save = useCallback(() => {
        if (!isDirty || currentQty <= 0) return
        fetcher.submit(
            { _action: "recipe-line-update", lineId: line.id, lineUnit: unit, lineQuantity: String(currentQty) },
            { method: "post" }
        )
        savedUnit.current = unit
        savedQty.current = currentQty
    }, [isDirty, unit, currentQty, line.id])

    const cancel = useCallback(() => {
        setUnit(savedUnit.current)
        setCurrentQty(savedQty.current)
        setDefaultQty(savedQty.current)  // triggers DecimalInput's useEffect to reset display
    }, [])

    const isPending = fetcher.state !== "idle"
    const displayTotal = line.lastUnitCostAmount * currentQty

    return (
        <tr className={cn("group h-8", isPending && "opacity-50", isDirty && "bg-amber-50/40")}>
            {/* Row # */}
            <td className={cn(CELL, "text-center text-xs text-slate-400 bg-slate-50/30 select-none tabular-nums")}>
                {rowNumber}
            </td>

            {/* Ingrediente — combobox */}
            <td className={cn(CELL_EDITABLE, "p-0")}>
                <Popover open={itemComboOpen} onOpenChange={open => { setItemComboOpen(open); if (!open) setItemSearch("") }}>
                    <PopoverTrigger asChild>
                        <button type="button"
                            className="w-full h-full px-2 text-left text-sm focus:outline-none truncate">
                            {line.Item.name}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar ingrediente..." value={itemSearch} onValueChange={setItemSearch} />
                            <CommandList className="max-h-[200px]">
                                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                {filterItems(items, itemSearch).slice(0, 60).map(item => (
                                    <CommandItem key={item.id} value={itemLabel(item)} onSelect={() => {
                                        setItemComboOpen(false)
                                        setItemSearch("")
                                        itemFetcher.submit(
                                            { _action: "recipe-line-item-update", lineId: line.id, lineItemId: item.id },
                                            { method: "post" }
                                        )
                                    }}>
                                        <div className="flex items-center justify-between w-full gap-2 min-w-0">
                                            <span className="font-medium truncate">{item.name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {item.classification && <span className="text-xs text-slate-400">{item.classification}</span>}
                                                {item.consumptionUm && <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1 rounded">{item.consumptionUm}</span>}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </td>

            {/* Variação Ing. */}
            <td className={cn(CELL, "px-2")}>
                <span className="text-xs text-slate-500 block truncate">
                    {line.ItemVariation?.Variation?.name ?? <span className="text-slate-300">—</span>}
                </span>
            </td>

            {/* UM — editable */}
            <td className={CELL_EDITABLE}>
                <select value={unit} onChange={e => setUnit(e.target.value)} onBlur={save}
                    className={cn(INPUT_BASE, "cursor-pointer")}>
                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    {!unitOptions.includes(unit) && <option value={unit}>{unit}</option>}
                </select>
            </td>

            {/* Quantidade — editable */}
            <td className={CELL_EDITABLE}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); save() }
                    if (e.key === "Escape") cancel()
                }}
            >
                <DecimalInput
                    name="lineQuantity"
                    defaultValue={defaultQty}
                    fractionDigits={4}
                    onValueChange={setCurrentQty}
                    className="w-full h-8 px-2 bg-transparent border-0 outline-none text-sm text-slate-700 text-right"
                />
            </td>

            {/* Custo Un. */}
            <td className={cn(CELL, "px-2 text-right text-xs text-slate-400 tabular-nums")}>
                {line.lastUnitCostAmount > 0
                    ? `R$ ${line.lastUnitCostAmount.toFixed(4)}`
                    : <span className="text-slate-200">—</span>
                }
            </td>

            {/* Total */}
            <td className={cn(CELL, "px-2 text-right text-xs tabular-nums font-medium",
                isDirty ? "text-amber-600" : "text-slate-600")}>
                {displayTotal > 0
                    ? `R$ ${displayTotal.toFixed(4)}`
                    : <span className="text-slate-200">—</span>
                }
            </td>

            {/* Delete */}
            <td className={cn(CELL, "text-center")}>
                <fetcher.Form method="post">
                    <input type="hidden" name="_action" value="recipe-line-delete" />
                    <input type="hidden" name="lineId" value={line.id} />
                    <button type="submit" title="Remover"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all rounded">
                        <Trash2 size={12} />
                    </button>
                </fetcher.Form>
            </td>
        </tr>
    )
}

// ─── Adding Row ───────────────────────────────────────────────────────────────

function AddingRow({ recipeId, items, unitOptions, onDone, rowNumber }: {
    recipeId: string
    items: WorksheetItem[]
    unitOptions: string[]
    onDone: () => void
    rowNumber: number
}) {
    const fetcher = useFetcher()
    const [selectedItem, setSelectedItem] = useState<WorksheetItem | null>(null)
    const [itemSearch, setItemSearch] = useState("")
    const [comboOpen, setComboOpen] = useState(true)
    const [unit, setUnit] = useState(unitOptions.find(u => u === "KG") ?? unitOptions[0] ?? "KG")
    const [qtyValue, setQtyValue] = useState(0)
    const qtyContainerRef = useRef<HTMLDivElement>(null)

    const isPending = fetcher.state !== "idle"

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data && (fetcher.data as { status?: number }).status === 200) {
            onDone()
        }
    }, [fetcher.state, fetcher.data, onDone])

    const filteredItems = filterItems(items, itemSearch)
        .slice(0, 60)

    const submit = () => {
        if (!selectedItem || qtyValue <= 0) return
        fetcher.submit(
            { _action: "recipe-line-add", recipeId, lineItemId: selectedItem.id, lineUnit: unit, lineQuantity: String(qtyValue) },
            { method: "post" }
        )
    }

    const errorMessage = fetcher.data && (fetcher.data as { status?: number }).status !== 200
        ? (fetcher.data as { message?: string }).message : null

    return (
        <tr className={cn("h-8 bg-blue-50/20", isPending && "opacity-60")}>
            <td className={cn(CELL, "text-center text-xs text-slate-400 bg-blue-50/30 select-none tabular-nums")}>{rowNumber}</td>

            {/* Item combobox */}
            <td className={cn(CELL_EDITABLE, "p-0")}>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                    <PopoverTrigger asChild>
                        <button type="button"
                            className={cn("w-full h-full px-2 text-left text-sm focus:outline-none",
                                selectedItem ? "text-slate-700" : "text-slate-400 italic")}>
                            {selectedItem ? selectedItem.name : "Selecionar ingrediente..."}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar..." value={itemSearch} onValueChange={setItemSearch} />
                            <CommandList className="max-h-[200px]">
                                <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                {filteredItems.map(item => (
                                    <CommandItem key={item.id} value={itemLabel(item)} onSelect={() => {
                                        setSelectedItem(item); setComboOpen(false); setItemSearch("")
                                        setTimeout(() => qtyContainerRef.current?.querySelector<HTMLInputElement>("input:not([type='hidden'])")?.focus(), 50)
                                    }}>
                                        <div className="flex items-center justify-between w-full gap-2 min-w-0">
                                            <span className="font-medium truncate">{item.name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {item.classification && <span className="text-xs text-slate-400">{item.classification}</span>}
                                                {item.consumptionUm && <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1 rounded">{item.consumptionUm}</span>}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </td>

            <td className={cn(CELL, "px-2")}><span className="text-xs text-slate-300">—</span></td>

            {/* UM */}
            <td className={CELL_EDITABLE}>
                <select value={unit} onChange={e => setUnit(e.target.value)}
                    className={cn(INPUT_BASE, "cursor-pointer")}>
                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
            </td>

            {/* Qtd */}
            <td className={CELL_EDITABLE}
                onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); submit() }
                    if (e.key === "Escape") onDone()
                }}
            >
                <div ref={qtyContainerRef}>
                    <DecimalInput
                        name="lineQuantity"
                        defaultValue={0}
                        fractionDigits={4}
                        onValueChange={setQtyValue}
                        className="w-full h-8 px-2 bg-transparent border-0 outline-none text-sm text-slate-700 text-right"
                    />
                </div>
            </td>

            <td className={cn(CELL, "px-2")}>
                {errorMessage && <span className="text-xs text-red-500 block truncate">{errorMessage}</span>}
            </td>
            <td className={CELL} />

            <td className={cn(CELL, "text-center")}>
                <div className="flex items-center justify-center gap-0.5">
                    <button type="button" onClick={submit} disabled={!selectedItem || qtyValue <= 0 || isPending}
                        title="Confirmar (Enter)"
                        className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <Check size={12} />
                    </button>
                    <button type="button" onClick={onDone} title="Cancelar (Esc)"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X size={12} />
                    </button>
                </div>
            </td>
        </tr>
    )
}

// ─── Creating Recipe Row ──────────────────────────────────────────────────────

function CreatingRecipeRow({ items, variations, onDone }: {
    items: WorksheetItem[]
    variations: WorksheetVariation[]
    onDone: () => void
}) {
    const fetcher = useFetcher()
    const [selectedItem, setSelectedItem] = useState<WorksheetItem | null>(null)
    const [itemSearch, setItemSearch] = useState("")
    // Auto-open item combobox — item is the primary field
    const [itemComboOpen, setItemComboOpen] = useState(true)
    const [variationId, setVariationId] = useState("")
    const [name, setName] = useState("")
    // Track if name was auto-generated so variation changes can also update it
    const [nameAutoSet, setNameAutoSet] = useState(false)
    const nameRef = useRef<HTMLInputElement>(null)

    const isPending = fetcher.state !== "idle"

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data && (fetcher.data as { status?: number }).status === 200) {
            onDone()
        }
    }, [fetcher.state, fetcher.data, onDone])

    const buildAutoName = (item: WorksheetItem, varId: string) => {
        const varName = variations.find(v => v.id === varId)?.name
        return varName ? `Receita ${item.name} (${varName})` : `Receita ${item.name}`
    }

    const handleSelectItem = (item: WorksheetItem) => {
        setSelectedItem(item)
        setItemComboOpen(false)
        setItemSearch("")
        const auto = buildAutoName(item, variationId)
        setName(auto)
        setNameAutoSet(true)
        setTimeout(() => nameRef.current?.focus(), 50)
    }

    const handleVariationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const vid = e.target.value
        setVariationId(vid)
        if (nameAutoSet && selectedItem) {
            setName(buildAutoName(selectedItem, vid))
        }
    }

    const submit = () => {
        if (!name.trim()) return
        fetcher.submit(
            {
                _action: "recipe-create",
                recipeName: name.trim(),
                ...(selectedItem ? { recipeItemId: selectedItem.id } : {}),
                ...(variationId ? { recipeVariationId: variationId } : {}),
            },
            { method: "post" }
        )
    }

    const filteredItems = filterItems(items, itemSearch).slice(0, 50)
    const errorMessage = fetcher.data && (fetcher.data as { status?: number }).status !== 200
        ? (fetcher.data as { message?: string }).message : null

    const nomeCalc = selectedItem ? calcNome({ Item: selectedItem, Variation: variations.find(v => v.id === variationId) ?? null }) : null

    return (
        <tr className={cn("h-8 bg-green-50/20 border-t-2 border-green-200", isPending && "opacity-60")}>
            {/* # */}
            <td className={cn(CELL, "bg-green-50/30 text-center")}>
                <Plus size={11} className="text-green-500 mx-auto" />
            </td>

            {/* Nome — auto-filled, editable */}
            <td className={CELL_EDITABLE}>
                <input
                    ref={nameRef}
                    value={name}
                    onChange={e => { setName(e.target.value); setNameAutoSet(false) }}
                    onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); submit() }
                        if (e.key === "Escape") onDone()
                    }}
                    placeholder="Selecione o item →"
                    className={cn(INPUT_BASE, "font-semibold placeholder:font-normal")}
                />
            </td>

            {/* Item vinculado — primary field, auto-opens */}
            <td className={cn(CELL, "p-0")}>
                <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                    <PopoverTrigger asChild>
                        <button type="button"
                            className="w-full h-full px-2 text-left text-xs focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                            {selectedItem
                                ? <span className="text-slate-700">{selectedItem.name}</span>
                                : <span className="text-blue-400 font-medium italic">← Item (obrigatório)</span>
                            }
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar item..." value={itemSearch} onValueChange={setItemSearch} />
                            <CommandList className="max-h-[200px]">
                                <CommandEmpty>Nenhum item.</CommandEmpty>
                                {filteredItems.map(item => (
                                    <CommandItem key={item.id} value={itemLabel(item)} onSelect={() => handleSelectItem(item)}>
                                        <div className="flex items-center justify-between w-full gap-2 min-w-0">
                                            <span className="font-medium truncate">{item.name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {item.classification && <span className="text-xs text-slate-400">{item.classification}</span>}
                                                {item.consumptionUm && <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1 rounded">{item.consumptionUm}</span>}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </td>

            {/* Variante */}
            <td className={CELL_EDITABLE}>
                <select value={variationId} onChange={handleVariationChange}
                    className={cn(INPUT_BASE, "cursor-pointer text-xs")}>
                    <option value="">— variante</option>
                    {variations.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            </td>

            {/* Nome Calculado preview */}
            <td className={cn(CELL, "px-2")}>
                {nomeCalc
                    ? <span className="text-xs text-slate-500 block truncate">{nomeCalc}</span>
                    : errorMessage
                        ? <span className="text-xs text-red-500 block truncate">{errorMessage}</span>
                        : <span className="text-xs text-slate-300">—</span>
                }
            </td>

            <td className={CELL} />
            <td className={CELL} />

            {/* Confirm / Cancel */}
            <td className={cn(CELL, "text-center")}>
                <div className="flex items-center justify-center gap-0.5">
                    <button type="button" onClick={submit} disabled={!name.trim() || isPending}
                        title="Criar (Enter)"
                        className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <Check size={12} />
                    </button>
                    <button type="button" onClick={onDone} title="Cancelar (Esc)"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X size={12} />
                    </button>
                </div>
            </td>
        </tr>
    )
}
