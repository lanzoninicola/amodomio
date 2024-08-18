import { RecipeType } from "@prisma/client";
import { ActionFunctionArgs, redirect } from "@remix-run/node";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import { recipeEntity } from "~/domain/recipe/recipe.entity";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { serverError, ok } from "~/utils/http-response.server";

export async function action({ request, params }: ActionFunctionArgs) {
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

        return redirect(`/admin/recipes/${data.id}`)
    }

    return null
}


export default function AdminRecipesNew() {
    return (
        <RecipeForm actionName="recipe-create" />
    )
}