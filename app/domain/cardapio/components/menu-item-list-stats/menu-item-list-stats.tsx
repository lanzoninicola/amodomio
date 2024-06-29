import { Separator } from "~/components/ui/separator";
import { MenuItem } from "~/domain/cardapio/menu-item.model.server";

export default function MenuItemListStat({ items }: { items: MenuItem[] }) {

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2">
                <div className="text-sm font-semibold text-muted-foreground">Totais pizzas</div>
                <div className="text-sm font-semibold">{items.length}</div>
            </div>
            <div className="grid grid-cols-2">
                <div className="text-sm font-semibold text-muted-foreground">Pizzas publicadas</div>
                <div className="text-sm font-semibold">{items.filter(i => i.visible === true).length}</div>
            </div>
            <Separator />
        </div>
    )
}