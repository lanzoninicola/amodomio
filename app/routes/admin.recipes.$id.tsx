import { Category, Recipe, RecipeType } from "@prisma/client";
import { redirect, type ActionArgs, type LoaderArgs } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { Save } from "lucide-react";
import { useState } from "react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import SelectRecipeType from "~/domain/recipe/components/select-recipe-type/select-recipe-type";
import { recipeEntity } from "~/domain/recipe/recipe.entity";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import type { HttpResponse } from "~/utils/http-response.server";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import { lastUrlSegment, urlAt } from "~/utils/url";

export interface RecipeOutletContext {
    recipe: Recipe | null
    categories: Category[] | null
}


export async function loader({ request, params }: LoaderArgs) {
    const recipeId = params?.id

    if (!recipeId) {
        return null
    }

    const recipe = await recipeEntity.findById(recipeId)

    if (!recipe) {
        return badRequest({ message: "Receita não encontrado" })
    }

    let categories = null

    if (recipe?.id) {
        categories = await categoryPrismaEntity.findAll()
    }


    return ok({
        recipe,
        categories,
    })

}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "recipe-update") {
        const recipe = await recipeEntity.findById(values?.recipeId as string)

        const nextRecipe = {
            ...recipe,
            name: values.name as string,
            type: values.type as RecipeType,
            description: values?.description as string || "",
            hasVariations: values.hasVariations === "on" ? true : false,
            isGlutenFree: values.isGlutenFree === "on" ? true : false,
            isVegetarian: values.isVegetarian === "on" ? true : false,
        }
        delete nextRecipe.id

        const [err, data] = await prismaIt(recipeEntity.update(values.recipeId as string, {
            ...recipe,
            ...nextRecipe
        }))

        if (err) {
            return badRequest(err)
        }

        return redirect(`/admin/recipes/${values.recipeId}/ingredients`)
    }

    return null
}


export default function SingleRecipe() {
    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()

    const recipe = loaderData?.payload?.recipe as Recipe
    const categories = loaderData?.payload?.categories as Category[]

    const recipeId = recipe?.id

    const activeTabStyle = "bg-white text-black font-semibold rounded-md py-1"

    const actionData = useActionData<typeof action>()

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    return (
        <>

            <RecipeForm recipe={recipe} actionName="recipe-update" />
            <div className="grid grid-cols-2 grid-rows-3 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-6 h-20
                                md:grid-cols-2 md:grid-rows-1 md:h-10
                            ">
                <Link to={`/admin/recipes/${recipeId}/ingredients`} className="w-full text-center">
                    <div className={
                        cn(
                            activeTab === "ingredients" && activeTabStyle,
                        )
                    }>
                        <span>Ingredientes</span>
                    </div>
                </Link >
            </div >

            <Outlet context={{ recipe, categories }} />
        </>
    )
}
