import { useEffect, useRef, useState, useCallback, Fragment } from "react"
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useFetcher, Link, useSearchParams } from "@remix-run/react"
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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "~/components/ui/select"
import RecipeBadge from "~/domain/recipe/components/recipe-badge/recipe-badge"
import { DecimalInput } from "~/components/inputs/inputs"
import {
    applyRecipeCompositionLineToVariations,
    createRecipeCompositionLine,
    deleteRecipeCompositionLine,
    listRecipeCompositionLines,
    listRecipeLinkedVariations,
    updateRecipeCompositionLine,
    updateRecipeCompositionLineItem,
} from "~/domain/recipe/recipe-composition.server"

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
        variationId?: string | null
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
    linkedVariations?: LinkedVariation[]
}

type WorksheetItem = { id: string; name: string; classification: string; consumptionUm: string | null }
type WorksheetVariation = { id: string; name: string; kind: string | null }
type LinkedVariation = { itemVariationId: string; variationId: string | null; variationName: string | null }

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

async function resolveLineCostSnapshot(db: any, itemId: string, variationId?: string | null) {
    const baseWhere: Record<string, any> = { itemId, deletedAt: null }
    if (variationId) baseWhere.variationId = variationId

    let itemVariation = await db.itemVariation.findFirst({
        where: baseWhere,
        include: { ItemCostVariation: true },
        orderBy: [{ createdAt: "asc" }],
    })

    if (!itemVariation && variationId) {
        itemVariation = await db.itemVariation.findFirst({
            where: { itemId, deletedAt: null },
            include: { ItemCostVariation: true },
            orderBy: [{ createdAt: "asc" }],
        })
    }

    const lastUnitCostAmount = Number(itemVariation?.ItemCostVariation?.costAmount ?? 0)
    return {
        lastUnitCostAmount,
        avgUnitCostAmount: lastUnitCostAmount,
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
    const [recipesRaw, items, unitOptions, variations] = result
    const recipes = await Promise.all(
        (recipesRaw || []).map(async (recipe: any) => ({
            ...recipe,
            RecipeLine: await listRecipeCompositionLines(db, recipe.id),
            linkedVariations: await listRecipeLinkedVariations(db, recipe.id),
        }))
    )
    return ok({ recipes, items, unitOptions, variations })
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData()
    const { _action, ...values } = Object.fromEntries(formData)
    const db = prismaClient as any

    // ── Update recipe (name / item) ────────────────────────────────────────
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
        data.variationId = null

        const [err] = await tryit(db.recipe.update({ where: { id: recipeId }, data }))
        if (err) return badRequest("Erro ao atualizar receita")

        const updatedRecipe = await db.recipe.findUnique({
            where: { id: recipeId },
            select: { itemId: true, variationId: true },
        })
        const itemId = String(updatedRecipe?.itemId || "").trim()
        const variationId = String(updatedRecipe?.variationId || "").trim()
        if (itemId && variationId) {
            const itemVariation = await db.itemVariation.findFirst({
                where: { itemId, variationId, deletedAt: null },
                select: { id: true },
            }) || await db.itemVariation.create({
                data: { itemId, variationId, recipeId },
                select: { id: true },
            })
            await db.itemVariation.update({
                where: { id: itemVariation.id },
                data: { recipeId },
            })
        }
        return ok({ message: "Receita atualizada" })
    }

    // ── Create recipe ──────────────────────────────────────────────────────
    if (_action === "recipe-create") {
        const name = String(values.recipeName || "").trim()
        if (!name) return badRequest("Informe o nome da receita")

        const itemId = String(values.recipeItemId || "").trim() || null

        const [err, created] = await tryit(db.recipe.create({
            data: {
                name,
                type: "semiFinished",
                hasVariations: false,
                isVegetarian: false,
                isGlutenFree: false,
                ...(itemId ? { itemId } : {}),
                variationId: null,
            },
        }))
        if (err) return badRequest("Erro ao criar receita")
        return ok({ message: "Receita criada" })
    }

    // ── Update recipe line ─────────────────────────────────────────────────
    if (_action === "recipe-line-update") {
        const recipeId = String(values.recipeId || "").trim()
        const lineId = String(values.lineId || "").trim()
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        const quantity = Number(String(values.lineQuantity || "0").replace(",", "."))

        if (!recipeId || !lineId) return badRequest("ID da linha inválido")
        if (!unit) return badRequest("Informe a unidade")
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Quantidade inválida")

        const lines = await listRecipeCompositionLines(db, recipeId)
        const line = lines.find((current) => current.id === lineId)
        if (!line) return badRequest("Linha não encontrada")

        const cost = await resolveLineCostSnapshot(db, line.itemId, line.ItemVariation?.variationId || null)
        const [err] = await tryit(updateRecipeCompositionLine({
            db,
            lineId,
            recipeId,
            unit,
            quantity,
            snapshot: {
                lastUnitCostAmount: Number(cost.lastUnitCostAmount || 0),
                avgUnitCostAmount: Number(cost.avgUnitCostAmount || 0),
                lastTotalCostAmount: Number(((cost.lastUnitCostAmount || 0) * quantity).toFixed(6)),
                avgTotalCostAmount: Number(((cost.avgUnitCostAmount || 0) * quantity).toFixed(6)),
            },
        }))
        if (err) return badRequest("Erro ao atualizar linha")
        return ok({ message: "Linha atualizada" })
    }

    // ── Delete recipe line ─────────────────────────────────────────────────
    if (_action === "recipe-line-delete") {
        const lineId = String(values.lineId || "").trim()
        if (!lineId) return badRequest("ID inválido")
        const [err] = await tryit(deleteRecipeCompositionLine(db, lineId))
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

        const cost = await resolveLineCostSnapshot(db, itemId, null)
        const [err] = await tryit(createRecipeCompositionLine({
            db,
            recipeId,
            itemId,
            unit,
            quantity,
            snapshot: {
                lastUnitCostAmount: Number(cost.lastUnitCostAmount || 0),
                avgUnitCostAmount: Number(cost.avgUnitCostAmount || 0),
                lastTotalCostAmount: Number(((cost.lastUnitCostAmount || 0) * quantity).toFixed(6)),
                avgTotalCostAmount: Number(((cost.avgUnitCostAmount || 0) * quantity).toFixed(6)),
            },
        }))
        if (err) return badRequest("Erro ao adicionar ingrediente: " + err.message)
        return ok({ message: "Ingrediente adicionado" })
    }

    // ── Update recipe line item ────────────────────────────────────────────
    if (_action === "recipe-line-item-update") {
        const recipeId = String(values.recipeId || "").trim()
        const lineId = String(values.lineId || "").trim()
        const itemId = String(values.lineItemId || "").trim()
        if (!recipeId || !lineId || !itemId) return badRequest("IDs inválidos")

        const lines = await listRecipeCompositionLines(db, recipeId)
        const line = lines.find((current) => current.id === lineId)
        if (!line) return badRequest("Linha não encontrada")

        const qty = Number(line.quantity || 0)
        const lossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0)
        const normalizedLoss = Math.min(99.9999, Math.max(0, lossPct))
        const grossQty = normalizedLoss > 0
            ? Number((qty / (1 - normalizedLoss / 100)).toFixed(6))
            : qty
        const cost = await resolveLineCostSnapshot(db, itemId, line.ItemVariation?.variationId || null)

        const [err] = await tryit(updateRecipeCompositionLineItem({
            db,
            lineId,
            recipeId,
            itemId,
            quantity: qty,
            unit: line.unit,
            snapshot: {
                lastUnitCostAmount: Number(cost.lastUnitCostAmount || 0),
                avgUnitCostAmount: Number(cost.avgUnitCostAmount || 0),
                lastTotalCostAmount: Number(((cost.lastUnitCostAmount || 0) * grossQty).toFixed(6)),
                avgTotalCostAmount: Number(((cost.avgUnitCostAmount || 0) * grossQty).toFixed(6)),
            },
        }))
        if (err) return badRequest("Erro ao atualizar ingrediente")
        return ok({ message: "Ingrediente atualizado" })
    }

    if (_action === "recipe-line-apply-variations") {
        const recipeId = String(values.recipeId || "").trim()
        const lineId = String(values.lineId || "").trim()
        const formVariationIds = formData.getAll("variationId").map((value) => String(value || "").trim()).filter(Boolean)
        const variationIdsRaw = String(values.targetVariationIds || "").trim()
        const variationIds = formVariationIds.length > 0
            ? formVariationIds
            : variationIdsRaw.split(",").map((value) => value.trim()).filter(Boolean)
        if (!recipeId || !lineId) return badRequest("Linha inválida")
        if (variationIds.length === 0) return badRequest("Selecione ao menos uma variação")

        const [err] = await tryit(applyRecipeCompositionLineToVariations({
            db,
            recipeId,
            lineId,
            variationIds,
            resolveCostByVariationId: async (variationId, itemId, quantity, lossPct) => {
                const normalizedLoss = Math.min(99.9999, Math.max(0, Number(lossPct || 0)))
                const grossQty = normalizedLoss > 0
                    ? Number((quantity / (1 - normalizedLoss / 100)).toFixed(6))
                    : quantity
                const cost = await resolveLineCostSnapshot(db, itemId, variationId)
                return {
                    lastUnitCostAmount: Number(cost.lastUnitCostAmount || 0),
                    avgUnitCostAmount: Number(cost.avgUnitCostAmount || 0),
                    lastTotalCostAmount: Number(((cost.lastUnitCostAmount || 0) * grossQty).toFixed(6)),
                    avgTotalCostAmount: Number(((cost.avgUnitCostAmount || 0) * grossQty).toFixed(6)),
                }
            },
        }))
        if (err) return badRequest("Erro ao aplicar variações")
        return ok({ message: "Variações atualizadas" })
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
//   6  │  36px  │ link / count         │ delete

// ─── Column widths (default px) — col 1 (name) is the widest / most flexible ──
const DEFAULT_COL_WIDTHS = [36, 240, 120, 72, 100, 36]
// Minimum widths per column (don't shrink below these)
const MIN_COL_WIDTHS = [36, 80, 60, 50, 60, 36]

// ─── Flat view column widths: # | Receita | Ingrediente | Variação | UM | Qtd | Del
const FLAT_DEFAULT_COL_WIDTHS = [36, 180, 200, 120, 72, 100, 36]
const FLAT_MIN_COL_WIDTHS     = [36,  80, 100,  60, 50,  60, 36]
const LINE_PAGE_SIZE = 100

function limitRecipesByLines(recipes: WorksheetRecipe[], limit: number): WorksheetRecipe[] {
    if (limit <= 0) return []
    const output: WorksheetRecipe[] = []
    let remaining = limit

    for (const recipe of recipes) {
        if (remaining <= 0) break
        const lineCount = recipe.RecipeLine.length
        if (lineCount <= remaining) {
            output.push(recipe)
            remaining -= lineCount
        } else {
            output.push({ ...recipe, RecipeLine: recipe.RecipeLine.slice(0, remaining) })
            remaining = 0
        }
    }

    return output
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RecipeWorksheet() {
    const loaderData = useLoaderData<typeof loader>()
    const recipes = (loaderData?.payload?.recipes ?? []) as WorksheetRecipe[]
    const items = (loaderData?.payload?.items ?? []) as WorksheetItem[]
    const unitOptions = (loaderData?.payload?.unitOptions ?? UNIT_FALLBACK) as string[]
    const variations = (loaderData?.payload?.variations ?? []) as WorksheetVariation[]

    const [searchParams, setSearchParams] = useSearchParams()
    const view = searchParams.get("view") ?? "grouped"

    const [search, setSearch] = useState("")
    const [filterItemId, setFilterItemId] = useState("__all__")
    const [filterVariationId, setFilterVariationId] = useState("__all__")
    const [visibleLineCount, setVisibleLineCount] = useState(LINE_PAGE_SIZE)
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [isCreating, setIsCreating] = useState(false)

    // ── Column resizing ──────────────────────────────────────────────────────
    const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS)
    const [flatColWidths, setFlatColWidths] = useState(FLAT_DEFAULT_COL_WIDTHS)
    const resizeRef = useRef<{ col: number; startX: number; startW: number; flat: boolean } | null>(null)
    const [isResizing, setIsResizing] = useState(false)

    const startResize = useCallback((col: number, clientX: number) => {
        resizeRef.current = { col, startX: clientX, startW: colWidths[col], flat: false }
        setIsResizing(true)
    }, [colWidths])

    const startFlatResize = useCallback((col: number, clientX: number) => {
        resizeRef.current = { col, startX: clientX, startW: flatColWidths[col], flat: true }
        setIsResizing(true)
    }, [flatColWidths])

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!resizeRef.current) return
            const { col, startX, startW, flat } = resizeRef.current
            const delta = e.clientX - startX
            if (flat) {
                setFlatColWidths(prev => {
                    const next = [...prev]
                    next[col] = Math.max(FLAT_MIN_COL_WIDTHS[col], startW + delta)
                    return next
                })
            } else {
                setColWidths(prev => {
                    const next = [...prev]
                    next[col] = Math.max(MIN_COL_WIDTHS[col], startW + delta)
                    return next
                })
            }
        }
        const onUp = () => { resizeRef.current = null; setIsResizing(false) }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
        return () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
    }, [])

    const filteredRecipes = recipes.filter(r => {
        if (!r.name.toLowerCase().includes(search.toLowerCase())) return false
        if (filterItemId !== "__all__" && r.itemId !== filterItemId) return false
        if (filterVariationId !== "__all__" && r.variationId !== filterVariationId) return false
        return true
    })
    const totalLines = filteredRecipes.reduce((acc, r) => acc + r.RecipeLine.length, 0)
    const limitedRecipes = limitRecipesByLines(filteredRecipes, visibleLineCount)
    const shownLines = limitedRecipes.reduce((acc, r) => acc + r.RecipeLine.length, 0)
    const hasMoreLines = totalLines > shownLines

    useEffect(() => {
        setVisibleLineCount(LINE_PAGE_SIZE)
    }, [search, filterItemId, filterVariationId])

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
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Buscar receita..." className="pl-8 h-7 text-xs min-w-[200px]"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterItemId} onValueChange={setFilterItemId}>
                    <SelectTrigger className="h-7 text-xs px-2 border-slate-200 w-auto min-w-[150px] focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Item vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Todos os itens</SelectItem>
                        {items.map(item => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterVariationId} onValueChange={setFilterVariationId}>
                    <SelectTrigger className="h-7 text-xs px-2 border-slate-200 w-auto min-w-[150px] focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Variação" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Todas as variações</SelectItem>
                        {variations.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {view === "grouped" && <>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setCollapsed(new Set())}>Expandir tudo</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setCollapsed(new Set(filteredRecipes.map(r => r.id)))}>Recolher tudo</Button>
                </>}
                <div className="flex items-center border border-slate-200 rounded-md overflow-hidden divide-x divide-slate-200">
                    <Button variant="ghost" size="sm"
                        className={cn("h-7 px-3 text-xs rounded-none",
                            view === "grouped" ? "bg-slate-100 text-slate-700 font-medium" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
                        onClick={() => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set("view", "grouped"); return n })}
                    >Agrupada</Button>
                    <Button variant="ghost" size="sm"
                        className={cn("h-7 px-3 text-xs rounded-none",
                            view === "flat" ? "bg-slate-100 text-slate-700 font-medium" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
                        onClick={() => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set("view", "flat"); return n })}
                    >Plana</Button>
                </div>
                <div className="flex-1" />
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    <span className="font-bold text-slate-700">{filteredRecipes.length}</span> receitas
                    {" · "}
                    <span className="font-bold text-slate-700">{totalLines}</span> ingredientes
                </span>
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    Mostrando <span className="font-bold text-slate-700">{shownLines}</span> de{" "}
                    <span className="font-bold text-slate-700">{totalLines}</span> linhas
                </span>
            </div>

            {/* ── Grid ── */}
            <div className={cn("rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm", isResizing && "select-none")}>
                <div className="overflow-x-auto">
                    {view === "flat" ? (
                        <table className="border-collapse"
                            style={{ tableLayout: "fixed", width: `${flatColWidths.reduce((a, b) => a + b, 0)}px`, minWidth: "100%" }}>
                            <colgroup>
                                {flatColWidths.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className={CELL_HDR} />
                                    <ColHeader colIndex={1} onStartResize={startFlatResize}>Receita</ColHeader>
                                    <ColHeader colIndex={2} onStartResize={startFlatResize}>Ingrediente</ColHeader>
                                    <ColHeader colIndex={3} onStartResize={startFlatResize}>Variação</ColHeader>
                                    <ColHeader colIndex={4} onStartResize={startFlatResize}>UM</ColHeader>
                                    <ColHeader colIndex={5} onStartResize={startFlatResize} align="right">Quantidade</ColHeader>
                                    <th className={CELL_HDR} />
                                </tr>
                            </thead>
                            <FlatTableBody
                                recipes={limitedRecipes}
                                items={items}
                                unitOptions={unitOptions}
                            />
                        </table>
                    ) : (
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
                                    <ColHeader colIndex={1} onStartResize={startResize}>Ingrediente</ColHeader>
                                    <ColHeader colIndex={2} onStartResize={startResize}>Variação</ColHeader>
                                    <ColHeader colIndex={3} onStartResize={startResize}>UM</ColHeader>
                                    <ColHeader colIndex={4} onStartResize={startResize} align="right">Quantidade</ColHeader>
                                    <th className={CELL_HDR} />
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRecipes.length === 0 && !isCreating && (
                                    <tr>
                                        <td colSpan={6} className="border border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                                            Nenhuma receita encontrada.
                                        </td>
                                    </tr>
                                )}

                                {limitedRecipes.map(recipe => {
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
                                            linkedVariations={recipe.linkedVariations || []}
                                            rowStartIndex={startIndex}
                                        />
                                    )
                                })}

                                {/* ── Create new recipe ── */}
                                {isCreating ? (
                                    <CreatingRecipeRow
                                        items={items}
                                        onDone={() => setIsCreating(false)}
                                    />
                                ) : (
                                    <tr className="h-7 bg-slate-50/60">
                                        <td className="border border-slate-200" />
                                        <td colSpan={5} className="border border-slate-200 p-3">
                                            <Button
                                                onClick={() => setIsCreating(true)}
                                                className="h-7 px-2 text-sm font-medium gap-1.5">
                                                <Plus size={12} />
                                                Nova Receita
                                            </Button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {hasMoreLines && (
                <div className="flex items-center justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs text-slate-600"
                        onClick={() => setVisibleLineCount((prev) => prev + LINE_PAGE_SIZE)}
                    >
                        Carregar mais ({shownLines} de {totalLines})
                    </Button>
                </div>
            )}
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

function RecipeGroup({ recipe, collapsed, onToggle, items, unitOptions, linkedVariations, rowStartIndex }: {
    recipe: WorksheetRecipe
    collapsed: boolean
    onToggle: () => void
    items: WorksheetItem[]
    unitOptions: string[]
    linkedVariations: LinkedVariation[]
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
            />

            {/* ── Ingredient rows ── */}
            {!collapsed && recipe.RecipeLine.map((line, idx) => (
                <RecipeLineRow
                    key={line.id}
                    line={line}
                    recipeId={recipe.id}
                    linkedVariations={linkedVariations}
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
                    <td colSpan={5} className={cn(CELL, "px-1")}>
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

function RecipeHeaderRow({ recipe, collapsed, onToggle, items }: {
    recipe: WorksheetRecipe
    collapsed: boolean
    onToggle: () => void
    items: WorksheetItem[]
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

    const saveRecipe = (data: { recipeName?: string; recipeItemId?: string | null }) => {
        fetcher.submit(
            { _action: "recipe-update", recipeId: recipe.id, ...data as any },
            { method: "post" }
        )
    }

    const nomeCalculado = calcNome(recipe)
    const filteredItems = filterItems(items, itemSearch).slice(0, 50)

    return (
        <tr className="h-9 border-t-2 border-slate-300">
            {/* Expand / collapse */}
            <td
                className={cn(CELL_RECIPE, "text-center cursor-pointer select-none")}
                onClick={onToggle}
            >
                <span className="text-slate-400 flex items-center justify-center">
                    {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </span>
            </td>

            {/* Recipe metadata — spans all remaining columns */}
            <td colSpan={5} className={cn(CELL_RECIPE, "px-2")}>
                <div className="flex items-center gap-2 h-full min-w-0">

                    {/* Nome — click to edit */}
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
                            className="font-semibold text-sm text-slate-800 bg-white border border-blue-400 rounded px-1.5 h-6 outline-none min-w-0 w-48 shrink-0"
                        />
                    ) : (
                        <div className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[260px]">
                            <Link
                                to={`/admin/recipes/${recipe.id}`}
                                onClick={e => e.stopPropagation()}
                                className="font-semibold text-sm text-slate-800 hover:text-blue-600 hover:underline truncate text-left"
                                title={recipe.name}
                            >
                                {recipe.name}
                            </Link>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsEditingName(true) }}
                                className="text-[10px] text-slate-400 hover:text-slate-700 shrink-0"
                                title="Editar nome"
                            >
                                Editar
                            </button>
                        </div>
                    )}

                    <RecipeBadge item={recipe as any} />

                    <span className="text-slate-200 select-none shrink-0">|</span>

                    {/* Item vinculado — combobox as compact badge */}
                    <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    "text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 transition-colors",
                                    recipe.Item
                                        ? "border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                                        : "border-dashed border-slate-300 text-slate-400 italic hover:border-blue-300 hover:text-blue-500"
                                )}
                            >
                                {recipe.Item ? recipe.Item.name : "↳ item"}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Buscar item..." value={itemSearch} onValueChange={setItemSearch} />
                                <CommandList className="max-h-[180px]">
                                        <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                    {recipe.itemId && (
                                        <CommandItem value="__clear__" onSelect={() => {
                                            saveRecipe({ recipeItemId: null })
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

                    {/* Nome calculado */}
                    {nomeCalculado && (
                        <span className="text-xs text-slate-400 truncate max-w-[120px]" title={nomeCalculado}>
                            {nomeCalculado}
                        </span>
                    )}

                    <div className="flex-1" />

                    {/* Link */}
                    <Button variant="outline" size="icon" title="Abrir receita"
                        className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-700" asChild>
                        <Link to={`/admin/recipes/${recipe.id}`} onClick={e => e.stopPropagation()}>
                            <ExternalLink size={14} />
                        </Link>
                    </Button>
                </div>
            </td>
        </tr>
    )
}

// ─── Recipe Line Row ──────────────────────────────────────────────────────────

function RecipeLineRow({ line, recipeId, linkedVariations, unitOptions, items, rowNumber, flatRecipe }: {
    line: WorksheetRecipeLine
    recipeId: string
    linkedVariations: LinkedVariation[]
    unitOptions: string[]
    items: WorksheetItem[]
    rowNumber: number
    /** undefined = grouped view (no Receita cell); null = flat view non-first row (empty cell); object = flat view first row (shows name) */
    flatRecipe?: { id: string; name: string } | null
}) {
    const fetcher = useFetcher()
    const itemFetcher = useFetcher()
    const applyFetcher = useFetcher()

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
            { _action: "recipe-line-update", recipeId, lineId: line.id, lineUnit: unit, lineQuantity: String(currentQty) },
            { method: "post" }
        )
        savedUnit.current = unit
        savedQty.current = currentQty
    }, [isDirty, unit, currentQty, line.id, recipeId])

    const cancel = useCallback(() => {
        setUnit(savedUnit.current)
        setCurrentQty(savedQty.current)
        setDefaultQty(savedQty.current)  // triggers DecimalInput's useEffect to reset display
    }, [])

    const isPending = fetcher.state !== "idle"
    const [selectedVariationIds, setSelectedVariationIds] = useState<string[]>([])

    useEffect(() => {
        const defaultId = String(line.ItemVariation?.variationId || "").trim()
        setSelectedVariationIds(defaultId ? [defaultId] : [])
    }, [line.id, line.ItemVariation?.variationId])

    return (
        <tr className={cn("group h-8", isPending && "opacity-50", isDirty && "bg-amber-50/40",
            !!flatRecipe && "border-t-2 border-slate-200")}>
            {/* Row # */}
            <td className={cn(CELL, "text-center text-xs text-slate-400 bg-slate-50/30 select-none tabular-nums")}>
                {rowNumber}
            </td>

            {/* Receita cell — flat view only */}
            {flatRecipe !== undefined && (
                <td className={cn(CELL, "px-2")}>
                    {flatRecipe && (
                        <Link
                            to={`/admin/recipes/${flatRecipe.id}`}
                            className="text-xs font-semibold text-slate-700 hover:text-blue-600 hover:underline truncate block"
                            title={flatRecipe.name}
                        >
                            {flatRecipe.name}
                        </Link>
                    )}
                </td>
            )}

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
                                            { _action: "recipe-line-item-update", recipeId, lineId: line.id, lineItemId: item.id },
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
                {linkedVariations.length > 1 && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {linkedVariations
                            .filter((variation) => variation.variationId)
                            .map((variation) => {
                                const variationId = String(variation.variationId || "")
                                const checked = selectedVariationIds.includes(variationId)
                                return (
                                    <label key={variation.itemVariationId} className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                                        <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={checked}
                                            onChange={(event) => {
                                                setSelectedVariationIds((current) => {
                                                    if (event.target.checked) {
                                                        if (current.includes(variationId)) return current
                                                        return [...current, variationId]
                                                    }
                                                    return current.filter((id) => id !== variationId)
                                                })
                                            }}
                                        />
                                        <span>{variation.variationName || "Variação"}</span>
                                    </label>
                                )
                            })}
                        <button
                            type="button"
                            disabled={selectedVariationIds.length === 0 || applyFetcher.state !== "idle"}
                            onClick={() => {
                                applyFetcher.submit({
                                    _action: "recipe-line-apply-variations",
                                    recipeId,
                                    lineId: line.id,
                                    targetVariationIds: selectedVariationIds.join(","),
                                }, { method: "post" })
                            }}
                            className="rounded border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                            Aplicar selecionadas
                        </button>
                    </div>
                )}
            </td>

            {/* UM — editable */}
            <td className={CELL_EDITABLE}>
                <Select value={unit} onValueChange={(newUnit) => {
                    setUnit(newUnit)
                    if (currentQty > 0) {
                        fetcher.submit(
                            { _action: "recipe-line-update", recipeId, lineId: line.id, lineUnit: newUnit, lineQuantity: String(currentQty) },
                            { method: "post" }
                        )
                        savedUnit.current = newUnit
                        savedQty.current = currentQty
                    }
                }}>
                    <SelectTrigger className="h-8 w-full border-0 rounded-none shadow-none text-sm text-slate-700 focus:ring-0 focus:ring-offset-0 bg-transparent px-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        {!unitOptions.includes(unit) && <SelectItem value={unit}>{unit}</SelectItem>}
                    </SelectContent>
                </Select>
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

            {/* Delete */}
            <td className={cn(CELL, "text-center")}>
                <fetcher.Form method="post">
                    <input type="hidden" name="_action" value="recipe-line-delete" />
                    <input type="hidden" name="recipeId" value={recipeId} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <Button type="submit" variant="outline" size="icon" title="Remover"
                        className="h-7 w-7 text-red-400 border-red-200 hover:text-red-600 hover:bg-red-50 hover:border-red-300">
                        <Trash2 size={14} />
                    </Button>
                </fetcher.Form>
            </td>
        </tr>
    )
}

// ─── Adding Row ───────────────────────────────────────────────────────────────

function AddingRow({ recipeId, items, unitOptions, onDone, rowNumber, flatView }: {
    recipeId: string
    items: WorksheetItem[]
    unitOptions: string[]
    onDone: () => void
    rowNumber: number
    flatView?: boolean
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
            {flatView && <td className={CELL} />}

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
                <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="h-8 w-full border-0 rounded-none shadow-none text-sm text-slate-700 focus:ring-0 focus:ring-offset-0 bg-transparent px-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                </Select>
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
                <div className="flex items-center justify-center gap-1">
                    <Button type="button" variant="outline" size="icon" onClick={submit}
                        disabled={!selectedItem || qtyValue <= 0 || isPending}
                        title="Confirmar (Enter)"
                        className="h-7 w-7 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300">
                        <Check size={14} />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={onDone}
                        title="Cancelar (Esc)"
                        className="h-7 w-7 text-slate-400 border-slate-200 hover:text-slate-600">
                        <X size={14} />
                    </Button>
                </div>
            </td>
        </tr>
    )
}

// ─── Creating Recipe Row ──────────────────────────────────────────────────────

function CreatingRecipeRow({ items, onDone, flatView }: {
    items: WorksheetItem[]
    onDone: () => void
    flatView?: boolean
}) {
    const fetcher = useFetcher()
    const [selectedItem, setSelectedItem] = useState<WorksheetItem | null>(null)
    const [itemSearch, setItemSearch] = useState("")
    // Auto-open item combobox — item is the primary field
    const [itemComboOpen, setItemComboOpen] = useState(true)
    const [name, setName] = useState("")
    // Track if name was auto-generated so item changes can also update it
    const [nameAutoSet, setNameAutoSet] = useState(false)
    const nameRef = useRef<HTMLInputElement>(null)

    const isPending = fetcher.state !== "idle"

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data && (fetcher.data as { status?: number }).status === 200) {
            onDone()
        }
    }, [fetcher.state, fetcher.data, onDone])

    const buildAutoName = (item: WorksheetItem) => {
        return `Receita ${item.name}`
    }

    const handleSelectItem = (item: WorksheetItem) => {
        setSelectedItem(item)
        setItemComboOpen(false)
        setItemSearch("")
        const auto = buildAutoName(item)
        setName(auto)
        setNameAutoSet(true)
        setTimeout(() => nameRef.current?.focus(), 50)
    }

    const submit = () => {
        if (!name.trim()) return
        fetcher.submit(
            {
                _action: "recipe-create",
                recipeName: name.trim(),
                ...(selectedItem ? { recipeItemId: selectedItem.id } : {}),
            },
            { method: "post" }
        )
    }

    const filteredItems = filterItems(items, itemSearch).slice(0, 50)
    const errorMessage = fetcher.data && (fetcher.data as { status?: number }).status !== 200
        ? (fetcher.data as { message?: string }).message : null

    const nomeCalc = selectedItem ? selectedItem.name : null

    return (
        <tr className={cn("h-8 bg-green-50/20 border-t-2 border-green-200", isPending && "opacity-60")}>
            {/* # */}
            <td className={cn(CELL, "bg-green-50/30 text-center")}>
                <Plus size={11} className="text-green-500 mx-auto" />
            </td>
            {flatView && <td className={CELL} />}

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

            <td className={CELL} />

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
                <div className="flex items-center justify-center gap-1">
                    <Button type="button" variant="outline" size="icon"
                        onClick={submit} disabled={!name.trim() || isPending}
                        title="Criar (Enter)"
                        className="h-7 w-7 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300">
                        <Check size={14} />
                    </Button>
                    <Button type="button" variant="outline" size="icon"
                        onClick={onDone} title="Cancelar (Esc)"
                        className="h-7 w-7 text-slate-400 border-slate-200 hover:text-slate-600">
                        <X size={14} />
                    </Button>
                </div>
            </td>
        </tr>
    )
}

// ─── Flat Table Body ──────────────────────────────────────────────────────────

function FlatTableBody({ recipes, items, unitOptions }: {
    recipes: WorksheetRecipe[]
    items: WorksheetItem[]
    unitOptions: string[]
}) {
    const [addingForRecipeId, setAddingForRecipeId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    let globalRowIndex = 0

    return (
        <tbody>
            {recipes.length === 0 && !isCreating && (
                <tr>
                    <td colSpan={7} className="border border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                        Nenhuma receita encontrada.
                    </td>
                </tr>
            )}

            {recipes.map((recipe, recipeIdx) => {
                const lines = recipe.RecipeLine
                const isAdding = addingForRecipeId === recipe.id

                return (
                    <Fragment key={recipe.id}>
                        {/* No ingredients — placeholder row */}
                        {lines.length === 0 ? (
                            <tr className={cn("h-8 bg-slate-50/30", recipeIdx > 0 && "border-t-2 border-slate-200")}>
                                <td className={cn(CELL, "text-center text-xs text-slate-300 bg-slate-50/30")}>—</td>
                                <td className={cn(CELL, "px-2")}>
                                    <Link
                                        to={`/admin/recipes/${recipe.id}`}
                                        className="text-xs font-semibold text-slate-700 hover:text-blue-600 hover:underline truncate block"
                                        title={recipe.name}
                                    >
                                        {recipe.name}
                                    </Link>
                                </td>
                                <td colSpan={5} className={cn(CELL, "px-2")}>
                                    <span className="text-xs text-slate-400 italic">Sem ingredientes</span>
                                </td>
                            </tr>
                        ) : (
                            lines.map((line, lineIdx) => {
                                const rowNum = ++globalRowIndex
                                return (
                                    <RecipeLineRow
                                        key={line.id}
                                        line={line}
                                        recipeId={recipe.id}
                                        linkedVariations={recipe.linkedVariations || []}
                                        unitOptions={unitOptions}
                                        items={items}
                                        rowNumber={rowNum}
                                        flatRecipe={lineIdx === 0 ? { id: recipe.id, name: recipe.name } : null}
                                    />
                                )
                            })
                        )}

                        {/* Adding row */}
                        {isAdding && (
                            <AddingRow
                                recipeId={recipe.id}
                                items={items}
                                unitOptions={unitOptions}
                                onDone={() => setAddingForRecipeId(null)}
                                rowNumber={globalRowIndex + 1}
                                flatView
                            />
                        )}

                        {/* Add ingredient trigger */}
                        {!isAdding && (
                            <tr className="h-7">
                                <td className={CELL} />
                                <td colSpan={6} className={cn(CELL, "px-1")}>
                                    <Button type="button" variant="ghost" size="sm"
                                        onClick={() => setAddingForRecipeId(recipe.id)}
                                        className="h-6 px-2 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 gap-1.5">
                                        <Plus size={12} />
                                        Adicionar ingrediente
                                    </Button>
                                </td>
                            </tr>
                        )}
                    </Fragment>
                )
            })}

            {/* Create new recipe */}
            {isCreating ? (
                <CreatingRecipeRow
                    items={items}
                    onDone={() => setIsCreating(false)}
                    flatView
                />
            ) : (
                <tr className="h-7 bg-slate-50/60">
                    <td className={CELL} />
                    <td colSpan={6} className="border border-slate-200 p-3">
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="h-7 px-2 text-sm font-medium gap-1.5">
                            <Plus size={12} />
                            Nova Receita
                        </Button>
                    </td>
                </tr>
            )}
        </tbody>
    )
}
