import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found"
import { MenuItemActionSearchParam } from "~/routes/admin.gerenciamento.cardapio._index"
import MenuItemCard from "../menu-item-card/menu-item-card"
import { Separator } from "~/components/ui/separator"
import { MenuItem } from "@prisma/client"
import { MenuItemWithAssociations } from "~/domain/menu-item/menu-item.prisma.entity.server"

interface MenuItemListProps {
    items: MenuItemWithAssociations[]
    action?: Partial<MenuItemActionSearchParam>
}

export default function MenuItemList({ items, action }: MenuItemListProps) {

    if (!items || items.length === 0) {
        return <NoRecordsFound text="Nenhum item encontrado" />
    }


    return (
        <ul className="flex flex-col gap-4">
            {
                items.map(item => <MenuItemCard key={item.id} item={item} />)
            }
        </ul>
    )
}

