import { RecipeType } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { ok, serverError } from "~/utils/http-response.server";

export async function loader({}: LoaderFunctionArgs) {
    try {
        const db = prismaClient as any
        const [items, variations] = await Promise.all([
            db.item.findMany({
                where: { active: true },
                select: { id: true, name: true },
                orderBy: [{ name: "asc" }],
                take: 500,
            }),
            db.variation.findMany({
                where: { deletedAt: null },
                select: { id: true, name: true, kind: true },
                orderBy: [{ kind: "asc" }, { name: "asc" }],
                take: 200,
            }),
        ])

        return ok({
            items,
            variations,
        })
    } catch (error) {
        return serverError(error)
    }
}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "recipe-create") {
        const recipeType = ((values.type as RecipeType) || RecipeType.semiFinished)

        const [err, data] = await prismaIt(recipeEntity.create({
            name: values.name as string,
            type: recipeType,
            description: values?.description as string || "",
            hasVariations: false,
            isGlutenFree: values.isGlutenFree === "on" ? true : false,
            isVegetarian: values.isVegetarian === "on" ? true : false,
            createdAt: new Date(),
        }))

        if (err) {
            return serverError(err)
        }

        try {
            const db = prismaClient as any
            const isSemiFinished = data.type === "semiFinished"
            const explicitItemId = String(values.linkedItemId || "").trim()

            let item = explicitItemId
                ? await db.item.findUnique({ where: { id: explicitItemId } })
                : await db.item.findFirst({
                    where: { name: data.name },
                    orderBy: { updatedAt: "desc" }
                })

            if (!item) {
                item = await db.item.create({
                    data: {
                        name: data.name,
                        description: data.description || null,
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

            await db.recipe.update({
                where: { id: data.id },
                data: {
                    itemId: item.id,
                    variationId: String(values.linkedVariationId || "").trim() || null,
                }
            })
        } catch (_error) {
            // best effort: keep old flow working even if `items` or `recipes.item_id` migration is pending
        }

        return redirect(`/admin/recipes/${data.id}`)
    }

    return null
}


export default function AdminRecipesNew() {
    const actionData = useActionData<typeof action>() as any
    const loaderData = useLoaderData<typeof loader>() as any
    const items = (loaderData?.payload?.items || []) as Array<{ id: string; name: string }>
    const variations = (loaderData?.payload?.variations || []) as Array<{ id: string; name: string; kind?: string | null }>
    const hasError = Number(actionData?.status || 0) >= 400
    const errorMessage = actionData?.message || "Erro ao salvar receita"
    const errorDetails =
        typeof actionData?.payload === "string"
            ? actionData.payload
            : actionData?.payload
                ? JSON.stringify(actionData.payload, null, 2)
                : ""

    return (
        <section className="space-y-4">
            {hasError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-900">
                    <p className="text-sm font-semibold">Erro ao salvar receita</p>
                    <p className="mt-1 text-sm">{errorMessage}</p>
                    {errorDetails ? (
                        <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-medium text-red-800">
                                Ver detalhes técnicos
                            </summary>
                            <pre className="mt-2 max-h-56 overflow-auto rounded border border-red-200 bg-white p-2 text-xs text-red-900 whitespace-pre-wrap">
                                {errorDetails}
                            </pre>
                        </details>
                    ) : null}
                </div>
            ) : null}
            <RecipeForm
                title="Nova receita"
                actionName="recipe-create"
                items={items}
                variations={variations}
            />
        </section>
    )
}
