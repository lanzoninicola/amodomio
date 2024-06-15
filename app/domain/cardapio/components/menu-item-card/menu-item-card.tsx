import { Category } from "@prisma/client"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import { useState } from "react"
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items"
import { Badge } from "~/components/ui/badge"
import { Switch } from "~/components/ui/switch"
import { MenuItem } from "~/domain/menu-item/menu-item.model.server"
import { loader } from "~/routes/admin.cardapio._index"
import formatStringList from "~/utils/format-string-list"

interface MenuItemCardProps {
    item: MenuItem
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]


    const [showDetails, setShowDetails] = useState(false)

    const ingredientsString = item?.ingredients ? item.ingredients.join(", ") : "Nenhum ingrediente cadastrado"
    const ingredientsItaString = item?.ingredientsIta ? item.ingredientsIta.join(", ") : "Nenhum ingrediente cadastrado"
    const pizzaTitle = item?.name || "Nenhum nome cadastrado"

    const pizzaCategory = categories.find(category => category.id === item.category?.id)

    const missingInfo = !item?.name || !item?.price || !item?.ingredients || !item?.ingredientsIta


    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")

    return (

        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2`}>
            <SortingOrderItems enabled={action === "menu-items-sortorder"} itemId={item.id} groupId={pizzaCategory?.id}>
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold tracking-tight">{pizzaTitle}</h2>
                        {/* <Link to={`?_action=menu-item-edit&id=${item.id}&categoryId=${pizzaCategory?.id}`} > */}
                        <Link to={item.id as string} >
                            <span className="underline">Editar</span>
                        </Link>
                    </div>
                    <Badge className="w-max">{pizzaCategory?.name}</Badge>
                    <div className="flex justify-between w-full">
                        <span className="font-semibold text-sm">Pública no cardápio</span>
                        <Switch id="visible" name="visible" defaultChecked={item.visible} disabled />
                    </div>
                </div>
                <div>
                    <span className="text-sm">{formatStringList(item?.ingredients)}</span>
                </div>

                <div>

                    <span className="text-xs underline" onClick={() => setShowDetails(!showDetails)}>Detalhes</span>
                    {
                        showDetails && (
                            <div className="mt-4">
                                {/* <p className="text-gray-500">{item.description}</p> */}
                                <div className="flex flex-col mb-2">
                                    <span className="font-semibold text-sm">Preço:</span>
                                    <div className="flex gap-2">
                                        <span className="text-gray-500 text-sm">R$</span>
                                        <p className="text-gray-500 text-sm">{item.price}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 mb-2">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">Ingredientes</span>
                                        <p className="text-gray-500 text-sm">{ingredientsString}</p>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">Ingredientes em Italiano</span>
                                        <p className="text-gray-500 text-sm">{ingredientsItaString}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>

                {missingInfo && item.visible === true && (
                    <div className="border-2 border-red-500 bg-red-200 rounded-md p-4 mt-4">
                        <div className="flex gap-2">
                            <AlertCircle color="red" />
                            <div className="flex flex-col gap-1">
                                {(item?.name === undefined || item.name === "") && <span className="text-xs font-semibold text-red-500">Nome não cadastrado</span>}
                                {(item?.price === undefined || item.price === "") && <span className="text-xs font-semibold text-red-500">Preço não cadastrado</span>}
                                {(item?.ingredients === undefined || item.ingredients.length === 0) && <span className="text-xs font-semibold text-red-500">Ingredientes não cadastrados</span>}
                                {(item?.ingredientsIta === undefined || item.ingredientsIta.length === 0) && <span className="text-xs font-semibold text-red-500">Ingredientes em Italiano não cadastrados</span>}
                            </div>

                        </div>
                    </div>
                )}
            </SortingOrderItems>
        </div>

    )
}