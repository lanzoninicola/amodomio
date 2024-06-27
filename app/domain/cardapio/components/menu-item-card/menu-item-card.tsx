import { Category } from "@prisma/client"
import { useOutletContext, useSearchParams } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items"
import MenuItemForm from "../menu-item-form/menu-item-form"
import { MenuItemWithAssociations } from "~/domain/menu-item/menu-item.prisma.entity.server"
import { AdminCardapioOutletContext } from "~/routes/admin.gerenciamento.cardapio"
import MenuItemPriceVariationForm, { mapPriceVariationsLabel } from "../menu-item-price-variation-form/menu-item-price-variation-form"
import { Switch } from "~/components/ui/switch"
import { useState } from "react"
import { cn } from "~/lib/utils"
import { OveredPoint } from "../menu-item-list/menu-item-list"


interface MenuItemCardProps {
    item: MenuItemWithAssociations
    dragAndDrop?: {
        itemDragging: MenuItemWithAssociations | null
        itemOvered: MenuItemWithAssociations | null
        overedPoint: OveredPoint
    }
}

export default function MenuItemCard({ item, dragAndDrop }: MenuItemCardProps) {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    const categories = outletContext.categories as Category[]

    // const missingInfo = !item?.name || !item?.ingredients

    // const [searchParams, setSearchParams] = useSearchParams()
    // const action = searchParams.get("_action")



    return (

        <div className={
            cn(
                "my-2",
                dragAndDrop?.itemOvered?.id === item.id && "border-t-red-500"
            )
        }
            draggable={true}
        >

            <div className={
                cn(
                    "p-4 rounded-md border border-gray-200 bg-white",
                    // itemDragging === item.id && "border-2 border-dashed border-blue-500"
                    dragAndDrop?.itemDragging?.id === item.id && "border-2 border-dashed border-blue-500",
                )
            }>
                {/* <SortingOrderItems enabled={action === "menu-items-sortorder"} itemId={item.id} groupId={pizzaCategory?.id}> */}
                <MenuItemForm item={item} action="menu-item-update" className={
                    cn(
                        "flex flex-col gap-2",
                        dragAndDrop?.itemDragging?.id === item.id && "opacity-20"
                    )
                } />
                {/* </SortingOrderItems> */}
            </div>
        </div>

    )
}


interface MissingInfoAlertProps {
    item: MenuItemWithAssociations
}

function MissingInfoAlert({ item }: MissingInfoAlertProps) {
    return (
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
    )
}