import { Recipe, RecipeType } from "@prisma/client";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronsUpDown, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { toast } from "~/components/ui/use-toast";
import { DecimalInput } from "~/components/inputs/inputs";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import {
    applyRecipeCompositionLineToVariations,
    createRecipeCompositionIngredientSkeleton,
    deleteRecipeCompositionLine,
    listRecipeLinkedVariations,
    listRecipeCompositionLines,
    updateRecipeCompositionIngredientDefaultLoss,
    updateRecipeCompositionLine,
} from "~/domain/recipe/recipe-composition.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import type { HttpResponse } from "~/utils/http-response.server";
import { badRequest, ok } from "~/utils/http-response.server";

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

function buildRecipeLineCostSnapshot(
    costInfo: { itemVariationId: string | null; lastUnitCostAmount: number; avgUnitCostAmount: number },
    quantity: number,
    lossPct: number = 0
) {
    const safeLossPct = Math.min(99.9999, Math.max(0, Number(lossPct || 0)))
    const grossQuantity = safeLossPct > 0
        ? Number((quantity / (1 - safeLossPct / 100)).toFixed(6))
        : Number(quantity || 0)
    return {
        itemVariationId: costInfo.itemVariationId,
        lastUnitCostAmount: Number(costInfo.lastUnitCostAmount || 0),
        avgUnitCostAmount: Number(costInfo.avgUnitCostAmount || 0),
        lastTotalCostAmount: Number(((costInfo.lastUnitCostAmount || 0) * grossQuantity).toFixed(6)),
        avgTotalCostAmount: Number(((costInfo.avgUnitCostAmount || 0) * grossQuantity).toFixed(6)),
    }
}

function parseLossPctInput(value: unknown): number | null {
    const normalized = String(value ?? "").trim()
    if (!normalized) return null
    const parsed = Number(normalized.replace(",", "."))
    if (!Number.isFinite(parsed)) return Number.NaN
    return parsed
}

function formatMoney(value: number, decimals: number = 2) {
    return `R$ ${formatDecimalPlaces(Number(value || 0), decimals)}`
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
        const items = await db.item.findMany({
            where: { active: true },
            select: { id: true, name: true, classification: true, consumptionUm: true },
            orderBy: [{ name: "asc" }],
            take: 500,
        })
        const recipeLines = await listRecipeCompositionLines(db, recipeId)
        const linkedVariations = await listRecipeLinkedVariations(db, recipeId)

        return ok({
            recipe,
            items,
            recipeLines,
            linkedVariations,
        })
    } catch (error) {
        return badRequest((error as Error)?.message || "Erro ao carregar catálogos")
    }

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "recipe-ingredient-add") {
        const recipeId = String(values.recipeId || "").trim()
        const itemId = String(values.lineItemId || "").trim()

        if (!recipeId) return badRequest("Receita inválida")
        if (!itemId) return badRequest("Selecione um ingrediente")

        try {
            const db = prismaClient as any
            const item = await db.item.findUnique({
                where: { id: itemId },
                select: { consumptionUm: true },
            })
            const defaultUnit = String(item?.consumptionUm || "UN").trim().toUpperCase() || "UN"
            await createRecipeCompositionIngredientSkeleton({ db, recipeId, itemId, defaultUnit })

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao adicionar ingrediente")
        }
    }

    if (_action === "recipe-ingredient-batch-add") {
        const recipeId = String(values.recipeId || "").trim()
        const targetItemIdsRaw = String(values.targetItemIds || "").trim()
        const targetItemIds = targetItemIdsRaw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        if (!recipeId) return badRequest("Receita inválida")
        if (targetItemIds.length === 0) return badRequest("Selecione ao menos um ingrediente")

        try {
            const db = prismaClient as any
            for (const itemId of targetItemIds) {
                const item = await db.item.findUnique({
                    where: { id: itemId },
                    select: { consumptionUm: true },
                })
                const defaultUnit = String(item?.consumptionUm || "UN").trim().toUpperCase() || "UN"
                await createRecipeCompositionIngredientSkeleton({ db, recipeId, itemId, defaultUnit })
            }
            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao adicionar ingredientes")
        }
    }

    if (_action === "recipe-line-delete") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        if (!recipeId || !recipeLineId) return badRequest("Linha inválida")

        try {
            const db = prismaClient as any
            await deleteRecipeCompositionLine(db, recipeLineId)
            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao remover item da composição")
        }
    }

    if (_action === "recipe-ingredient-delete") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeIngredientId = String(values.recipeIngredientId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        if (!recipeId) return badRequest("Linha inválida")

        try {
            const db = prismaClient as any
            if (recipeIngredientId && typeof db?.recipeVariationIngredient?.findMany === "function") {
                const lines = await db.recipeVariationIngredient.findMany({
                    where: { recipeIngredientId },
                    select: { id: true },
                })
                for (const line of lines) {
                    await deleteRecipeCompositionLine(db, String(line.id))
                }
                return redirect(`/admin/recipes/${recipeId}`)
            }
            if (recipeLineId) {
                await deleteRecipeCompositionLine(db, recipeLineId)
                return redirect(`/admin/recipes/${recipeId}`)
            }
            return badRequest("Linha inválida")
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao remover ingrediente da composição")
        }
    }

    if (_action === "recipe-line-update") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        const quantity = Number(String(values.lineQuantity || "0").replace(",", "."))
        const requestedLossPct = parseLossPctInput(values.lineLossPct)

        if (!recipeId || !recipeLineId) return badRequest("Linha inválida")
        if (!unit) return badRequest("Informe a unidade de consumo")
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Informe uma quantidade válida")
        if (Number.isNaN(requestedLossPct)) return badRequest("Perda inválida")
        if (requestedLossPct !== null && (requestedLossPct < 0 || requestedLossPct >= 100)) {
            return badRequest("Perda deve ser entre 0 e 99,9999")
        }

        try {
            const db = prismaClient as any
            const lines = await listRecipeCompositionLines(db, recipeId)
            const line = lines.find((current) => current.id === recipeLineId)
            if (!line) {
                return badRequest("Linha da receita não encontrada")
            }

            const variationId = line.ItemVariation?.variationId || null
            const effectiveLossPct = requestedLossPct ?? Number(line.lossPct ?? line.defaultLossPct ?? 0)
            const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId)
            const snapshot = buildRecipeLineCostSnapshot(costInfo, quantity, effectiveLossPct)

            await updateRecipeCompositionLine({
                db,
                lineId: recipeLineId,
                recipeId,
                unit,
                quantity,
                lossPct: effectiveLossPct,
                snapshot,
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
            const lines = await listRecipeCompositionLines(db, recipeId)

            for (const line of lines) {
                const variationId = line.ItemVariation?.variationId || null
                const effectiveLossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0)
                const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId)
                const snapshot = buildRecipeLineCostSnapshot(costInfo, Number(line.quantity || 0), effectiveLossPct)

                await updateRecipeCompositionLine({
                    db,
                    lineId: line.id,
                    recipeId,
                    unit: line.unit,
                    quantity: Number(line.quantity || 0),
                    lossPct: effectiveLossPct,
                    snapshot,
                })
            }

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao recalcular custos da composição")
        }
    }

    if (_action === "recipe-line-apply-variations") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        const formVariationIds = formData.getAll("variationId").map((value) => String(value || "").trim()).filter(Boolean)
        const variationIdsRaw = String(values.targetVariationIds || "").trim()
        const variationIds = formVariationIds.length > 0
            ? formVariationIds
            : variationIdsRaw.split(",").map((value) => value.trim()).filter(Boolean)

        if (!recipeId || !recipeLineId) return badRequest("Linha inválida")
        if (variationIds.length === 0) return badRequest("Selecione ao menos uma variação")

        try {
            const db = prismaClient as any
            await applyRecipeCompositionLineToVariations({
                db,
                recipeId,
                lineId: recipeLineId,
                variationIds,
                resolveCostByVariationId: async (variationId, itemId, quantity, lossPct) => {
                    const costInfo = await resolveRecipeLineCosts(db, itemId, variationId)
                    return buildRecipeLineCostSnapshot(costInfo, quantity, lossPct)
                },
            })

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao aplicar para variações selecionadas")
        }
    }

    if (_action === "recipe-ingredient-unit-update") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeIngredientId = String(values.recipeIngredientId || "").trim()
        const unit = String(values.lineUnit || "").trim().toUpperCase()
        if (!recipeId || !recipeIngredientId) return badRequest("Ingrediente inválido")
        if (!unit) return badRequest("Informe a UM")

        try {
            const db = prismaClient as any
            const lines = await listRecipeCompositionLines(db, recipeId)
            const targetLines = lines.filter((line) => String(line.recipeIngredientId || "") === recipeIngredientId)
            for (const line of targetLines) {
                const variationId = line.ItemVariation?.variationId || null
                const effectiveLossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0)
                const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId)
                const snapshot = buildRecipeLineCostSnapshot(costInfo, Number(line.quantity || 0), effectiveLossPct)
                await updateRecipeCompositionLine({
                    db,
                    lineId: line.id,
                    recipeId,
                    unit,
                    quantity: Number(line.quantity || 0),
                    lossPct: effectiveLossPct,
                    snapshot,
                })
            }
            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao atualizar UM do ingrediente")
        }
    }

    if (_action === "recipe-ingredient-loss-update") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeIngredientId = String(values.recipeIngredientId || "").trim()
        const requestedLossPct = parseLossPctInput(values.defaultLossPct)
        const applyToLines = String(values.applyToLines || "").trim().toLowerCase() === "yes"
        if (!recipeId || !recipeIngredientId) return badRequest("Ingrediente inválido")
        if (requestedLossPct === null || Number.isNaN(requestedLossPct)) return badRequest("Perda padrão inválida")
        if (requestedLossPct < 0 || requestedLossPct >= 100) return badRequest("Perda deve ser entre 0 e 99,9999")

        try {
            const db = prismaClient as any
            await updateRecipeCompositionIngredientDefaultLoss({
                db,
                recipeId,
                recipeIngredientId,
                defaultLossPct: requestedLossPct,
                applyToVariationLines: applyToLines,
            })

            const lines = await listRecipeCompositionLines(db, recipeId)
            const targetLines = lines.filter((line) => String(line.recipeIngredientId || "") === recipeIngredientId)
            for (const line of targetLines) {
                const variationId = line.ItemVariation?.variationId || null
                const effectiveLossPct = applyToLines
                    ? requestedLossPct
                    : Number(line.lossPct ?? requestedLossPct)
                const costInfo = await resolveRecipeLineCosts(db, line.itemId, variationId)
                const snapshot = buildRecipeLineCostSnapshot(costInfo, Number(line.quantity || 0), effectiveLossPct)
                await updateRecipeCompositionLine({
                    db,
                    lineId: line.id,
                    recipeId,
                    unit: line.unit,
                    quantity: Number(line.quantity || 0),
                    lossPct: applyToLines ? effectiveLossPct : line.lossPct,
                    snapshot,
                })
            }

            return redirect(`/admin/recipes/${recipeId}`)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao atualizar perda padrão")
        }
    }

    if (_action === "recipe-update") {
        const recipe = await recipeEntity.findById(values?.recipeId as string)
        const requestedItemIdRaw = String(values.linkedItemId || "").trim()
        const currentItemId = String((recipe as any)?.itemId || "").trim()
        const isItemChangeRequested = requestedItemIdRaw !== currentItemId
        const confirmItemRemap = String(values.confirmItemRemap || "").trim().toLowerCase() === "yes"

        if (isItemChangeRequested && !confirmItemRemap) {
            return badRequest("Troca de item requer confirmação: os dados por variação serão apagados e será necessário remapeamento.")
        }

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
                const previousItemId = updatedRecipe.itemId as string | null
                let itemId = previousItemId

                if (explicitItemId && explicitItemId !== itemId) {
                    const explicitItem = await db.item.findUnique({ where: { id: explicitItemId } })
                    if (explicitItem) {
                        itemId = explicitItem.id
                        await db.recipe.update({
                            where: { id: updatedRecipe.id },
                            data: {
                                itemId,
                                variationId: null,
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
                            }
                        })
                    }

                    itemId = item.id

                    await db.recipe.update({
                        where: { id: updatedRecipe.id },
                        data: {
                            itemId,
                            variationId: null,
                        }
                    })
                }

                if (itemId) {
                    await db.recipe.update({
                        where: { id: updatedRecipe.id },
                        data: { variationId: null }
                    })
                }

                if (itemId && previousItemId !== itemId) {
                    const [targetVariations, recipeIngredients] = await Promise.all([
                        db.itemVariation.findMany({
                            where: { itemId, deletedAt: null },
                            select: { id: true },
                            orderBy: [{ createdAt: "asc" }],
                        }),
                        typeof db?.recipeIngredient?.findMany === "function"
                            ? db.recipeIngredient.findMany({
                                where: { recipeId: updatedRecipe.id },
                                select: { id: true },
                            })
                            : Promise.resolve([]),
                    ])

                    await db.itemVariation.updateMany({
                        where: { recipeId: updatedRecipe.id, deletedAt: null },
                        data: { recipeId: null },
                    })

                    if (targetVariations.length > 0) {
                        await db.itemVariation.updateMany({
                            where: { id: { in: targetVariations.map((row: { id: string }) => row.id) } },
                            data: { recipeId: updatedRecipe.id },
                        })
                    }

                    if (recipeIngredients.length > 0 && typeof db?.recipeVariationIngredient?.deleteMany === "function") {
                        await db.recipeVariationIngredient.deleteMany({
                            where: {
                                recipeIngredientId: { in: recipeIngredients.map((row: { id: string }) => row.id) },
                            },
                        })
                    }

                    if (
                        recipeIngredients.length > 0 &&
                        targetVariations.length > 0 &&
                        typeof db?.recipeVariationIngredient?.createMany === "function"
                    ) {
                        const data = recipeIngredients.flatMap((ingredient: { id: string }) =>
                            targetVariations.map((variation: { id: string }) => ({
                                recipeIngredientId: ingredient.id,
                                itemVariationId: variation.id,
                                unit: "UN",
                                quantity: 0,
                                lossPct: null,
                                lastUnitCostAmount: 0,
                                avgUnitCostAmount: 0,
                                lastTotalCostAmount: 0,
                                avgTotalCostAmount: 0,
                            }))
                        )
                        if (data.length > 0) {
                            await db.recipeVariationIngredient.createMany({
                                data,
                                skipDuplicates: true,
                            })
                        }
                    }
                }

            }
        } catch (_error) {
            // best effort: preserve legacy behavior when migrations are pending
        }

        return redirect(`/admin/recipes/${values.recipeId}`)
    }

    return null
}

function InlineVariationCellEditor({
    recipeId,
    line,
    lineUnit,
    showVariationLoss,
    globalLossPct,
}: {
    recipeId: string
    line: any
    lineUnit: string
    showVariationLoss: boolean
    globalLossPct: number
}) {
    const fetcher = useFetcher()
    const formRef = useRef<HTMLFormElement>(null)
    const [lineQuantity, setLineQuantity] = useState(Number(line.quantity || 0))
    const [lineLossPct, setLineLossPct] = useState(Number(line.lossPct ?? line.defaultLossPct ?? 0))
    const [defaultQty, setDefaultQty] = useState(Number(line.quantity || 0))
    const [defaultLossPct, setDefaultLossPct] = useState(Number(line.lossPct ?? line.defaultLossPct ?? 0))
    const baselineRef = useRef({
        quantity: Number(line.quantity || 0),
        lossPct: Number(line.lossPct ?? line.defaultLossPct ?? 0),
    })

    useEffect(() => {
        const nextQuantity = Number(line.quantity || 0)
        const nextLossPct = Number(line.lossPct ?? line.defaultLossPct ?? 0)
        setLineQuantity(nextQuantity)
        setLineLossPct(nextLossPct)
        setDefaultQty(nextQuantity)
        setDefaultLossPct(nextLossPct)
        baselineRef.current = {
            quantity: Number(line.quantity || 0),
            lossPct: Number(line.lossPct ?? line.defaultLossPct ?? 0),
        }
    }, [line.id, line.quantity, line.lossPct, line.defaultLossPct])

    useEffect(() => {
        if (!showVariationLoss) {
            setLineLossPct(Number(globalLossPct || 0))
            setDefaultLossPct(Number(globalLossPct || 0))
        }
    }, [showVariationLoss, globalLossPct])

    function hasPendingChanges() {
        const nextQuantity = Number(lineQuantity || 0)
        const nextLossPct = showVariationLoss ? Number(lineLossPct || 0) : Number(globalLossPct || 0)
        if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return false
        if (!Number.isFinite(nextLossPct) || nextLossPct < 0 || nextLossPct >= 100) return false
        if (showVariationLoss) {
            return Math.abs(nextQuantity - baselineRef.current.quantity) > 0.0000001 ||
                Math.abs(nextLossPct - baselineRef.current.lossPct) > 0.0000001
        }
        return Math.abs(nextQuantity - baselineRef.current.quantity) > 0.0000001
    }

    function submitAutoUpdate() {
        if (!formRef.current) return
        if (!hasPendingChanges()) return
        const formData = new FormData(formRef.current)
        formData.set("_action", "recipe-line-update")
        fetcher.submit(formData, { method: "post" })
    }

    const effectiveLossPct = showVariationLoss ? Number(lineLossPct || 0) : Number(globalLossPct || 0)
    const safeLossPct = Math.min(99.9999, Math.max(0, effectiveLossPct))
    const grossQty = safeLossPct > 0
        ? Number(lineQuantity || 0) / (1 - safeLossPct / 100)
        : Number(lineQuantity || 0)

    return (
        <fetcher.Form
            method="post"
            ref={formRef}
            className="space-y-1.5"
            onBlurCapture={() => {
                window.setTimeout(() => {
                    const activeElement = document.activeElement
                    if (formRef.current?.contains(activeElement)) return
                    submitAutoUpdate()
                }, 0)
            }}
        >
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="recipeLineId" value={line.id} />
            <input type="hidden" name="lineUnit" value={String(lineUnit || "UN").toUpperCase()} />
            {!showVariationLoss ? <input type="hidden" name="lineLossPct" value={String(effectiveLossPct)} /> : null}
            <div className="flex items-center gap-1.5">
                <DecimalInput
                    name="lineQuantity"
                    defaultValue={defaultQty}
                    fractionDigits={3}
                    onValueChange={setLineQuantity}
                    className="w-24 h-7 border border-slate-200 rounded px-2 py-0 text-[14px] text-right"
                />
                {showVariationLoss ? (
                    <>
                        <DecimalInput
                            name="lineLossPct"
                            defaultValue={defaultLossPct}
                            fractionDigits={3}
                            onValueChange={setLineLossPct}
                            className="w-20 h-7 border border-slate-200 rounded px-2 py-0 text-[14px] text-right"
                        />
                        <span className="text-[10px] text-slate-500">%</span>
                    </>
                ) : null}
                <span
                    className={`px-1 text-[10px] font-medium ${hasPendingChanges() ? "text-slate-700" : "text-slate-500"}`}
                    title={hasPendingChanges() ? "Alterações pendentes (salva ao sair do campo)" : "Já salvo automaticamente"}
                >
                    {hasPendingChanges() ? "Alterado" : "Salvo"}
                </span>
            </div>
            <div className="text-[10px]">
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                    <span className="text-slate-500">Qtd bruta</span>
                    <span className="font-semibold text-slate-700">
                        {formatDecimalPlaces(Number(grossQty || 0), 4)}
                    </span>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                    <span className="text-slate-500">Total</span>
                    <span className={Number(line.lastTotalCostAmount || 0) <= 0 ? "font-semibold text-slate-900" : "font-semibold text-slate-700"}>
                        {formatMoney(Number(line.lastTotalCostAmount || 0), 4)}
                    </span>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                    <span className="text-slate-500">Médio total</span>
                    <span className="font-semibold text-slate-700">{formatMoney(Number(line.avgTotalCostAmount || 0), 4)}</span>
                </div>
            </div>
        </fetcher.Form>
    )
}

function IngredientUnitEditor({
    recipeId,
    recipeIngredientId,
    currentUnit,
    options,
}: {
    recipeId: string
    recipeIngredientId: string | null
    currentUnit: string
    options: string[]
}) {
    const fetcher = useFetcher()
    const [unit, setUnit] = useState(currentUnit)

    useEffect(() => {
        setUnit(currentUnit)
    }, [currentUnit, recipeIngredientId])

    const handleUnitChange = (nextUnit: string) => {
        setUnit(nextUnit)
        const formData = new FormData()
        formData.set("recipeId", recipeId)
        formData.set("recipeIngredientId", recipeIngredientId || "")
        formData.set("lineUnit", nextUnit)
        formData.set("_action", "recipe-ingredient-unit-update")
        fetcher.submit(formData, { method: "post" })
    }

    return (
        <div className="flex w-full max-w-[92px] flex-col items-start gap-1 pt-1">
            <Select value={unit} onValueChange={handleUnitChange}>
                <SelectTrigger className="h-8 w-full text-[11px]">
                    <SelectValue placeholder="UM" />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

function IngredientLossEditor({
    recipeId,
    recipeIngredientId,
    defaultLossPct,
}: {
    recipeId: string
    recipeIngredientId: string | null
    defaultLossPct: number
}) {
    const [lossPct, setLossPct] = useState(Number(defaultLossPct || 0))

    useEffect(() => {
        setLossPct(Number(defaultLossPct || 0))
    }, [defaultLossPct, recipeIngredientId])

    return (
        <Form method="post" className="flex w-full max-w-[132px] flex-col items-start gap-1 pt-1">
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="recipeIngredientId" value={recipeIngredientId || ""} />
            <input type="hidden" name="defaultLossPct" value={String(lossPct)} />
            <input type="hidden" name="_action" value="recipe-ingredient-loss-update" />
            <div className="flex w-full items-center gap-1">
                <DecimalInput
                    name="defaultLossPctInput"
                    defaultValue={Number(defaultLossPct || 0)}
                    fractionDigits={3}
                    onValueChange={setLossPct}
                    className="h-8 w-full border border-slate-200 rounded px-2 py-0 text-[14px] text-right"
                />
                <span className="text-[10px] text-slate-500">%</span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    type="submit"
                    name="applyToLines"
                    value="no"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Aplicar perda padrão"
                    aria-label="Aplicar perda padrão"
                >
                    <Check size={12} />
                </button>
                <button
                    type="submit"
                    name="applyToLines"
                    value="yes"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Aplicar para todas as linhas"
                    aria-label="Aplicar para todas as linhas"
                >
                    <RefreshCw size={12} />
                </button>
            </div>
        </Form>
    )
}


export default function SingleRecipe() {
    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()

    const recipe = loaderData?.payload?.recipe as Recipe
    const items = (loaderData?.payload?.items || []) as Array<{
        id: string
        name: string
        classification?: string | null
        consumptionUm?: string | null
    }>
    const recipeLines = (loaderData?.payload?.recipeLines || []) as any[]
    const linkedVariations = (loaderData?.payload?.linkedVariations || []) as Array<{
        itemVariationId: string
        variationId: string | null
        variationName: string | null
        variationKind?: string | null
        variationCode?: string | null
        isReference?: boolean
    }>
    const actionData = useActionData<typeof action>()
    const linkedItem = items.find((item) => item.id === recipe?.itemId)
    const recipeLineCount = recipeLines.length
    const avgCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.avgTotalCostAmount || 0), 0)
    const lastCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.lastTotalCostAmount || 0), 0)
    const [activeCompositionTab, setActiveCompositionTab] = useState<"base" | "variation">("base")
    const [showVariationLoss, setShowVariationLoss] = useState(false)
    const [builderSearch, setBuilderSearch] = useState("")
    const [builderSelectedItemIds, setBuilderSelectedItemIds] = useState<string[]>([])
    const [hiddenVariationIds, setHiddenVariationIds] = useState<string[]>(() => {
        const baseIds = linkedVariations
            .filter((variation) => variation.variationKind === "base" && variation.variationCode === "base")
            .map((variation) => variation.itemVariationId)
        return Array.from(new Set(baseIds))
    })
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
    const compositionRows = Array.from(groupedLines.values()) as Array<{
        key: string
        recipeIngredientId: string | null
        itemName: string
        itemId: string
        linesByVariation: Map<string, any>
    }>
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
    const baseIngredients = compositionRows.map((row, idx) => ({
        sortOrderIndex: idx + 1,
        recipeIngredientId: row.recipeIngredientId,
        itemId: row.itemId,
        itemName: row.itemName,
    }))
    const builderItems = items
        .filter((item) => {
            const q = builderSearch.trim().toLowerCase()
            if (!q) return true
            return `${item.name} ${item.classification || ""}`.toLowerCase().includes(q)
        })
        .slice(0, 80)
    const variationMetrics = effectiveVariationColumns.map((variation) => {
        let totalLast = 0
        let totalAvg = 0
        let filledCells = 0
        let filledQtyCells = 0
        let zeroCostCells = 0
        for (const row of compositionRowsWithUnit) {
            const line = row.linesByVariation.get(String(variation.itemVariationId))
            if (!line) continue
            filledCells += 1
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
            filledCells,
            filledQtyCells,
            zeroCostCells,
            totalLast,
            totalAvg,
        }
    })
    const requiredCellCount = compositionRowsWithUnit.length
    const hasVariationPendingCells = variationMetrics.some((metric) => metric.filledQtyCells < requiredCellCount)
    const hasVariationCostZero = variationMetrics.some((metric) => metric.zeroCostCells > 0)
    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    const toggleBuilderItem = (itemId: string) => {
        setBuilderSelectedItemIds((current) =>
            current.includes(itemId)
                ? current.filter((id) => id !== itemId)
                : [...current, itemId]
        )
    }
    const toggleVariationColumn = (itemVariationId: string) => {
        if (baseVariationIds.includes(itemVariationId)) return
        setHiddenVariationIds((current) =>
            current.includes(itemVariationId)
                ? current.filter((id) => id !== itemVariationId)
                : [...current, itemVariationId]
        )
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
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${recipe?.type === "pizzaTopping"
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
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-6">
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Itens</p>
                            <p className="mt-0.5 text-2xl font-bold text-slate-900">{recipeLineCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Custo médio</p>
                            <p className="mt-0.5 text-2xl font-bold text-slate-900">{formatMoney(avgCompositionCost, 2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último custo</p>
                            <p className="mt-0.5 text-2xl font-bold text-slate-900">{formatMoney(lastCompositionCost, 2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Configuração ── */}
            <div className="pt-6 pb-16">
                <h2 className="text-base font-semibold text-slate-900">Configuração da receita</h2>
                <p className="mt-0.5 mb-4 text-sm text-slate-500">Atualize nome, vínculo com item e atributos.</p>
                <RecipeForm
                    recipe={recipe}
                    actionName="recipe-update"
                    items={items}
                    requireItemRemapConfirmation
                />
            </div>

            {/* ── Composição ── */}
            <div className="py-6 pb-32">
                <div className="mb-4 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                        type="button"
                        onClick={() => setActiveCompositionTab("base")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeCompositionTab === "base" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                        Base
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCompositionTab("variation")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeCompositionTab === "variation" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                        Variações
                    </button>
                </div>

                <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Como funciona a perda</p>
                    <p className="mt-1">
                        A quantidade que você digita na receita é a quantidade final que quer entregar no prato. A perda (%) representa o que se perde no preparo
                        (evaporação, redução, gordura que fica na panela, sobra de manipulação etc.).
                    </p>
                    <p className="mt-1">
                        Exemplo simples: você quer <strong>1,000 kg</strong> de molho de costela pronto e definiu <strong>20% de perda</strong>. O sistema calcula uma
                        quantidade bruta de <strong>1,250 kg</strong> para comprar/consumir, e o custo total usa essa quantidade bruta. Ou seja: quanto maior a perda,
                        maior o custo real da variação.
                    </p>
                </div>

                {activeCompositionTab === "base" ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-lg border border-slate-200 bg-white p-3 min-h-[520px]">
                                <h3 className="text-sm font-medium text-slate-900">Montador rápido</h3>
                                <p className="text-xs text-slate-500">Selecione ingredientes e vincule na receita sem quantidade/custo.</p>
                                <div className="mt-3 space-y-2">
                                    <input
                                        value={builderSearch}
                                        onChange={(event) => setBuilderSearch(event.target.value)}
                                        placeholder="Buscar ingrediente..."
                                        className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                                    />
                                    <div className="min-h-[280px] max-h-[360px] overflow-auto rounded-md border border-slate-200">
                                        {builderItems.map((item) => {
                                            const checked = builderSelectedItemIds.includes(item.id)
                                            return (
                                                <label key={item.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleBuilderItem(item.id)}
                                                        className="h-3.5 w-3.5 rounded border-slate-300"
                                                    />
                                                    <span className="truncate">{item.name}</span>
                                                    {item.classification ? (
                                                        <span className="ml-auto rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{item.classification}</span>
                                                    ) : null}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                                <Form method="post" preventScrollReset className="mt-3 flex items-center justify-end gap-2">
                                    <input type="hidden" name="recipeId" value={recipe?.id} />
                                    <input type="hidden" name="targetItemIds" value={builderSelectedItemIds.join(",")} />
                                    <Button type="submit" name="_action" value="recipe-ingredient-batch-add" size="sm">
                                        Adicionar selecionados
                                    </Button>
                                </Form>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 min-h-[520px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ordem</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ingrediente</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Opcional</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {baseIngredients.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                                                    Nenhum ingrediente base. Adicione no montador acima.
                                                </td>
                                            </tr>
                                        ) : (
                                            baseIngredients.map((ingredient) => (
                                                <tr key={ingredient.recipeIngredientId || ingredient.itemId} className="border-t border-slate-100">
                                                    <td className="px-3 py-2 text-slate-500">{ingredient.sortOrderIndex}</td>
                                                    <td className="px-3 py-2 font-medium text-slate-900">{ingredient.itemName}</td>
                                                    <td className="px-3 py-2 text-xs text-slate-500">Nota / obrigatório / substituível (em breve)</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <Form method="post" preventScrollReset className="inline">
                                                            <input type="hidden" name="recipeId" value={recipe?.id} />
                                                            <input type="hidden" name="recipeIngredientId" value={ingredient.recipeIngredientId || ""} />
                                                            <button
                                                                type="submit"
                                                                name="_action"
                                                                value="recipe-ingredient-delete"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
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
                ) : (
                    <div className="space-y-4">
                        {(hasVariationPendingCells || hasVariationCostZero) ? (
                            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                                <AlertCircle size={15} className="text-slate-600" />
                                <span>Não pronto para produção: existem células sem UM/QTD ou com custo 0 em alguma variação.</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                                <CheckCircle2 size={15} className="text-slate-600" />
                                <span>Pronto para produção: todas as variações estão completas e sem custo 0.</span>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                                    checked={showVariationLoss}
                                    onChange={(event) => setShowVariationLoss(event.target.checked)}
                                />
                                Perda por variação
                            </label>
                            <Form method="post" preventScrollReset>
                                <input type="hidden" name="recipeId" value={recipe?.id} />
                                <Button type="submit" name="_action" value="recipe-lines-recalc" variant="outline" size="sm">
                                    Recalcular custos
                                </Button>
                            </Form>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colunas visíveis</span>
                                {columnToggleVariations.length === 0 ? (
                                    <span className="text-xs text-slate-500">Nenhuma variação disponível.</span>
                                ) : (
                                    columnToggleVariations.map((variation) => {
                                        const checked = !hiddenVariationIds.includes(variation.itemVariationId)
                                        return (
                                            <label key={`toggle-${variation.itemVariationId}`} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                                                    checked={checked}
                                                    onChange={() => toggleVariationColumn(variation.itemVariationId)}
                                                />
                                                <span>{variation.variationName || "Variação"}</span>
                                                {(variation.variationKind === "base" && variation.variationCode === "base") ? (
                                                    <span className="rounded border border-slate-300 bg-slate-50 px-1 py-0 text-[10px] text-slate-600">
                                                        Base
                                                    </span>
                                                ) : null}
                                                {variation.isReference ? (
                                                    <span className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0 text-[10px] font-semibold text-blue-700">
                                                        Referência
                                                    </span>
                                                ) : null}
                                            </label>
                                        )
                                    })
                                )}
                                {baseVariationIds.length > 0 ? (
                                    <span className="text-[11px] text-slate-500">A variação Base inicia oculta, mas pode ser exibida.</span>
                                ) : null}
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                        <th colSpan={3} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Total da composição
                                        </th>
                                        {effectiveVariationColumns.map((variation, index) => {
                                            const metric = variationMetrics[index]
                                            return (
                                                <th key={`total-head-${variation.itemVariationId}`} className={`px-3 py-2 text-left align-top text-[11px] ${variation.isReference ? "bg-blue-50/60 ring-1 ring-inset ring-blue-100" : ""}`}>
                                                    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                                        <span className="text-slate-500">Total custo</span>
                                                        <span className="font-semibold text-slate-700">{formatMoney(metric.totalLast, 2)}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                                        <span className="text-slate-500">Custo médio</span>
                                                        <span className="font-semibold text-slate-700">{formatMoney(metric.totalAvg, 2)}</span>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                        <th className="px-3 py-2" />
                                    </tr>
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ingrediente</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-[104px]">UM</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-[108px]">Perda</th>
                                        {effectiveVariationColumns.map((variation, index) => {
                                            const metric = variationMetrics[index]
                                            const complete = metric.filledQtyCells === requiredCellCount && metric.zeroCostCells === 0
                                            const missing = metric.filledQtyCells < requiredCellCount
                                            const hasZero = metric.zeroCostCells > 0
                                            return (
                                                <th key={variation.itemVariationId} className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[230px] ${variation.isReference ? "bg-blue-50/60 ring-1 ring-inset ring-blue-100" : ""}`}>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                                                            <span>{variation.variationName || "Base/auto"}</span>
                                                            {variation.isReference ? (
                                                                <span className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 normal-case tracking-normal">
                                                                    Referência
                                                                </span>
                                                            ) : null}
                                                            {missing ? (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="inline-flex h-4 w-4 cursor-help items-center justify-center text-orange-600" aria-label="Campos pendentes">
                                                                                <AlertCircle size={14} />
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-[11px]">
                                                                            Existem campos sem UM/QTD nesta variação.
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            ) : null}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 normal-case tracking-normal">
                                                            {complete ? <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600">Completo</span> : null}
                                                            {hasZero ? <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600">Custo 0</span> : null}
                                                        </div>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {compositionRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={effectiveVariationColumns.length + 4} className="px-3 py-10 text-center text-sm text-slate-500">
                                                Nenhum item na composição. Primeiro monte a base na aba Base.
                                            </td>
                                        </tr>
                                    ) : (
                                        compositionRowsWithUnit.map((row) => (
                                            <tr key={row.key} className="border-t border-slate-100 align-top hover:bg-slate-50/50">
                                                <td className="px-3 py-3 font-medium text-slate-900 align-top">
                                                    <span className="block truncate max-w-[240px]" title={row.itemName}>{row.itemName}</span>
                                                    <div className="mt-1 text-[10px] font-normal">
                                                        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                                            <span className="text-slate-500">Custo unitário</span>
                                                            <span className="font-semibold text-slate-700">{formatMoney(row.lastUnitCostAmount, 4)}</span>
                                                        </div>
                                                        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                                                            <span className="text-slate-500">Custo médio</span>
                                                            <span className="font-semibold text-slate-700">{formatMoney(row.avgUnitCostAmount, 4)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 align-top">
                                                    <IngredientUnitEditor
                                                        recipeId={String(recipe?.id || "")}
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
                                                <td className="px-3 py-3 align-top">
                                                    <IngredientLossEditor
                                                        recipeId={String(recipe?.id || "")}
                                                        recipeIngredientId={row.recipeIngredientId}
                                                        defaultLossPct={Number(row.defaultLossPct || 0)}
                                                    />
                                                </td>
                                                {effectiveVariationColumns.map((variation) => {
                                                    const line = row.linesByVariation.get(String(variation.itemVariationId))
                                                    if (!line) {
                                                        return <td key={`${row.key}-${variation.itemVariationId}`} className={`px-3 py-3 align-top text-xs text-slate-400 ${variation.isReference ? "bg-blue-50/40" : ""}`}>—</td>
                                                    }
                                                    return (
                                                        <td key={`${row.key}-${variation.itemVariationId}`} className={`px-3 py-3 align-top ${variation.isReference ? "bg-blue-50/40" : ""}`}>
                                                            <InlineVariationCellEditor
                                                                recipeId={String(recipe?.id || "")}
                                                                line={line}
                                                                lineUnit={row.unit}
                                                                showVariationLoss={showVariationLoss}
                                                                globalLossPct={Number(row.defaultLossPct || 0)}
                                                            />
                                                        </td>
                                                    )
                                                })}
                                                <td className="px-3 py-3 text-right align-top">
                                                    <Form method="post" preventScrollReset className="inline">
                                                        <input type="hidden" name="recipeId" value={recipe?.id} />
                                                        <input type="hidden" name="recipeIngredientId" value={row.recipeIngredientId || ""} />
                                                        <input type="hidden" name="recipeLineId" value={row.linesByVariation.values().next().value?.id || ""} />
                                                        <button
                                                            type="submit"
                                                            name="_action"
                                                            value="recipe-ingredient-delete"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
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
                )}
            </div>
        </div>
    )
}
