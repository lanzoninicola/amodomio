import { RecipeType } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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

        const [err, data] = await prismaIt(recipeEntity.create({
            name: values.name as string,
            type: values.type as RecipeType,
            description: values?.description as string || "",
            hasVariations: values.hasVariations === "on" ? true : false,
            isGlutenFree: values.isGlutenFree === "on" ? true : false,
            isVegetarian: values.isVegetarian === "on" ? true : false,
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
    const loaderData = useLoaderData<typeof loader>() as any
    const items = (loaderData?.payload?.items || []) as Array<{ id: string; name: string }>
    const variations = (loaderData?.payload?.variations || []) as Array<{ id: string; name: string; kind?: string | null }>

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle>Nova receita</CardTitle>
            </CardHeader>
            <CardContent>
                <RecipeForm
                    actionName="recipe-create"
                    items={items}
                    variations={variations}
                />
            </CardContent>
        </Card>
    )
}
