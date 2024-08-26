import { Recipe } from "@prisma/client"
import { Separator } from "@radix-ui/react-separator"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, Form, useActionData } from "@remix-run/react"
import { useState } from "react"
import Container from "~/components/layout/container/container"
import Badge from "~/components/primitives/badge/badge"
import { EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import RecipeBadge from "~/domain/recipe/components/recipe-badge/recipe-badge"
import { recipeEntity } from "~/domain/recipe/recipe.entity.server"
import { cn } from "~/lib/utils"

import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"


export async function loader({ request }: LoaderFunctionArgs) {

    const [err, recipes] = await tryit(recipeEntity.findAll())

    if (err) {
        return serverError(err)
    }

    return ok({ recipes })

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "recipe-delete") {

        const [err, data] = await tryit(recipeEntity.delete(values.id as string))

        if (err) {
            return serverError(err)
        }

        return ok({ message: "Produto deletado com sucesso" })
    }

    return null
}



export default function ProducstIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const recipes = loaderData?.payload.recipes as Recipe[]

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    const [searchTerm, setSearchTerm] = useState("")

    const recipesFilteredBySearch = recipes.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <Container>
            <div className="flex flex-col gap-2">
                <div data-element="filters" className="flex justify-between border rounded-md p-4 mb-2">

                    {/* <RecipesFilters /> */}

                    <RecipesSearch onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value
                        setSearchTerm(value)
                    }} />
                </div>

                <ul data-element="recipes" className="flex flex-col gap-4 md:grid md:grid-cols-3">
                    {
                        recipesFilteredBySearch.map(p => <RecipeItem item={p} key={p.id} />)
                    }
                </ul>
            </div>
        </Container>
    )
}

interface RecipeItemProps {
    item: Recipe
}

function RecipeItem({ item }: RecipeItemProps) {

    console.log({ recipe: item })

    return (
        <Form method="post"
            className="flex flex-col p-4
                                rounded-lg border border-muted hover:border-muted-foreground hover:cursor-pointer w-full">

            <div className="flex items-center justify-between w-full mb-4">
                <h3 className="text-md font-semibold tracking-tight">{item.name}</h3>
                <EditItemButton to={`/admin/recipes/${item.id}`} />
            </div>

            <RecipeBadge item={item} />
            <Separator className="mb-4" />

            <div className="flex gap-2 md:gap-2 justify-end">
                <DeleteItemButton actionName="recipe-delete" />
                <Input type="hidden" name="id" value={item.id} />
            </div>
        </Form>
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

function RecipesSearch({ ...props }) {
    return (
        <div className="flex gap-4">
            <Input type="text" name="search" placeholder="Buscar" className="w-full" {...props} />
        </div>
    )
}