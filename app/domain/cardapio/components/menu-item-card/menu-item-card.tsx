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


interface MenuItemCardProps {
    item: MenuItemWithAssociations
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    const categories = outletContext.categories as Category[]

    // const missingInfo = !item?.name || !item?.ingredients

    // const [searchParams, setSearchParams] = useSearchParams()
    // const action = searchParams.get("_action")

    const [itemDragging, setItemDragging] = useState<MenuItemWithAssociations | null>(null)
    const [itemOvered, setItemOvered] = useState<MenuItemWithAssociations | null>(null)

    const [overedPoint, setOveredPoint] = useState<"none" | "top" | "bottom">("none")

    return (

        <li className="flex flex-col gap-2 bg-white"
            draggable={true}
            onDragStart={e => {
                // e.dataTransfer.setData("text/plain", item.id)
                setItemDragging(item)
            }}
            onDragOver={e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                // if it is the element itself overed return
                if (itemDragging !== null && item.id === itemDragging.id) return

                // track the item overed (the record contains also the position)
                setItemOvered(item)

                // detetermine if the element dragged is on top or bottom
                // of the element overed
                let rect = e.currentTarget.getBoundingClientRect();
                let midpoint = (rect.top + rect.bottom) / 2;
                setOveredPoint(e.clientY <= midpoint ? "top" : "bottom");



                console.log(item.name, item.menuIndex, overedPoint)
            }}
            onDragEnd={
                e => {
                    e.preventDefault()
                    setItemDragging(null)
                    setItemOvered(null)
                }
            }
        >


            <div className={
                cn(
                    "p-4 rounded-md border border-gray-200",
                    // itemDragging === item.id && "border-2 border-dashed border-blue-500"
                    itemDragging?.id === item.id && "border-2 border-dashed border-blue-500",
                    itemOvered?.id === item.id && overedPoint === "top" && "bg-red-400"
                )
            }>
                {/* <SortingOrderItems enabled={action === "menu-items-sortorder"} itemId={item.id} groupId={pizzaCategory?.id}> */}
                <MenuItemForm item={item} action="menu-item-update" className={
                    cn(
                        "flex flex-col gap-2",
                        itemDragging?.id === item.id && "opacity-20"
                    )
                } />
                {/* </SortingOrderItems> */}
            </div>
        </li>

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