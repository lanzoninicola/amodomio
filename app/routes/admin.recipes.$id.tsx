import { Recipe, RecipeType } from "@prisma/client";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { toast } from "~/components/ui/use-toast";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
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
        const [items, variations, recipeLines] = await Promise.all([
            db.item.findMany({
                where: { active: true },
                select: { id: true, name: true, consumptionUm: true },
                orderBy: [{ name: "asc" }],
                take: 500,
            }),
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
        ])

        return ok({
            recipe,
            items,
            variations,
            recipeLines,
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
        const variationId = String(values.lineVariationId || "").trim() || null
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

    const recipe = loaderData?.payload?.recipe as Recipe
    const items = (loaderData?.payload?.items || []) as Array<{ id: string; name: string; consumptionUm?: string | null }>
    const variations = (loaderData?.payload?.variations || []) as Array<{ id: string; name: string; kind?: string | null }>
    const recipeLines = (loaderData?.payload?.recipeLines || []) as any[]
    const actionData = useActionData<typeof action>()
    const linkedItem = items.find((item) => item.id === recipe?.itemId)
    const linkedVariation = variations.find((variation) => variation.id === (recipe as any)?.variationId)
    const recipeLineCount = recipeLines.length
    const avgCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.avgTotalCostAmount || 0), 0)
    const lastCompositionCost = recipeLines.reduce((acc, line) => acc + Number(line.lastTotalCostAmount || 0), 0)
    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <Link to="/admin/recipes" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                            <ChevronLeft size={14} />
                            Voltar para receitas
                        </Link>
                        <h1 className="mt-2 text-xl font-semibold leading-tight text-slate-900">{recipe?.name}</h1>
                        <p className="mt-1 break-all text-xs text-slate-500">{recipe?.id}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:min-w-[320px]">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tipo</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                                {recipe?.type === "pizzaTopping" ? "Sabor Pizza" : "Produzido"}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Itens na composição</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{recipeLineCount}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Custo médio</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">R$ {avgCompositionCost.toFixed(4)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Último custo</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">R$ {lastCompositionCost.toFixed(4)}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Form method="post">
                        <input type="hidden" name="recipeId" value={recipe?.id} />
                        <Button type="submit" name="_action" value="recipe-lines-recalc" className="h-9">
                            Recalcular custos
                        </Button>
                    </Form>
                    <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" className="h-9">
                                Duplicar para outra variação
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Duplicar receita para outra variação</DialogTitle>
                                <DialogDescription>
                                    Cria uma nova receita copiando a composição e ajustando as quantidades por fator (multiplica ou divide).
                                </DialogDescription>
                            </DialogHeader>
                            <Form method="post" className="grid gap-3 md:grid-cols-4">
                                <input type="hidden" name="recipeId" value={recipe?.id} />
                                <div className="md:col-span-2">
                                    <label htmlFor="duplicateVariationId" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variação destino</label>
                                    <select id="duplicateVariationId" name="duplicateVariationId" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required>
                                        <option value="">Selecionar variação</option>
                                        {variations.map((variation) => (
                                            <option key={variation.id} value={variation.id}>
                                                {variation.name}{variation.kind ? ` (${variation.kind})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="duplicateFactorMode" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Operação</label>
                                    <select id="duplicateFactorMode" name="duplicateFactorMode" defaultValue="multiply" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                                        <option value="multiply">Multiplica (x)</option>
                                        <option value="divide">Divide (/)</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="duplicateFactorValue" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Fator</label>
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
                <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                        Item: {linkedItem?.name || "Não vinculado"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                        Variação: {linkedVariation ? `${linkedVariation.name}${linkedVariation.kind ? ` (${linkedVariation.kind})` : ""}` : "Base/sem vínculo"}
                    </span>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Configuração da receita</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Atualize nome, vínculo com item/variação e atributos da receita.
                    </p>
                </div>
                <RecipeForm
                    recipe={recipe}
                    actionName="recipe-update"
                    items={items}
                    variations={variations}
                />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Composição da receita</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            A composição desta receita deve ser cadastrada nesta área (itens, unidade de consumo e quantidade). As fichas de custo do item apenas consomem receitas e outros custos.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <span className="font-semibold">{recipeLineCount}</span> item(ns)
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            Custo médio: <span className="font-semibold">R$ {avgCompositionCost.toFixed(4)}</span>
                        </div>
                    </div>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold text-slate-900">Adicionar item à composição</h3>
                        <p className="text-xs text-slate-500">Informe item, variação (opcional), unidade de consumo e quantidade.</p>
                    </div>
                    <Form method="post" className="grid gap-3 md:grid-cols-5">
                        <input type="hidden" name="recipeId" value={recipe?.id} />
                        <div className="md:col-span-2">
                            <label htmlFor="lineItemId" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Item</label>
                            <select id="lineItemId" name="lineItemId" required className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                                <option value="">Selecionar item</option>
                                {items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="lineVariationId" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variação</label>
                            <select id="lineVariationId" name="lineVariationId" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                                <option value="">Base/auto</option>
                                {variations.map((variation) => (
                                    <option key={variation.id} value={variation.id}>
                                        {variation.name}{variation.kind ? ` (${variation.kind})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="lineUnit" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">UM consumo</label>
                            <input id="lineUnit" name="lineUnit" placeholder="UN / G / ML" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                        </div>
                        <div>
                            <label htmlFor="lineQuantity" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade</label>
                            <input id="lineQuantity" name="lineQuantity" type="number" min="0.0001" step="0.0001" placeholder="0" className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required />
                        </div>
                        <div className="md:col-span-5 flex justify-end">
                            <button
                                type="submit"
                                name="_action"
                                value="recipe-line-add"
                                className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                                Adicionar item da composição
                            </button>
                        </div>
                    </Form>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Variação</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Editar (UM/Qtd)</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd salva</th>
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
                                    <td colSpan={9} className="px-3 py-8 text-center">
                                        <div className="mx-auto max-w-md rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-slate-600">
                                            <p className="text-sm font-medium text-slate-700">Nenhum item na composição</p>
                                            <p className="mt-1 text-xs">Use o formulário acima para adicionar o primeiro ingrediente/item.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                recipeLines.map((line) => (
                                    <tr key={line.id} className="border-t border-slate-100">
                                        <td className="px-3 py-2">{line.Item?.name || "-"}</td>
                                        <td className="px-3 py-2 text-slate-600">{line.ItemVariation?.Variation?.name || "Base/auto"}</td>
                                        <td className="px-3 py-2">
                                            <Form method="post" className="flex items-center justify-end gap-2">
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
                                                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    Salvar
                                                </button>
                                            </Form>
                                        </td>
                                        <td className="px-3 py-2 text-right">{Number(line.quantity || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right">R$ {Number(line.lastUnitCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right">R$ {Number(line.avgUnitCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right">R$ {Number(line.lastTotalCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right">R$ {Number(line.avgTotalCostAmount || 0).toFixed(4)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <Form method="post" className="inline">
                                                <input type="hidden" name="recipeId" value={recipe?.id} />
                                                <input type="hidden" name="recipeLineId" value={line.id} />
                                                <button
                                                    type="submit"
                                                    name="_action"
                                                    value="recipe-line-delete"
                                                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
