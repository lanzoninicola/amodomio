import { Category, MenuItem } from "@prisma/client"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items"
import { Separator } from "~/components/ui/separator"
import { loader } from "~/routes/admin.gerenciamento.cardapio._index"
import MenuItemForm from "../menu-item-form/menu-item-form"


interface MenuItemCardProps {
    item: MenuItem
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]


    const pizzaCategory = categories.find(category => category.id === item.categoryId)

    const missingInfo = !item?.name || !item?.ingredients


    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")

    return (

        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2`}>
            <SortingOrderItems enabled={action === "menu-items-sortorder"} itemId={item.id} groupId={pizzaCategory?.id}>

                <MenuItemForm item={item} action="menu-item-update" />

                {missingInfo && item.visible === true && (
                    <div className=" bg-orange-100 rounded-md py-2 px-4 mt-4">
                        <div className="flex gap-2 items-center">
                            <AlertCircle color="orange" size={16} />
                            <div className="flex flex-col gap-1">
                                {(item?.name === undefined || item.name === "") && <span className="text-xs font-semibold text-orange-500">Nome não cadastrado</span>}
                                {/* {(item?.prices === undefined || item.prices.length === 0) && <span className="text-xs font-semibold text-orange-500">Preço não cadastrado</span>} */}
                                {(item?.ingredients === undefined || item.ingredients.length === 0) && <span className="text-xs font-semibold text-orange-500">Ingredientes não cadastrados</span>}
                            </div>

                        </div>
                    </div>
                )}
            </SortingOrderItems>
        </div>

    )
}




