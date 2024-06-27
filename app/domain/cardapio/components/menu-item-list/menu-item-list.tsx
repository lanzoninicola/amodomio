import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found"
import { MenuItemActionSearchParam } from "~/routes/admin.gerenciamento.cardapio._index"
import MenuItemCard from "../menu-item-card/menu-item-card"
import { Separator } from "~/components/ui/separator"
import { MenuItem } from "@prisma/client"
import { MenuItemWithAssociations } from "~/domain/menu-item/menu-item.prisma.entity.server"
import { useState } from "react"
import { useSubmit } from "@remix-run/react"

interface MenuItemListProps {
    items: MenuItemWithAssociations[]
    action?: Partial<MenuItemActionSearchParam>
}

export type OveredPoint = "none" | "top" | "bottom"

export default function MenuItemList({ items, action }: MenuItemListProps) {

    if (!items || items.length === 0) {
        return <NoRecordsFound text="Nenhum item encontrado" />
    }

    const submit = useSubmit()

    // the item you are dragging
    const [itemDragging, setItemDragging] = useState<MenuItemWithAssociations | null>(null)
    // the item you are overed
    const [itemOvered, setItemOvered] = useState<MenuItemWithAssociations | null>(null)

    const [overedPoint, setOveredPoint] = useState<OveredPoint>("none")




    return (
        <ul className="flex flex-col">

            {
                items.map(item => {
                    return (
                        <li key={item.id} onDragStart={e => {
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


                                    if (!itemOvered) return
                                    if (itemDragging === null) return
                                    if (itemOvered.id === itemDragging.id) return
                                    if (overedPoint === "none") return

                                    submit(
                                        {
                                            action: "menu-item-move",
                                            itemDraggingId: itemDragging?.id || "",
                                            itemOveredId: itemOvered?.id || "",
                                            overedPoint
                                        },
                                        { method: "post" }
                                    );

                                    setOveredPoint("none")


                                }
                            }>
                            <MenuItemCard item={item} dragAndDrop={{
                                itemDragging,
                                itemOvered,
                                overedPoint
                            }} />
                        </li>
                    )
                })
            }

        </ul>
    )
}

