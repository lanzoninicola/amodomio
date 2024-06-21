import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found"
import { MenuItem } from "~/domain/menu-item/menu-item.model.server"
import { MenuItemActionSearchParam } from "~/routes/admin.cardapio._index"
import MenuItemCard from "../menu-item-card/menu-item-card"
import { Separator } from "~/components/ui/separator"

interface MenuItemListProps {
    items: MenuItem[]
    action: Partial<MenuItemActionSearchParam>
}

export default function MenuItemList({ items, action }: MenuItemListProps) {
    if (action === "menu-item-edit" || action === "menu-item-create") return null

    return (
        <ul className="flex flex-col">
            {
                (!items || items.length === 0) ?
                    <NoRecordsFound text="Nenhum itens no menu" />
                    :
                    items.map(item => {
                        return (
                            <li key={item.id} className="mb-4">
                                <MenuItemCard item={item} />
                            </li>
                        )
                    })
            }
        </ul>
    )
}

