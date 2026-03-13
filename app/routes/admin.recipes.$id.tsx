import { Recipe, RecipeType } from "@prisma/client";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useFetcher, useLoaderData, useLocation } from "@remix-run/react";
import { Check, ChevronLeft, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Separator } from "~/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { DecimalInput } from "~/components/inputs/inputs";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import {
    DEFAULT_RECIPE_CHATGPT_PROJECT_URL,
    RECIPE_CHATGPT_PROJECT_URL_SETTING_NAME,
    RECIPE_CHATGPT_SETTINGS_CONTEXT,
} from "~/domain/recipe/recipe-chatgpt-settings";
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
import { lastUrlSegment } from "~/utils/url";

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

function parseDecimalInput(value: unknown): number | null {
    const normalized = String(value ?? "").trim()
    if (!normalized) return null
    const parsed = Number(normalized.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : Number.NaN
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

type RecipeChatGptImportIngredient = {
    itemId?: unknown
    itemName?: unknown
    unit?: unknown
    defaultLossPct?: unknown
    variationQuantities?: Record<string, unknown> | null
}

type RecipeChatGptImportPayload = {
    recipeId?: unknown
    ingredients?: RecipeChatGptImportIngredient[]
    missingIngredients?: Array<{
        name?: unknown
        unit?: unknown
        notes?: unknown
    }>
}

function parseRecipeChatGptImportPayload(value: string): {
    recipeId: string | null
    ingredients: Array<{
        itemId: string
        unit: string
        defaultLossPct: number
        variationQuantities: Record<string, number>
    }>
    missingIngredients: Array<{
        name: string
        unit: string | null
        notes: string | null
    }>
} {
    const jsonPayload = extractJsonPayloadFromText(value)
    if (!jsonPayload) {
        throw new Error("Cole a resposta JSON do ChatGPT antes de importar")
    }

    let parsed: RecipeChatGptImportPayload
    try {
        parsed = JSON.parse(jsonPayload)
    } catch (_error) {
        throw new Error("A resposta colada não contém um JSON válido")
    }

    const ingredientsRaw = Array.isArray(parsed?.ingredients) ? parsed.ingredients : []
    const missingIngredientsRaw = Array.isArray(parsed?.missingIngredients) ? parsed.missingIngredients : []
    if (ingredientsRaw.length === 0 && missingIngredientsRaw.length === 0) {
        throw new Error("Nenhum ingrediente encontrado no JSON importado")
    }

    const seenItemIds = new Set<string>()
    const ingredients = ingredientsRaw.map((ingredient, index) => {
        const itemId = String(ingredient?.itemId || "").trim()
        const unit = String(ingredient?.unit || "").trim().toUpperCase()
        const defaultLossPctParsed = parseDecimalInput(ingredient?.defaultLossPct)
        const variationEntries = Object.entries(ingredient?.variationQuantities || {})

        if (!itemId) {
            throw new Error(`Ingrediente ${index + 1}: itemId é obrigatório`)
        }
        if (seenItemIds.has(itemId)) {
            throw new Error(`Ingrediente ${index + 1}: itemId duplicado (${itemId})`)
        }
        seenItemIds.add(itemId)
        if (!unit) {
            throw new Error(`Ingrediente ${index + 1}: unit é obrigatório`)
        }
        if (defaultLossPctParsed === null || Number.isNaN(defaultLossPctParsed) || defaultLossPctParsed < 0 || defaultLossPctParsed >= 100) {
            throw new Error(`Ingrediente ${index + 1}: defaultLossPct inválido`)
        }
        if (variationEntries.length === 0) {
            throw new Error(`Ingrediente ${index + 1}: informe variationQuantities`)
        }

        const variationQuantities = variationEntries.reduce((acc, [variationKey, quantityRaw]) => {
            const quantity = parseDecimalInput(quantityRaw)
            if (!variationKey.trim()) {
                throw new Error(`Ingrediente ${index + 1}: chave de variação inválida`)
            }
            if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
                throw new Error(`Ingrediente ${index + 1}: quantidade inválida para a variação ${variationKey}`)
            }
            acc[String(variationKey).trim()] = quantity
            return acc
        }, {} as Record<string, number>)

        return {
            itemId,
            unit,
            defaultLossPct: defaultLossPctParsed,
            variationQuantities,
        }
    })

    const missingIngredients = missingIngredientsRaw.map((ingredient, index) => {
        const name = String(ingredient?.name || "").trim()
        const unitRaw = String(ingredient?.unit || "").trim().toUpperCase()
        const notes = String(ingredient?.notes || "").trim()

        if (!name) {
            throw new Error(`Ingrediente faltante ${index + 1}: name é obrigatório`)
        }

        return {
            name,
            unit: unitRaw || null,
            notes: notes || null,
        }
    })

    return {
        recipeId: String(parsed?.recipeId || "").trim() || null,
        ingredients,
        missingIngredients,
    }
}

async function buildRecipeChatGptImportPreview(params: {
    db: any
    recipeId: string
    payload: ReturnType<typeof parseRecipeChatGptImportPayload>
}) {
    const { db, recipeId, payload } = params
    const [linkedVariations, itemCatalog] = await Promise.all([
        listRecipeLinkedVariations(db, recipeId),
        db.item.findMany({
            where: { id: { in: payload.ingredients.map((ingredient) => ingredient.itemId) } },
            select: { id: true, name: true, consumptionUm: true },
        }),
    ])

    const itemById = new Map<string, { id: string; name: string; consumptionUm?: string | null }>(
        itemCatalog.map((item: { id: string; name: string; consumptionUm?: string | null }) => [item.id, item])
    )
    const linkedVariationIds = new Set(linkedVariations.map((variation) => variation.itemVariationId))
    const variationNameById = new Map(
        linkedVariations.map((variation) => [variation.itemVariationId, variation.variationName || "Base"])
    )

    const importableIngredients = payload.ingredients.map((ingredient) => {
        const item = itemById.get(ingredient.itemId)
        if (!item) {
            throw new Error(`Ingrediente não encontrado para itemId ${ingredient.itemId}`)
        }

        const variationKeys = Object.keys(ingredient.variationQuantities)
        const invalidVariationId = variationKeys.find((variationId) => !linkedVariationIds.has(variationId))
        if (invalidVariationId) {
            throw new Error(`Variação inválida no JSON: ${invalidVariationId}`)
        }

        return {
            itemId: ingredient.itemId,
            itemName: item.name,
            unit: ingredient.unit,
            defaultLossPct: ingredient.defaultLossPct,
            variationCount: variationKeys.length,
            zeroQtyVariationCount: variationKeys.filter((variationId) => Number(ingredient.variationQuantities[variationId] || 0) <= 0).length,
            variations: variationKeys.map((variationId) => ({
                itemVariationId: variationId,
                variationName: String(variationNameById.get(variationId) || "Variação"),
                quantity: Number(ingredient.variationQuantities[variationId] || 0),
            })),
        }
    })

    return {
        itemById,
        linkedVariations,
        linkedVariationIds,
        preview: {
            importableIngredients,
            missingIngredients: payload.missingIngredients,
            totals: {
                importableIngredients: importableIngredients.length,
                missingIngredients: payload.missingIngredients.length,
                variationCells: importableIngredients.reduce((acc, ingredient) => acc + ingredient.variationCount, 0),
            },
        },
    }
}

export function formatMoney(value: number, decimals: number = 2) {
    return `R$ ${formatDecimalPlaces(Number(value || 0), decimals)}`
}

export const RECIPE_SECTIONS = ["cadastro", "composicao", "variacoes"] as const
export type RecipeSection = (typeof RECIPE_SECTIONS)[number]
export const ALPHABET_FILTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export function resolveRecipeSection(value: unknown): RecipeSection {
    const normalized = String(value || "").trim().toLowerCase()
    return RECIPE_SECTIONS.includes(normalized as RecipeSection)
        ? normalized as RecipeSection
        : "cadastro"
}

export function buildRecipeSectionHref(recipeId: string, section: RecipeSection) {
    if (section === "cadastro") return `/admin/recipes/${recipeId}`
    return `/admin/recipes/${recipeId}/${section}`
}

function buildRecipeSectionRedirect(recipeId: string, sectionRaw: unknown) {
    return redirect(buildRecipeSectionHref(recipeId, resolveRecipeSection(sectionRaw)))
}

export function normalizeInitialLetter(value: string) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .charAt(0)
        .toUpperCase()
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
        const [recipeLines, linkedVariations, chatGptProjectUrlSetting] = await Promise.all([
            listRecipeCompositionLines(db, recipeId),
            listRecipeLinkedVariations(db, recipeId),
            db.setting.findFirst({
                where: {
                    context: RECIPE_CHATGPT_SETTINGS_CONTEXT,
                    name: RECIPE_CHATGPT_PROJECT_URL_SETTING_NAME,
                },
                orderBy: [{ createdAt: "desc" }],
                select: { value: true },
            }),
        ])

        return ok({
            recipe,
            items,
            recipeLines,
            linkedVariations,
            chatGptProjectUrl: String(chatGptProjectUrlSetting?.value || "").trim() || DEFAULT_RECIPE_CHATGPT_PROJECT_URL,
        })
    } catch (error) {
        return badRequest((error as Error)?.message || "Erro ao carregar catálogos")
    }

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);
    const currentSection = resolveRecipeSection(values.tab)

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

            return buildRecipeSectionRedirect(recipeId, currentSection)
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
            return buildRecipeSectionRedirect(recipeId, currentSection)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao adicionar ingredientes")
        }
    }

    if (_action === "recipe-chatgpt-import") {
        const recipeId = String(values.recipeId || "").trim()
        const chatGptResponse = String(values.chatGptResponse || "").trim()

        if (!recipeId) return badRequest("Receita inválida")
        if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT antes de importar")

        try {
            const payload = parseRecipeChatGptImportPayload(chatGptResponse)
            if (payload.recipeId && payload.recipeId !== recipeId) {
                return badRequest("O recipeId do JSON não corresponde à receita atual")
            }
            if (payload.ingredients.length === 0) {
                return badRequest("A resposta só contém ingredientes faltantes. Cadastre os itens e tente novamente.")
            }

            const db = prismaClient as any
            const { itemById } = await buildRecipeChatGptImportPreview({ db, recipeId, payload })

            for (const ingredient of payload.ingredients) {
                const item = itemById.get(ingredient.itemId)
                const defaultUnit = String(ingredient.unit || item.consumptionUm || "UN").trim().toUpperCase() || "UN"
                await createRecipeCompositionIngredientSkeleton({
                    db,
                    recipeId,
                    itemId: ingredient.itemId,
                    defaultUnit,
                    defaultLossPct: ingredient.defaultLossPct,
                })
            }

            const refreshedLines = await listRecipeCompositionLines(db, recipeId)
            const ingredientByItemId = new Map<string, string>()
            const lineByItemAndVariation = new Map<string, any>()

            for (const line of refreshedLines) {
                if (line.recipeIngredientId) {
                    ingredientByItemId.set(String(line.itemId), String(line.recipeIngredientId))
                }
                const itemVariationId = String(line.ItemVariation?.id || "")
                if (itemVariationId) {
                    lineByItemAndVariation.set(`${line.itemId}::${itemVariationId}`, line)
                }
            }

            for (const ingredient of payload.ingredients) {
                const recipeIngredientId = ingredientByItemId.get(ingredient.itemId)
                if (!recipeIngredientId) {
                    return badRequest(`Não foi possível preparar a composição para o item ${ingredient.itemId}`)
                }

                await updateRecipeCompositionIngredientDefaultLoss({
                    db,
                    recipeId,
                    recipeIngredientId,
                    defaultLossPct: ingredient.defaultLossPct,
                    applyToVariationLines: false,
                })

                for (const [itemVariationId, quantity] of Object.entries(ingredient.variationQuantities)) {
                    const line = lineByItemAndVariation.get(`${ingredient.itemId}::${itemVariationId}`)
                    if (!line) {
                        return badRequest(`Linha não encontrada para item ${ingredient.itemId} na variação ${itemVariationId}`)
                    }

                    const variationId = line.ItemVariation?.variationId || null
                    const snapshot = buildRecipeLineCostSnapshot(
                        await resolveRecipeLineCosts(db, ingredient.itemId, variationId),
                        quantity,
                        ingredient.defaultLossPct
                    )

                    await updateRecipeCompositionLine({
                        db,
                        lineId: line.id,
                        recipeId,
                        unit: ingredient.unit,
                        quantity,
                        lossPct: ingredient.defaultLossPct,
                        snapshot,
                    })
                }
            }

            return buildRecipeSectionRedirect(recipeId, currentSection)
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao importar composição do ChatGPT")
        }
    }

    if (_action === "recipe-chatgpt-preview") {
        const recipeId = String(values.recipeId || "").trim()
        const chatGptResponse = String(values.chatGptResponse || "").trim()

        if (!recipeId) return badRequest("Receita inválida")
        if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT antes de pré-visualizar")

        try {
            const payload = parseRecipeChatGptImportPayload(chatGptResponse)
            if (payload.recipeId && payload.recipeId !== recipeId) {
                return badRequest("O recipeId do JSON não corresponde à receita atual")
            }

            const db = prismaClient as any
            const { preview } = await buildRecipeChatGptImportPreview({ db, recipeId, payload })

            return ok({
                message: "Pré-visualização gerada",
                payload: preview,
            })
        } catch (error) {
            return badRequest((error as Error)?.message || "Erro ao gerar pré-visualização da importação")
        }
    }

    if (_action === "recipe-line-delete") {
        const recipeId = String(values.recipeId || "").trim()
        const recipeLineId = String(values.recipeLineId || "").trim()
        if (!recipeId || !recipeLineId) return badRequest("Linha inválida")

        try {
            const db = prismaClient as any
            await deleteRecipeCompositionLine(db, recipeLineId)
            return buildRecipeSectionRedirect(recipeId, currentSection)
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
                return buildRecipeSectionRedirect(recipeId, currentSection)
            }
            if (recipeLineId) {
                await deleteRecipeCompositionLine(db, recipeLineId)
                return buildRecipeSectionRedirect(recipeId, currentSection)
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

            return buildRecipeSectionRedirect(recipeId, currentSection)
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

            return buildRecipeSectionRedirect(recipeId, currentSection)
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

            return buildRecipeSectionRedirect(recipeId, currentSection)
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
            return buildRecipeSectionRedirect(recipeId, currentSection)
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

            return buildRecipeSectionRedirect(recipeId, currentSection)
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

        return buildRecipeSectionRedirect(String(values.recipeId || "").trim(), currentSection)
    }

    return null
}

export function InlineVariationCellEditor({
    recipeId,
    section,
    line,
    lineUnit,
    showVariationLoss,
    globalLossPct,
}: {
    recipeId: string
    section: RecipeSection
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
        fetcher.submit(formData, { method: "post", action: ".." })
    }

    const effectiveLossPct = showVariationLoss ? Number(lineLossPct || 0) : Number(globalLossPct || 0)
    const safeLossPct = Math.min(99.9999, Math.max(0, effectiveLossPct))
    const grossQty = safeLossPct > 0
        ? Number(lineQuantity || 0) / (1 - safeLossPct / 100)
        : Number(lineQuantity || 0)

    return (
        <fetcher.Form
            action=".."
            method="post"
            ref={formRef}
            onBlurCapture={() => {
                window.setTimeout(() => {
                    const activeElement = document.activeElement
                    if (formRef.current?.contains(activeElement)) return
                    submitAutoUpdate()
                }, 0)
            }}
        >
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="tab" value={section} />
            <input type="hidden" name="recipeLineId" value={line.id} />
            <input type="hidden" name="lineUnit" value={String(lineUnit || "UN").toUpperCase()} />
            {!showVariationLoss ? <input type="hidden" name="lineLossPct" value={String(effectiveLossPct)} /> : null}
            <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <DecimalInput
                    name="lineQuantity"
                    defaultValue={defaultQty}
                    fractionDigits={3}
                    onValueChange={setLineQuantity}
                    className="w-24 h-8 border-b border-slate-200 bg-transparent px-1 py-0 text-sm text-right outline-none focus:border-slate-700 transition-colors"
                />
                {showVariationLoss ? (
                    <div className="flex items-center gap-0.5">
                        <DecimalInput
                            name="lineLossPct"
                            defaultValue={defaultLossPct}
                            fractionDigits={3}
                            onValueChange={setLineLossPct}
                            className="w-16 h-8 border-b border-slate-200 bg-transparent px-1 py-0 text-sm text-right outline-none focus:border-slate-700 transition-colors"
                        />
                        <span className="text-[11px] text-slate-400">%</span>
                    </div>
                ) : null}
                <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${hasPendingChanges() ? "bg-amber-400" : "bg-emerald-400"}`}
                    title={hasPendingChanges() ? "Alterações pendentes" : "Salvo"}
                />
            </div>
            <div className="space-y-0.5 text-[11px] text-slate-400">
                <div className="flex items-center justify-between gap-3">
                    <span>Qtd bruta</span>
                    <span className="font-medium text-slate-600">{formatDecimalPlaces(Number(grossQty || 0), 4)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span>Custo total</span>
                    <span className={cn("font-medium", Number(line.lastTotalCostAmount || 0) <= 0 ? "text-slate-400" : "text-slate-600")}>
                        {formatMoney(Number(line.lastTotalCostAmount || 0), 4)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span>Custo médio</span>
                    <span className="font-medium text-slate-600">{formatMoney(Number(line.avgTotalCostAmount || 0), 4)}</span>
                </div>
            </div>
            </div>
        </fetcher.Form>
    )
}

export function IngredientUnitEditor({
    recipeId,
    section,
    recipeIngredientId,
    currentUnit,
    options,
}: {
    recipeId: string
    section: RecipeSection
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
        formData.set("tab", section)
        formData.set("recipeIngredientId", recipeIngredientId || "")
        formData.set("lineUnit", nextUnit)
        formData.set("_action", "recipe-ingredient-unit-update")
        fetcher.submit(formData, { method: "post", action: ".." })
    }

    return (
        <Select value={unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-8 w-20 text-sm border-slate-200">
                <SelectValue placeholder="UM" />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export function IngredientLossEditor({
    recipeId,
    section,
    recipeIngredientId,
    defaultLossPct,
}: {
    recipeId: string
    section: RecipeSection
    recipeIngredientId: string | null
    defaultLossPct: number
}) {
    const [lossPct, setLossPct] = useState(Number(defaultLossPct || 0))

    useEffect(() => {
        setLossPct(Number(defaultLossPct || 0))
    }, [defaultLossPct, recipeIngredientId])

    return (
        <Form method="post" action="..">
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="tab" value={section} />
            <input type="hidden" name="recipeIngredientId" value={recipeIngredientId || ""} />
            <input type="hidden" name="defaultLossPct" value={String(lossPct)} />
            <input type="hidden" name="_action" value="recipe-ingredient-loss-update" />
            <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-0.5">
                <DecimalInput
                    name="defaultLossPctInput"
                    defaultValue={Number(defaultLossPct || 0)}
                    fractionDigits={3}
                    onValueChange={setLossPct}
                    className="w-20 h-8 border-b border-slate-200 bg-transparent px-1 py-0 text-sm text-right outline-none focus:border-slate-700 transition-colors"
                />
                <span className="text-[11px] text-slate-400">%</span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    type="submit"
                    name="applyToLines"
                    value="no"
                    className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Salvar perda padrão"
                    aria-label="Salvar perda padrão"
                >
                    <Check size={11} />
                </button>
                <button
                    type="submit"
                    name="applyToLines"
                    value="yes"
                    className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Aplicar para todas as variações"
                    aria-label="Aplicar para todas as variações"
                >
                    <RefreshCw size={11} />
                </button>
            </div>
            </div>
        </Form>
    )
}


export type AdminRecipeOutletContext = {
    recipe: Recipe
    items: Array<{ id: string; name: string; classification?: string | null; consumptionUm?: string | null }>
    recipeLines: any[]
    chatGptProjectUrl: string
    linkedVariations: Array<{
        itemVariationId: string
        variationId: string | null
        variationName: string | null
        variationKind?: string | null
        variationCode?: string | null
        isReference?: boolean
    }>
}

const recipeNavigation: Array<{ name: string; key: string; to: (recipeId: string) => string }> = [
    { name: "Cadastro", key: "cadastro", to: (recipeId) => buildRecipeSectionHref(recipeId, "cadastro") },
    { name: "Composição", key: "composicao", to: (recipeId) => buildRecipeSectionHref(recipeId, "composicao") },
    { name: "Variações", key: "variacoes", to: (recipeId) => buildRecipeSectionHref(recipeId, "variacoes") },
    { name: "Assistente", key: "composition-builder", to: (recipeId) => `/admin/recipes/${recipeId}/composition-builder` },
]

export default function AdminRecipeDetailLayout() {
    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const location = useLocation()

    const recipe = loaderData?.payload?.recipe as Recipe
    const items = (loaderData?.payload?.items || []) as AdminRecipeOutletContext["items"]
    const recipeLines = (loaderData?.payload?.recipeLines || []) as AdminRecipeOutletContext["recipeLines"]
    const chatGptProjectUrl = String(loaderData?.payload?.chatGptProjectUrl || DEFAULT_RECIPE_CHATGPT_PROJECT_URL)
    const linkedVariations = (loaderData?.payload?.linkedVariations || []) as AdminRecipeOutletContext["linkedVariations"]
    const linkedItem = items.find((item) => item.id === recipe?.itemId)
    const recipeLineCount = recipeLines.length
    const avgCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.avgTotalCostAmount || 0), 0)
    const lastCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.lastTotalCostAmount || 0), 0)
    const lastSegment = lastUrlSegment(location.pathname)
    const activeTab = lastSegment === "composition-builder"
        ? "composition-builder"
        : resolveRecipeSection(lastSegment)

    useEffect(() => {
        if (actionData?.status === 200) {
            toast({ title: "Ok", description: actionData.message })
        }
        if (actionData?.status && actionData.status >= 400) {
            toast({ title: "Erro", description: actionData.message, variant: "destructive" })
        }
    }, [actionData])

    if (!recipe) {
        const message = loaderData?.message || "Nao foi possivel carregar a receita."
        return <div className="p-4 text-sm text-muted-foreground">{message}</div>
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="pb-2">
                <Link to="/admin/recipes" className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700">
                    <ChevronLeft size={13} />
                    Receitas
                </Link>
                <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-bold leading-tight text-slate-900">{recipe.name}</h1>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${recipe.type === "pizzaTopping"
                                ? "bg-orange-50 text-orange-700 ring-orange-200"
                                : "bg-blue-50 text-blue-700 ring-blue-200"
                                }`}>
                                {recipe.type === "pizzaTopping" ? "Sabor Pizza" : "Produzido"}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span>
                                <span className="text-slate-400">Item:</span>{" "}
                                {linkedItem ? (
                                    <Link
                                        to={`/admin/items/${linkedItem.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-sky-700 underline-offset-2 hover:underline"
                                    >
                                        {linkedItem.name}
                                    </Link>
                                ) : (
                                    <span className="font-medium text-slate-700 italic">Não vinculado</span>
                                )}
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

            <div className="h-full w-full">
                <div style={{ minWidth: "100%", display: "table" }}>
                    <div className="flex justify-between">
                        <div className="flex items-center">
                            {recipeNavigation.map((navItem) => (
                                <MenuItemNavLink
                                    key={navItem.key}
                                    to={navItem.to(recipe.id)}
                                    isActive={activeTab === navItem.key}
                                >
                                    {navItem.name}
                                </MenuItemNavLink>
                            ))}
                        </div>
                    </div>
                </div>
                <Separator className="my-4" />
            </div>

            <Outlet
                context={{
                    recipe,
                    items,
                    recipeLines,
                    chatGptProjectUrl,
                    linkedVariations,
                }}
            />
        </div>
    )
}
