import { Category, Recipe, RecipeType } from "@prisma/client";
import { redirect, type ActionArgs, type LoaderArgs } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { Save } from "lucide-react";
import { useState } from "react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import { toast } from "~/components/ui/use-toast";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
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


export async function loader({ request }: LoaderArgs) {
    const recipeId = urlAt(request.url, -1)

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

        const nextRecipe = { ...values }
        delete nextRecipe.recipeId

        const [err, data] = await prismaIt(recipeEntity.update(values.recipeId as string, {
            ...recipe,
            ...nextRecipe
        }))

        console.log({ err })

        if (err) {
            return badRequest(err)
        }

        return redirect(`/admin/recipes/${values.recipeId}`)
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

    // if (loaderData?.status >= 400) {
    //     toast({
    //         title: "Erro",
    //         description: loaderData?.message,
    //     })
    // }

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    return (
        <>
            <Form method="post">
                <input type="hidden" name="recipeId" value={recipe?.id} />
                <div className="mb-8">
                    <div className="flex flex-row mb-4 justify-end" >
                        <SaveItemButton actionName="recipe-update" label="Salvar" labelClassName="uppercase font-semibold tracking-wider text-xs" variant={"outline"} />
                    </div>
                    <div className="md:grid md:grid-cols-2 md:items-start flex flex-col gap-4 border rounded-md p-4 ">
                        <div className="flex flex-col gap-4">

                            <RecipeName name={recipe?.name} type={recipe?.type} />

                            <div className="flex flex-col gap-2">
                                <SelectRecipeType withLabel={true} type={recipe?.type} />
                                {/* <div className="flex gap-2 items-center">
                                <span className="text-sm">Categoria</span>
                                <SelectCategory categories={categories} />
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-sm">Sub-categoria</span>
                                <SelectCategory categories={categories} />
                            </div> */}
                            </div>

                        </div>
                    </div>
                </div>

            </Form>

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


function RecipeName({ type, name }: { type: RecipeType, name: string }) {

    return (
        <div className="flex gap-2 items-center">
            <span className="text-xl font-semibold text-muted-foreground">
                {type === "pizzaTopping" ? "Sabor:" : "Ricetta:"}
            </span>
            <InputItem className="text-xl font-semibold text-muted-foreground w-max" ghost={true}
                name="name"
                defaultValue={name}
            />
        </div>
    )
}