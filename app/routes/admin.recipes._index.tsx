import { Recipe } from "@prisma/client"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, Form, useActionData, Link, useSubmit } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { toast } from "~/components/ui/use-toast"
import RecipeBadge from "~/domain/recipe/components/recipe-badge/recipe-badge"
import { recipeEntity } from "~/domain/recipe/recipe.entity.server"
import { Search, Check, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react"

import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import prismaClient from "~/lib/prisma/client.server"
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "~/components/ui/pagination"
import { listRecipeCompositionLines } from "~/domain/recipe/recipe-composition.server"

type RecipeWithMeta = Recipe & {
    Item: { name: string } | null
    RecipeLine: { lastTotalCostAmount: number }[]
}
type FilterItem = { id: string; name: string; classification: string | null; consumptionUm: string | null }

const PAGE_SIZE = 20

function parsePage(raw: string | null) {
    const parsed = Number(raw || "1")
    if (!Number.isFinite(parsed)) return 1
    return Math.max(1, Math.floor(parsed))
}

function buildPageHref(params: {
    q: string
    itemId: string
    page: number
}) {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set("q", params.q)
    if (params.itemId) searchParams.set("itemId", params.itemId)
    searchParams.set("page", String(params.page))
    return `/admin/recipes?${searchParams.toString()}`
}


export async function loader({ request }: LoaderFunctionArgs) {
    const db = prismaClient as any

    const url = new URL(request.url)
    const q = String(url.searchParams.get("q") || "").trim()
    const itemId = String(url.searchParams.get("itemId") || "").trim()
    const requestedPage = parsePage(url.searchParams.get("page"))

    const where: any = {}
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }]
    if (itemId) where.itemId = itemId

    const [countErr, totalItemsRaw] = await tryit(db.recipe.count({ where }))

    if (countErr) {
        return serverError(countErr)
    }

    const totalItems = Number(totalItemsRaw ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
    const page = Math.min(requestedPage, totalPages)

    const [err, result] = await tryit(Promise.all([
        db.item.findMany({
            where: { active: true },
            select: { id: true, name: true, classification: true, consumptionUm: true },
            orderBy: [{ name: "asc" }],
            take: 500,
        }),
        db.recipe.findMany({
            where,
            include: {
                Item: {
                    select: { name: true },
                },
            },
            orderBy: [{ name: "asc" }],
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
    ]))

    if (err) {
        return serverError(err)
    }

    const [items, recipesRaw] = result
    const recipes: RecipeWithMeta[] = await Promise.all(
        (recipesRaw || []).map(async (recipe: RecipeWithMeta) => {
            const lines = await listRecipeCompositionLines(db, recipe.id)
            return {
                ...recipe,
                RecipeLine: lines.map((line) => ({ lastTotalCostAmount: Number(line.lastTotalCostAmount || 0) })),
            }
        })
    )

    return ok({
        recipes,
        items,
        filters: {
            q,
            itemId,
        },
        pagination: {
            page,
            pageSize: PAGE_SIZE,
            totalItems,
            totalPages,
        },
    })

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "recipe-delete") {

        const [err] = await tryit(recipeEntity.delete(values.id as string))

        if (err) {
            return serverError(err)
        }

        return ok({ message: "Receita deletada com sucesso" })
    }

    return null
}



export default function RecipesIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const recipes = loaderData?.payload.recipes as RecipeWithMeta[]
    const items = loaderData?.payload.items as FilterItem[]
    const filters = loaderData?.payload.filters as { q: string; itemId: string }
    const pagination = loaderData?.payload.pagination as { page: number; pageSize: number; totalItems: number; totalPages: number }
    const submit = useSubmit()
    const formRef = useRef<HTMLFormElement>(null)

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    const [searchTerm, setSearchTerm] = useState(filters?.q || "")
    const [filterItemId, setFilterItemId] = useState(filters?.itemId || "__all__")

    useEffect(() => {
        setSearchTerm(filters?.q || "")
        setFilterItemId(filters?.itemId || "__all__")
    }, [filters?.q, filters?.itemId])

    const triggerSubmit = (overrides?: { q?: string; itemId?: string }) => {
        if (!formRef.current) return
        const formData = new FormData(formRef.current)
        if (overrides?.q !== undefined) formData.set("q", overrides.q)
        if (overrides?.itemId !== undefined) formData.set("itemId", overrides.itemId === "__all__" ? "" : overrides.itemId)
        formData.set("page", "1")
        submit(formData, { method: "get", replace: true })
    }

    const itemFilterOptions: SearchableSelectOption[] = [
        { value: "__all__", label: "Todos os itens", searchText: "todos os itens" },
        ...items.map((item) => ({
            value: item.id,
            label: item.name,
            searchText: [item.name, item.classification || "", item.consumptionUm || ""].join(" ").trim(),
        })),
    ]

    const itemById = new Map(items.map((item) => [item.id, item]))

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex items-center gap-3 flex-wrap">
                <Form method="get" ref={formRef} className="flex items-center gap-3 flex-wrap">
                    <input type="hidden" name="page" value={pagination?.page || 1} />
                    <input type="hidden" name="itemId" value={filterItemId === "__all__" ? "" : filterItemId} />
                    <RecipesSearch
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = e.target.value
                            setSearchTerm(value)
                            triggerSubmit({ q: value })
                        }}
                    />
                    <SearchableSelect
                        value={filterItemId}
                        options={itemFilterOptions}
                        placeholder="Item vinculado"
                        searchPlaceholder="Buscar item..."
                        emptyText="Nenhum item encontrado."
                        triggerClassName="min-w-[220px] max-w-[280px]"
                        contentClassName="w-[420px] max-w-[calc(100vw-2rem)]"
                        onValueChange={(value) => {
                            setFilterItemId(value)
                            triggerSubmit({ itemId: value })
                        }}
                        renderOption={(option, selected) => {
                            if (option.value === "__all__") {
                                return (
                                    <>
                                        <Check size={14} className={selected ? "opacity-100 mr-2" : "opacity-0 mr-2"} />
                                        <span className="truncate">{option.label}</span>
                                    </>
                                )
                            }

                            const item = itemById.get(option.value)
                            return (
                                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                                    <div className="flex items-center min-w-0">
                                        <Check size={14} className={selected ? "opacity-100 mr-2 shrink-0" : "opacity-0 mr-2 shrink-0"} />
                                        <span className="truncate font-medium">{option.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {item?.classification && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                                                {item.classification}
                                            </span>
                                        )}
                                        {item?.consumptionUm && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-600 font-mono">
                                                {item.consumptionUm}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        }}
                    />
                </Form>
                <div className="flex-1" />
                <div className="space-y-0.5 text-right">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receitas</div>
                    <div className="text-2xl font-black text-slate-900 tabular-nums">{pagination?.totalItems || 0}</div>
                    <div className="text-xs text-slate-500">itens encontrados</div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
                <Table className="min-w-[760px]">
                    <TableHeader className="bg-slate-50/90">
                        <TableRow className="hover:bg-slate-50/90">
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Receita</TableHead>
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Item vinculado</TableHead>
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                            <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recipes.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                                    Nenhuma receita encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            recipes.map((recipe) => <RecipeRow item={recipe} key={recipe.id} />)
                        )}
                    </TableBody>
                </Table>
                <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-slate-500">0 of {pagination?.totalItems || 0} row(s) selected.</div>
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">Rows per page</span>
                            <button
                                type="button"
                                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                                aria-label={`Rows per page: ${pagination?.pageSize || PAGE_SIZE}`}
                            >
                                <span>{pagination?.pageSize || PAGE_SIZE}</span>
                                <ChevronLeft className="h-4 w-4 rotate-[-90deg] text-slate-400" />
                            </button>
                        </div>
                        <div className="text-xs font-semibold text-slate-900">
                            Page {pagination?.page || 1} of {pagination?.totalPages || 1}
                        </div>
                        <Pagination className="mx-0 w-auto justify-start">
                            <PaginationContent className="gap-1.5">
                                <PaginationItem>
                                    <PaginationLink
                                        href={
                                            pagination?.page > 1
                                                ? buildPageHref({
                                                    q: filters?.q || "",
                                                    itemId: filters?.itemId || "",
                                                    page: 1,
                                                })
                                                : "#"
                                        }
                                        className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination?.page <= 1 ? "pointer-events-none opacity-40" : ""
                                            }`}
                                        aria-label="Primeira pagina"
                                    >
                                        <ChevronsLeft className="h-4 w-4" />
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink
                                        href={
                                            pagination?.page > 1
                                                ? buildPageHref({
                                                    q: filters?.q || "",
                                                    itemId: filters?.itemId || "",
                                                    page: (pagination?.page || 1) - 1,
                                                })
                                                : "#"
                                        }
                                        className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination?.page <= 1 ? "pointer-events-none opacity-40" : ""
                                            }`}
                                        aria-label="Pagina anterior"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink
                                        href={
                                            pagination?.page < (pagination?.totalPages || 1)
                                                ? buildPageHref({
                                                    q: filters?.q || "",
                                                    itemId: filters?.itemId || "",
                                                    page: (pagination?.page || 1) + 1,
                                                })
                                                : "#"
                                        }
                                        className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination?.page >= (pagination?.totalPages || 1) ? "pointer-events-none opacity-40" : ""
                                            }`}
                                        aria-label="Proxima pagina"
                                    >
                                        <ChevronLeft className="h-4 w-4 rotate-180" />
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink
                                        href={
                                            pagination?.page < (pagination?.totalPages || 1)
                                                ? buildPageHref({
                                                    q: filters?.q || "",
                                                    itemId: filters?.itemId || "",
                                                    page: pagination?.totalPages || 1,
                                                })
                                                : "#"
                                        }
                                        className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${pagination?.page >= (pagination?.totalPages || 1) ? "pointer-events-none opacity-40" : ""
                                            }`}
                                        aria-label="Ultima pagina"
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </PaginationLink>
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface RecipeItemProps {
    item: RecipeWithMeta
}

function RecipeRow({ item }: RecipeItemProps) {
    const hasZeroCost = item.RecipeLine?.some(l => Number(l.lastTotalCostAmount) <= 0)

    return (
        <TableRow className="border-slate-100 hover:bg-slate-50/50">
            <TableCell className="px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Link to={`/admin/recipes/${item.id}`} className="truncate font-semibold text-slate-900 hover:underline" title={item.name}>
                        {item.name}
                    </Link>
                    <span className="text-xs text-slate-500">ID: {item.id}</span>
                </div>
            </TableCell>
            <TableCell className="px-4 py-3">
                <div className="min-w-0">
                    {item.Item ? (
                        <span className="truncate text-sm text-slate-700" title={item.Item.name}>
                            {item.Item.name}
                        </span>
                    ) : (
                        <span className="text-sm text-slate-400">Sem item vinculado</span>
                    )}
                </div>
            </TableCell>
            <TableCell className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <RecipeBadge item={item} />
                    {hasZeroCost && (
                        <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50 shrink-0"
                            title="Ingredientes com custo total zero"
                        >
                            CUSTO 0
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                    <EditItemButton to={`/admin/recipes/${item.id}`} />
                    <Form method="post">
                        <Input type="hidden" name="id" value={item.id} />
                        <DeleteItemButton actionName="recipe-delete" />
                    </Form>
                </div>
            </TableCell>
        </TableRow>
    )
}




/**
function RecipesFilters() {

    const recipeTypes = RecipeEntity.findAllRecipeTypes()

    return (
    <div className="flex gap-4 items-center">
                        <span className="text-sm">Filtrar por:</span>
                        <ul className="flex gap-2 flex-wrap">
            <li key={"all"}>
                <Link to={`/admin/recipes?type=all`}>
                    <span className="border px-4 py-1 rounded-full text-xs text-gray-800 font-semibold tracking-wide max-w-max">Todos</span>
                </Link>
            </li>
            {
                recipeTypes.map((type) => {
                    return (
                        <li key={type.value}>
                            <Link to={`/admin/recipes?type=${type.value}`}
                                className={cn("text-sm")}>
                                <RecipeTypeBadge type={type.value} />
                            </Link>
                        </li>
                    )
                })
            }
        </ul >
                    </div >


    )

}

 */

function RecipesSearch({ ...props }: React.ComponentProps<typeof Input>) {
    return (
        <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input type="text" name="q" placeholder="Buscar receita..." className="w-full pl-9" {...props} />
        </div>
    )
}
