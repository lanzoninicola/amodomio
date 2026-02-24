import { Recipe } from "@prisma/client"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, Form, useActionData, Link } from "@remix-run/react"
import { useState } from "react"
import { EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { toast } from "~/components/ui/use-toast"
import RecipeBadge from "~/domain/recipe/components/recipe-badge/recipe-badge"
import { recipeEntity } from "~/domain/recipe/recipe.entity.server"
import { Search } from "lucide-react"

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

        const [err] = await tryit(recipeEntity.delete(values.id as string))

        if (err) {
            return serverError(err)
        }

        return ok({ message: "Receita deletada com sucesso" })
    }

    return null
}



export default function RecipesIndex() {
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
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receitas</div>
                    <div className="text-2xl font-black text-slate-900 tabular-nums">{recipesFilteredBySearch.length}</div>
                    <div className="text-xs text-slate-500">itens encontrados</div>
                </div>

                <div className="flex w-full md:w-auto items-center gap-2">
                    <RecipesSearch onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value
                        setSearchTerm(value)
                    }} />
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
                <Table className="min-w-[760px]">
                    <TableHeader className="bg-slate-50/90">
                        <TableRow className="hover:bg-slate-50/90">
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Receita</TableHead>
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                            <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recipesFilteredBySearch.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={3} className="px-4 py-8 text-sm text-slate-500">
                                    Nenhuma receita encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            recipesFilteredBySearch.map((recipe) => <RecipeRow item={recipe} key={recipe.id} />)
                        )}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                    <span>0 of {recipesFilteredBySearch.length} row(s) selected.</span>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-slate-700">Rows per page</span>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{recipesFilteredBySearch.length || 0}</Badge>
                        <span className="text-xs font-semibold text-slate-900">Page 1 of 1</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface RecipeItemProps {
    item: Recipe
}

function RecipeRow({ item }: RecipeItemProps) {
    return (
        <TableRow className="border-slate-100 hover:bg-slate-50/50">
            <TableCell className="px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Link to={`/admin/recipes/${item.id}`} className="truncate font-semibold text-slate-900 hover:underline" title={item.name}>
                        {item.name}
                    </Link>
                    <span className="text-xs text-slate-500">ID: {item.id}</span>
                </div>
            </TableCell>
            <TableCell className="px-4 py-3">
                <RecipeBadge item={item} />
            </TableCell>
            <TableCell className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                    <EditItemButton to={`/admin/recipes/${item.id}`} />
                    <Form method="post">
                        <Input type="hidden" name="id" value={item.id} />
                        <DeleteItemButton actionName="recipe-delete" />
                    </Form>
                </div>
            </TableCell>
        </TableRow>
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
        <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input type="text" name="search" placeholder="Buscar receita..." className="w-full pl-9" {...props} />
        </div>
    )
}
