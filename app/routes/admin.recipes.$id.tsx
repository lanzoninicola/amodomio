import { Recipe, RecipeType } from "@prisma/client";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { ChevronLeft, ChevronsUpDown, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import type { HttpResponse } from "~/utils/http-response.server";
import { badRequest, ok } from "~/utils/http-response.server";

type RecipeVariationPolicy = "auto" | "hide" | "show"

type ItemVariationRuleRow = {
    id: string
    itemId: string
    createdAt?: Date | string | null
    Variation?: { id: string; kind?: string | null; code?: string | null } | null
    ItemCostVariation?: { costAmount?: number | null; deletedAt?: Date | null } | null
}

type ItemRecipeVariationRule = {
    policy: RecipeVariationPolicy
    availableVariationCount: number
    costedVariationCount: number
    hasDistinctVariationCosts: boolean
    shouldShowVariation: boolean
    defaultVariationId: string | null
}

const RECIPE_LINE_UNIT_FALLBACK_OPTIONS = ["UN", "L", "ML", "KG", "G"]

function normalizeRecipeVariationPolicy(value: unknown): RecipeVariationPolicy {
    const normalized = String(value || "auto").trim().toLowerCase()
    if (normalized === "hide" || normalized === "show" || normalized === "auto") return normalized
    return "auto"
}

function buildItemRecipeVariationRule(rows: ItemVariationRuleRow[], policyRaw?: unknown): ItemRecipeVariationRule {
    const policy = normalizeRecipeVariationPolicy(policyRaw)
    const availableRows = [...rows]
    const costedRows = availableRows.filter((row) => row.ItemCostVariation && !row.ItemCostVariation.deletedAt)
    const distinctCosts = new Set(
        costedRows.map((row) => Math.round(Number(row.ItemCostVariation?.costAmount || 0) * 100))
    )
    const hasDistinctVariationCosts = distinctCosts.size > 1

    const baseRow =
        availableRows.find((row) =>
            row.Variation?.kind === "base" && String(row.Variation?.code || "").toLowerCase() === "base"
        ) || null

    const defaultRow = baseRow || costedRows[0] || availableRows[0] || null

    const shouldShowVariation =
        policy === "show"
            ? true
            : policy === "hide"
                ? false
                : costedRows.length > 1 && hasDistinctVariationCosts

    return {
        policy,
        availableVariationCount: availableRows.length,
        costedVariationCount: costedRows.length,
        hasDistinctVariationCosts,
        shouldShowVariation,
        defaultVariationId: defaultRow?.Variation?.id || null,
    }
}

async function getItemRecipeVariationRule(db: any, itemId: string): Promise<ItemRecipeVariationRule> {
    let item: { id: string; recipeVariationPolicy?: string | null } | null = null
    try {
        item = await db.item.findUnique({
            where: { id: itemId },
            select: { id: true, recipeVariationPolicy: true },
        })
    } catch (_error) {
        item = await db.item.findUnique({
            where: { id: itemId },
            select: { id: true },
        })
    }

    const rows = await db.itemVariation.findMany({
        where: { itemId, deletedAt: null },
        select: {
            id: true,
            itemId: true,
            createdAt: true,
            Variation: { select: { id: true, kind: true, code: true } },
            ItemCostVariation: { select: { costAmount: true, deletedAt: true } },
        },
        orderBy: [{ createdAt: "asc" }],
    })

    return buildItemRecipeVariationRule(rows, item?.recipeVariationPolicy)
}

async function getRecipeLineUnitOptions(db: any) {
    const measurementUnitModel = db.measurementUnit
    if (typeof measurementUnitModel?.findMany !== "function") {
        return [...RECIPE_LINE_UNIT_FALLBACK_OPTIONS].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }

    try {
        const rows = await measurementUnitModel.findMany({
            where: { active: true },
            select: { code: true },
            orderBy: [{ code: "asc" }],
        })
        const merged = new Set<string>(RECIPE_LINE_UNIT_FALLBACK_OPTIONS)
        for (const row of rows || []) {
            const code = String(row?.code || "").trim().toUpperCase()
            if (code) merged.add(code)
        }
        return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"))
    } catch (_error) {
        return [...RECIPE_LINE_UNIT_FALLBACK_OPTIONS].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }
}

async function resolveRecipeLineCosts(
    db: any,
    itemId: string,
    variationId?: string | null
) {
    if (!itemId) {
        return { itemVariationId: null, lastUnitCostAmount: 0, avgUnitCostAmount: 0 }
    }

    let itemVariation: any = null

    if (variationId) {
        itemVariation = await itemVariationPrismaEntity.linkToItem({ itemId, variationId })
    } else {
        itemVariation = await db.itemVariation.findFirst({
            where: {
                itemId,
                deletedAt: null,
                Variation: { kind: "base", code: "base" },
            },
            include: { ItemCostVariation: true },
            orderBy: [{ createdAt: "asc" }],
        })

        if (!itemVariation) {
            itemVariation = await db.itemVariation.findFirst({
                where: { itemId, deletedAt: null },
                include: { ItemCostVariation: true },
                orderBy: [{ createdAt: "asc" }],
            })
        }
    }

    const itemVariationId = itemVariation?.id || null
    const lastUnitCostAmount = Number(itemVariation?.ItemCostVariation?.costAmount || 0)

    let avgUnitCostAmount = lastUnitCostAmount
    if (itemVariationId) {
        const historyRows = await db.itemCostVariationHistory.findMany({
            where: { itemVariationId },
            select: { costAmount: true },
            orderBy: [{ createdAt: "desc" }],
            take: 20,
        })
        if (historyRows.length > 0) {
            const sum = historyRows.reduce((acc: number, row: any) => acc + Number(row.costAmount || 0), 0)
            avgUnitCostAmount = sum / historyRows.length
        }
    }

    return { itemVariationId, lastUnitCostAmount, avgUnitCostAmount }
}

function buildRecipeLineCostSnapshot(costInfo: { itemVariationId: string | null; lastUnitCostAmount: number; avgUnitCostAmount: number }, quantity: number) {
    return {
        itemVariationId: costInfo.itemVariationId,
        lastUnitCostAmount: Number(costInfo.lastUnitCostAmount || 0),
        avgUnitCostAmount: Number(costInfo.avgUnitCostAmount || 0),
        lastTotalCostAmount: Number(((costInfo.lastUnitCostAmount || 0) * quantity).toFixed(6)),
        avgTotalCostAmount: Number(((costInfo.avgUnitCostAmount || 0) * quantity).toFixed(6)),
    }
}

export async function loader({ params }: LoaderFunctionArgs) {
    const recipeId = params?.id

    if (!recipeId) {
        return null
    }

    const recipe = await recipeEntity.findById(recipeId)

    if (!recipe) {
        return badRequest({ message: "Receita não encontrado" })
    }

    try {
        const db = prismaClient as any
        const itemsPromise = (async () => {
            try {
                return await db.item.findMany({
                    where: { active: true },
                    select: { id: true, name: true, classification: true, consumptionUm: true, recipeVariationPolicy: true },
                    orderBy: [{ name: "asc" }],
                    take: 500,
                })
            } catch (_error) {
                return await db.item.findMany({
                    where: { active: true },
                    select: { id: true, name: true, classification: true, consumptionUm: true },
                    orderBy: [{ name: "asc" }],
                    take: 500,
                })
            }
        })()

        const [itemsRaw, variations, recipeLines, unitOptions] = await Promise.all([
            itemsPromise,
            db.variation.findMany({
                where: { deletedAt: null },
                select: { id: true, name: true, kind: true },
                orderBy: [{ kind: "asc" }, { name: "asc" }],
                take: 200,
            }),
            typeof db.recipeLine?.findMany === "function"
                ? db.recipeLine.findMany({
                    where: { recipeId },
                    include: {
                        Item: { select: { id: true, name: true } },
                        ItemVariation: { include: { Variation: true } },
                    },
                    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
                })
                : [],
            getRecipeLineUnitOptions(db),
        ])

        const itemIds = (itemsRaw || []).map((item: any) => item.id).filter(Boolean)
        const itemVariationRows = itemIds.length > 0
            ? await db.itemVariation.findMany({
                where: { itemId: { in: itemIds }, deletedAt: null },
                select: {
                    id: true,
                    itemId: true,
                    createdAt: true,
                    Variation: { select: { id: true, kind: true, code: true } },
                    ItemCostVariation: { select: { costAmount: true, deletedAt: true } },
                },
                orderBy: [{ itemId: "asc" }, { createdAt: "asc" }],
            })
            : []

        const rowsByItemId = new Map<string, ItemVariationRuleRow[]>()
        for (const row of itemVariationRows as ItemVariationRuleRow[]) {
            const list = rowsByItemId.get(row.itemId) || []
            list.push(row)
            rowsByItemId.set(row.itemId, list)
        }

        const items = (itemsRaw || []).map((item: any) => ({
            ...item,
            recipeVariationPolicy: normalizeRecipeVariationPolicy(item.recipeVariationPolicy),
            recipeVariationRule: buildItemRecipeVariationRule(rowsByItemId.get(item.id) || [], item.recipeVariationPolicy),
        }))

        return ok({
            recipe,
            items,
            variations,
            recipeLines,
            unitOptions,
        })
    } catch (error) {
        return badRequest((error as Error)?.message || "Erro ao carregar catálogos")
    }

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "recipe-line-add") {
        const recipeId = String(values.recipeId || "").trim()
        const itemId = String(values.lineItemId || "").trim()
        const requestedVariationId = String(values.lineVariationId || "").trim() || null
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        const quantity = Number(String(values.lineQuantity || "0").replace(",", "."))

        if (!recipeId) return badRequest("Receita inválida")
        if (!itemId) return badRequest("Selecione o item da composição")
        if (!unit) return badRequest("Informe a unidade de consumo")
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Informe uma quantidade válida")

        try {
            const db = prismaClient as any
            if (typeof db.recipeLine?.create !== "function") {
                return badRequest("Tabela de composição da receita indisponível. Rode a migração Prisma.")
            }

            const itemVariationRule = await getItemRecipeVariationRule(db, itemId)
            const variationId = itemVariationRule.shouldShowVariation ? requestedVariationId : null

            const [recipeLineCount, costInfo] = await Promise.all([
                db.recipeLine.count({ where: { recipeId } }),
                resolveRecipeLineCosts(db, itemId, variationId),
            ])

            await db.recipeLine.create({
                data: {
                    recipeId,
                    itemId,
                    itemVariationId: costInfo.itemVariationId,
                    unit,
                    quantity,
                    lastUnitCostAmount: costInfo.lastUnitCostAmount,
                    avgUnitCostAmount: costInfo.avgUnitCostAmount,
                    lastTotalCostAmount: Number((costInfo.lastUnitCostAmount * quantity).toFixed(6)),
                    avgTotalCostAmount: Number((costInfo.avgUnitCostAmount * quantity).toFixed(6)),
                    sortOrderIndex: Number(recipeLineCount || 0),
                }
            })

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao adicionar item da composição")
        }
    }

    if (_action === "recipe-line-delete") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        if (!recipeId || !recipeLineId) return badRequest("Linha inválida")

        try {
            const db = prismaClient as any
            if (typeof db.recipeLine?.delete !== "function") {
                return badRequest("Tabela de composição da receita indisponível. Rode a migração Prisma.")
            }
            await db.recipeLine.delete({ where: { id: recipeLineId } })
            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao remover item da composição")
        }
    }

    if (_action === "recipe-line-update") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        const quantity = Number(String(values.lineQuantity || "0").replace(",", "."))

        if (!recipeId || !recipeLineId) return badRequest("Linha inválida")
        if (!unit) return badRequest("Informe a unidade de consumo")
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Informe uma quantidade válida")

        try {
            const db = prismaClient as any
            if (typeof db.recipeLine?.findUnique !== "function" || typeof db.recipeLine?.update !== "function") {
                return badRequest("Tabela de composição da receita indisponível. Rode a migração Prisma.")
            }

            const line = await db.recipeLine.findUnique({
                where: { id: recipeLineId },
                select: { id: true, recipeId: true, itemId: true, itemVariationId: true },
            })

            if (!line || line.recipeId !== recipeId) {
                return badRequest("Linha da receita não encontrada")
            }

            const variationId =
                line.itemVariationId
                    ? (await db.itemVariation.findUnique({
                        where: { id: line.itemVariationId },
                        select: { variationId: true },
                    }))?.variationId || null
                    : null

            const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId)
            const snapshot = buildRecipeLineCostSnapshot(costInfo, quantity)

            await db.recipeLine.update({
                where: { id: recipeLineId },
                data: {
                    unit,
                    quantity,
                    itemVariationId: snapshot.itemVariationId,
                    lastUnitCostAmount: snapshot.lastUnitCostAmount,
                    avgUnitCostAmount: snapshot.avgUnitCostAmount,
                    lastTotalCostAmount: snapshot.lastTotalCostAmount,
                    avgTotalCostAmount: snapshot.avgTotalCostAmount,
                }
            })

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao atualizar item da composição")
        }
    }

    if (_action === "recipe-lines-recalc") {
        const recipeId = String(values.recipeId || "").trim()
        if (!recipeId) return badRequest("Receita inválida")

        try {
            const db = prismaClient as any
            if (typeof db.recipeLine?.findMany !== "function" || typeof db.recipeLine?.update !== "function") {
                return badRequest("Tabela de composição da receita indisponível. Rode a migração Prisma.")
            }

            const lines = await db.recipeLine.findMany({
                where: { recipeId },
                orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
            })

            for (const line of lines) {
                const variationId =
                    line.itemVariationId
                        ? (await db.itemVariation.findUnique({
                            where: { id: line.itemVariationId },
                            select: { variationId: true },
                        }))?.variationId || null
                        : null

                const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId)
                const snapshot = buildRecipeLineCostSnapshot(costInfo, Number(line.quantity || 0))

                await db.recipeLine.update({
                    where: { id: line.id },
                    data: snapshot,
                })
            }

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao recalcular custos da composição")
        }
    }

    if (_action === "recipe-duplicate-variation") {
        const sourceRecipeId = String(values.recipeId || "").trim()
        const targetVariationId = String(values.duplicateVariationId || "").trim()
        const factorMode = String(values.duplicateFactorMode || "multiply").trim()
        const factorValue = Number(String(values.duplicateFactorValue || "1").replace(",", "."))

        if (!sourceRecipeId) return badRequest("Receita inválida")
        if (!targetVariationId) return badRequest("Selecione a variação de destino")
        if (!Number.isFinite(factorValue) || factorValue <= 0) return badRequest("Informe um fator válido")

        try {
            const db = prismaClient as any
            if (typeof db.recipeLine?.findMany !== "function" || typeof db.recipeLine?.create !== "function") {
                return badRequest("Tabela de composição da receita indisponível. Rode a migração Prisma.")
            }

            const sourceRecipe = await db.recipe.findUnique({
                where: { id: sourceRecipeId },
            })
            if (!sourceRecipe) return badRequest("Receita origem não encontrada")

            const targetVariation = await db.variation.findUnique({
                where: { id: targetVariationId },
                select: { id: true, name: true, kind: true, deletedAt: true },
            })
            if (!targetVariation || targetVariation.deletedAt) return badRequest("Variação de destino inválida")

            const factor = factorMode === "divide" ? (1 / factorValue) : factorValue

            const sourceLines = await db.recipeLine.findMany({
                where: { recipeId: sourceRecipeId },
                orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
            })

            const duplicatedRecipe = await db.recipe.create({
                data: {
                    name: `${sourceRecipe.name} (${targetVariation.name})`,
                    description: sourceRecipe.description,
                    type: sourceRecipe.type,
                    hasVariations: false,
                    isGlutenFree: sourceRecipe.isGlutenFree,
                    isVegetarian: sourceRecipe.isVegetarian,
                    createdAt: new Date(),
                    itemId: sourceRecipe.itemId,
                    variationId: targetVariation.id,
                }
            })

            for (const line of sourceLines) {
                const sourceLineVariationId =
                    line.itemVariationId
                        ? (await db.itemVariation.findUnique({
                            where: { id: line.itemVariationId },
                            select: { variationId: true },
                        }))?.variationId || null
                        : null

                const nextQuantity = Number((Number(line.quantity || 0) * factor).toFixed(6))
                const costInfo = await resolveRecipeLineCosts(db, line.itemId, sourceLineVariationId)
                const snapshot = buildRecipeLineCostSnapshot(costInfo, nextQuantity)

                await db.recipeLine.create({
                    data: {
                        recipeId: duplicatedRecipe.id,
                        itemId: line.itemId,
                        itemVariationId: snapshot.itemVariationId,
                        unit: line.unit,
                        quantity: nextQuantity,
                        lastUnitCostAmount: snapshot.lastUnitCostAmount,
                        avgUnitCostAmount: snapshot.avgUnitCostAmount,
                        lastTotalCostAmount: snapshot.lastTotalCostAmount,
                        avgTotalCostAmount: snapshot.avgTotalCostAmount,
                        sortOrderIndex: line.sortOrderIndex,
                        notes: line.notes || null,
                    }
                })
            }

            return redirect(`/admin/recipes/${duplicatedRecipe.id}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao duplicar receita para outra variação")
        }
    }

    if (_action === "recipe-update") {
        const recipe = await recipeEntity.findById(values?.recipeId as string)

        const nextRecipe = {
            ...recipe,
            name: values.name as string,
            type: values.type as RecipeType,
            description: values?.description as string || "",
            hasVariations: false,
            isGlutenFree: values.isGlutenFree === "on" ? true : false,
            isVegetarian: values.isVegetarian === "on" ? true : false,
        }
        delete nextRecipe.id

        const [err] = await prismaIt(recipeEntity.update(values.recipeId as string, {
            ...recipe,
            ...nextRecipe
        }))

        if (err) {
            return badRequest(err)
        }

        try {
            const db = prismaClient as any
            const explicitItemId = String(values.linkedItemId || "").trim()
            const updatedRecipe = await db.recipe.findUnique({
                where: { id: values.recipeId as string },
                select: { id: true, itemId: true, name: true, description: true, type: true }
            })

            if (updatedRecipe) {
                let itemId = updatedRecipe.itemId as string | null

                if (explicitItemId && explicitItemId !== itemId) {
                    const explicitItem = await db.item.findUnique({ where: { id: explicitItemId } })
                    if (explicitItem) {
                        itemId = explicitItem.id
                        await db.recipe.update({
                            where: { id: updatedRecipe.id },
                            data: {
                                itemId,
                                variationId: String(values.linkedVariationId || "").trim() || null,
                            }
                        })
                    }
                }

                if (!itemId) {
                    let item = await db.item.findFirst({
                        where: { name: updatedRecipe.name },
                        orderBy: { updatedAt: "desc" }
                    })

                    if (!item) {
                        const isSemiFinished = updatedRecipe.type === "semiFinished"
                        item = await db.item.create({
                            data: {
                                name: updatedRecipe.name,
                                description: updatedRecipe.description || null,
                                classification: isSemiFinished ? "semi_acabado" : "produto_final",
                                active: true,
                                canPurchase: false,
                                canTransform: true,
                                canSell: !isSemiFinished,
                                canStock: true,
                                canBeInMenu: false,
                            }
                        })
                    }

                    itemId = item.id

                    await db.recipe.update({
                        where: { id: updatedRecipe.id },
                        data: {
                            itemId,
                            variationId: String(values.linkedVariationId || "").trim() || null,
                        }
                    })
                }

                if (itemId) {
                    await db.recipe.update({
                        where: { id: updatedRecipe.id },
                        data: { variationId: String(values.linkedVariationId || "").trim() || null }
                    })
                }

            }
        } catch (_error) {
            // best effort: preserve legacy behavior when migrations are pending
        }

        return redirect(`/admin/recipes/${values.recipeId}`)
    }

    return null
}


export default function SingleRecipe() {
    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()
    const location = useLocation()

    const recipe = loaderData?.payload?.recipe as Recipe
    const items = (loaderData?.payload?.items || []) as Array<{
        id: string
        name: string
        classification?: string | null
        consumptionUm?: string | null
        recipeVariationPolicy?: RecipeVariationPolicy
        recipeVariationRule?: ItemRecipeVariationRule
    }>
    const variations = (loaderData?.payload?.variations || []) as Array<{ id: string; name: string; kind?: string | null }>
    const recipeLines = (loaderData?.payload?.recipeLines || []) as any[]
    const unitOptions = (loaderData?.payload?.unitOptions || RECIPE_LINE_UNIT_FALLBACK_OPTIONS) as string[]
    const actionData = useActionData<typeof action>()
    const linkedItem = items.find((item) => item.id === recipe?.itemId)
    const linkedVariation = variations.find((variation) => variation.id === (recipe as any)?.variationId)
    const recipeLineCount = recipeLines.length
    const avgCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.avgTotalCostAmount || 0), 0)
    const lastCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.lastTotalCostAmount || 0), 0)
    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
    const [lineItemId, setLineItemId] = useState("")
    const [lineItemComboboxOpen, setLineItemComboboxOpen] = useState(false)
    const [lineVariationId, setLineVariationId] = useState("__none__")
    const [lineUnit, setLineUnit] = useState("")
    const [duplicateVariationId, setDuplicateVariationId] = useState("")
    const [duplicateFactorMode, setDuplicateFactorMode] = useState("multiply")
    const selectedLineItem = items.find((item) => item.id === lineItemId) || null
    const selectedLineItemLabel =
        selectedLineItem
            ? `${selectedLineItem.name}${selectedLineItem.classification ? ` (${selectedLineItem.classification})` : ""}`
            : "Selecionar item"
    const selectedLineItemVariationRule = selectedLineItem?.recipeVariationRule || null
    const shouldShowLineVariation = !!selectedLineItemVariationRule?.shouldShowVariation

    useEffect(() => {
        if (!shouldShowLineVariation && lineVariationId !== "__none__") {
            setLineVariationId("__none__")
        }
    }, [shouldShowLineVariation, lineVariationId])

    useEffect(() => {
        const itemUm = String(selectedLineItem?.consumptionUm || "").trim().toUpperCase()
        if (!itemUm) return
        setLineUnit((current) => (current === itemUm ? current : itemUm))
    }, [selectedLineItem?.id, selectedLineItem?.consumptionUm])

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (location.pathname.endsWith("/composition-builder")) {
        return <Outlet />
    }

    return (
        <div className="divide-y divide-slate-200">

            {/* ── Cabeçalho da página ── */}
            <div className="pb-6">
                <Link to="/admin/recipes" className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700">
                    <ChevronLeft size={13} />
                    Receitas
                </Link>
                <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-bold leading-tight text-slate-900">{recipe?.name}</h1>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                                recipe?.type === "pizzaTopping"
                                    ? "bg-orange-50 text-orange-700 ring-orange-200"
                                    : "bg-blue-50 text-blue-700 ring-blue-200"
                            }`}>
                                {recipe?.type === "pizzaTopping" ? "Sabor Pizza" : "Produzido"}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span>
                                <span className="text-slate-400">Item:</span>{" "}
                                <span className="font-medium text-slate-700">{linkedItem?.name || <span className="italic">Não vinculado</span>}</span>
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>
                                <span className="text-slate-400">Variação:</span>{" "}
                                <span className="font-medium text-slate-700">
                                    {linkedVariation ? `${linkedVariation.name}${linkedVariation.kind ? ` (${linkedVariation.kind})` : ""}` : "Base"}
                                </span>
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-6">
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Itens</p>
                            <p className="mt-0.5 text-2xl font-bold text-slate-900">{recipeLineCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Custo médio</p>
                            <p className="mt-0.5 text-2xl font-bold text-slate-900">R$ {avgCompositionCost.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último custo</p>
                            <p className="mt-0.5 text-2xl font-bold text-slate-900">R$ {lastCompositionCost.toFixed(2)}</p>
                        </div>
                        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="outline" size="sm">
                                    Duplicar variação
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Duplicar receita para outra variação</DialogTitle>
                                    <DialogDescription>
                                        Cria uma nova receita copiando a composição e ajustando as quantidades por fator.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form method="post" className="grid gap-4 md:grid-cols-4">
                                    <input type="hidden" name="recipeId" value={recipe?.id} />
                                    <input type="hidden" name="duplicateVariationId" value={duplicateVariationId} />
                                    <input type="hidden" name="duplicateFactorMode" value={duplicateFactorMode} />
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variação destino</label>
                                        <Select value={duplicateVariationId} onValueChange={setDuplicateVariationId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecionar variação" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {variations.map((variation) => (
                                                    <SelectItem key={variation.id} value={variation.id}>
                                                        {variation.name}{variation.kind ? ` (${variation.kind})` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Operação</label>
                                        <Select value={duplicateFactorMode} onValueChange={setDuplicateFactorMode}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="multiply">Multiplica (×)</SelectItem>
                                                <SelectItem value="divide">Divide (÷)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label htmlFor="duplicateFactorValue" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fator</label>
                                        <input id="duplicateFactorValue" name="duplicateFactorValue" type="number" min="0.0001" step="0.0001" defaultValue="1" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                                    </div>
                                    <div className="md:col-span-4 flex justify-end gap-2">
                                        <Button type="button" variant="ghost" onClick={() => setDuplicateDialogOpen(false)}>
                                            Cancelar
                                        </Button>
                                        <Button type="submit" name="_action" value="recipe-duplicate-variation">
                                            Duplicar receita
                                        </Button>
                                    </div>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* ── Configuração ── */}
            <div className="py-6">
                <h2 className="text-base font-semibold text-slate-900">Configuração da receita</h2>
                <p className="mt-0.5 mb-4 text-sm text-slate-500">Atualize nome, vínculo com item/variação e atributos.</p>
                <RecipeForm
                    recipe={recipe}
                    actionName="recipe-update"
                    items={items}
                    variations={variations}
                />
            </div>

            {/* ── Composição ── */}
            <div className="py-6">
                <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold text-slate-900">Composição da receita</h2>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                        aria-label="Regra de variação na composição"
                                    >
                                        <HelpCircle className="h-4 w-4" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Regra de variação na composição</DialogTitle>
                                        <DialogDescription>
                                            Como o sistema decide quando pedir variação para um item da receita.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3 text-sm text-slate-700">
                                        <div>
                                            <p className="font-semibold text-slate-900">Regra prática</p>
                                            <p>
                                                A variação é opcional por padrão. O sistema só mostra o campo quando o item tem 2 ou mais variações com custo ativo e os custos são diferentes.
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">Resumo</p>
                                            <p>
                                                Insumos comuns (sal, temperos, molho) normalmente usam Base/auto. Itens com custo diferente por variação podem exigir seleção manual.
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">Override no item</p>
                                            <p>
                                                Na tela do item, use o campo "Variação na receita" para forçar: automático, ocultar ou sempre mostrar.
                                            </p>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">Ingredientes e materiais com unidade de consumo e quantidade.</p>
                    </div>
                    <Form method="post" className="shrink-0">
                        <div className="flex items-center gap-2">
                            <Button asChild type="button" variant="outline" size="sm">
                                <Link to={`/admin/recipes/${recipe?.id}/composition-builder`}>
                                    Montador rápido
                                </Link>
                            </Button>
                            <input type="hidden" name="recipeId" value={recipe?.id} />
                            <Button type="submit" name="_action" value="recipe-lines-recalc" variant="outline" size="sm">
                                Recalcular custos
                            </Button>
                        </div>
                    </Form>
                </div>

                {/* Adicionar item */}
                <div className="mb-6">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Adicionar item</h3>
                    <Form method="post" className="grid gap-3 md:grid-cols-5">
                        <input type="hidden" name="recipeId" value={recipe?.id} />
                        <input type="hidden" name="lineItemId" value={lineItemId} />
                        <input type="hidden" name="lineUnit" value={lineUnit} />
                        <input
                            type="hidden"
                            name="lineVariationId"
                            value={shouldShowLineVariation && lineVariationId !== "__none__" ? lineVariationId : ""}
                        />
                        <div className="md:col-span-2">
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Item</label>
                            <Popover open={lineItemComboboxOpen} onOpenChange={setLineItemComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={lineItemComboboxOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        <span className="truncate text-left">{selectedLineItemLabel}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] p-0"
                                    align="start"
                                    sideOffset={4}
                                >
                                    <Command>
                                        <CommandInput placeholder="Buscar item..." />
                                        <CommandList className="max-h-[50vh]">
                                            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                            {items.map((item) => (
                                                <CommandItem
                                                    key={item.id}
                                                    value={`${item.name} ${item.classification || ""} ${item.id}`}
                                                    onSelect={() => {
                                                        setLineItemId(item.id)
                                                        setLineItemComboboxOpen(false)
                                                    }}
                                                >
                                                    <span
                                                        className={cn(
                                                            "mr-2 inline-block h-2 w-2 rounded-full",
                                                            lineItemId === item.id ? "bg-slate-900" : "bg-transparent border border-slate-300"
                                                        )}
                                                    />
                                                    <span className="truncate">
                                                        {item.name}
                                                        {item.classification ? ` (${item.classification})` : ""}
                                                    </span>
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variação</label>
                            {shouldShowLineVariation ? (
                                <Select value={lineVariationId} onValueChange={setLineVariationId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Base/auto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Base/auto</SelectItem>
                                        {variations.map((variation) => (
                                            <SelectItem key={variation.id} value={variation.id}>
                                                {variation.name}{variation.kind ? ` (${variation.kind})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="flex h-10 items-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                                    Base/auto
                                </div>
                            )}
                            {selectedLineItem ? (
                                <p className="mt-1 text-xs text-slate-500">
                                    {shouldShowLineVariation
                                        ? "Este item tem múltiplas variações com custo diferente."
                                        : "Variação oculta: custo será resolvido automaticamente (base/auto)."}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label htmlFor="lineUnit" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">UM consumo</label>
                            <Select value={lineUnit || "__empty__"} onValueChange={(value) => setLineUnit(value === "__empty__" ? "" : value)}>
                                <SelectTrigger id="lineUnit">
                                    <SelectValue placeholder="Selecionar UM" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__empty__">Selecionar UM</SelectItem>
                                    {unitOptions.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                            {unit}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedLineItem?.consumptionUm ? (
                                <p className="mt-1 text-xs text-slate-500">
                                    UM sugerida do item: {String(selectedLineItem.consumptionUm).toUpperCase()}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label htmlFor="lineQuantity" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade</label>
                            <input id="lineQuantity" name="lineQuantity" type="number" min="0.0001" step="0.0001" placeholder="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                        </div>
                        <div className="md:col-span-5 flex justify-end">
                            <button
                                type="submit"
                                name="_action"
                                value="recipe-line-add"
                                className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                                Adicionar item
                            </button>
                        </div>
                    </Form>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Variação</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">UM / Quantidade</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Últ. custo un.</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Custo méd. un.</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Últ. total</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Méd. total</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipeLines.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                                        Nenhum item na composição. Use o formulário acima para adicionar.
                                    </td>
                                </tr>
                            ) : (
                                recipeLines.map((line) => (
                                    <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-3 py-2 font-medium text-slate-900">{line.Item?.name || "-"}</td>
                                        <td className="px-3 py-2 text-slate-500">{line.ItemVariation?.Variation?.name || "Base"}</td>
                                        <td className="px-3 py-2">
                                            <Form method="post" className="flex items-center gap-2">
                                                <input type="hidden" name="recipeId" value={recipe?.id} />
                                                <input type="hidden" name="recipeLineId" value={line.id} />
                                                <input
                                                    name="lineUnit"
                                                    defaultValue={line.unit}
                                                    className="h-8 w-20 rounded border border-slate-200 px-2 text-xs"
                                                    required
                                                />
                                                <input
                                                    name="lineQuantity"
                                                    type="number"
                                                    min="0.0001"
                                                    step="0.0001"
                                                    defaultValue={Number(line.quantity || 0)}
                                                    className="h-8 w-28 rounded border border-slate-200 px-2 text-xs text-right"
                                                    required
                                                />
                                                <button
                                                    type="submit"
                                                    name="_action"
                                                    value="recipe-line-update"
                                                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                >
                                                    Salvar
                                                </button>
                                            </Form>
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-500">R$ {Number(line.lastUnitCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right text-slate-500">R$ {Number(line.avgUnitCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-900">R$ {Number(line.lastTotalCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-900">R$ {Number(line.avgTotalCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <Form method="post" className="inline">
                                                <input type="hidden" name="recipeId" value={recipe?.id} />
                                                <input type="hidden" name="recipeLineId" value={line.id} />
                                                <button
                                                    type="submit"
                                                    name="_action"
                                                    value="recipe-line-delete"
                                                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Remover
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
