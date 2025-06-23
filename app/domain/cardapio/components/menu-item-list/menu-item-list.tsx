import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found"

import MenuItemCard from "../menu-item-card/menu-item-card"
import { useState } from "react"
import { useFetcher } from "@remix-run/react"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { GripVertical } from "lucide-react"
import { cn } from "~/lib/utils"
import { Separator } from "~/components/ui/separator"
import { MenuItemGroup } from "@prisma/client"
import { Category } from "~/domain/category/category.model.server"

interface MenuItemListProps {
    items: MenuItemWithAssociations[]
    setItems: (items: MenuItemWithAssociations[]) => void
}

export type OveredPoint = "none" | "top" | "bottom"



export default function MenuItemList({ items, setItems }: MenuItemListProps) {

    if (!items || items.length === 0) {
        return <NoRecordsFound text="Nenhum item encontrado" cnClassName="mt-12" />
    }

    const [dragEnable, setDragEnabled] = useState(false)

    const [draggingItemIndex, setDraggingItemIndex] = useState<number | null>(null);
    const fetcher = useFetcher();

    const handleDragStart = (index: number) => {
        setDraggingItemIndex(index);
    };

    const handleDragOver = (event: React.DragEvent<HTMLLIElement>, index: number) => {
        event.preventDefault();
        if (draggingItemIndex === index) return;

        const updatedItems = [...items];
        const [draggedItem] = updatedItems.splice(draggingItemIndex!, 1);
        updatedItems.splice(index, 0, draggedItem);
        setDraggingItemIndex(index);
        setItems(updatedItems);
    };

    const handleDragEnd = () => {
        setDraggingItemIndex(null);

        // Update the database
        fetcher.submit(
            {
                action: "menu-item-move",
                items: JSON.stringify(items.map((item, index) => ({ ...item, index })))
            },
            { method: 'post' }
        );
    };


    return (
        <div className="flex flex-col">


            <div className="md:p-4 items-center col-span-3 md:col-span-2">
                <p className="text-sm cursor-pointer hover:underline text-muted-foreground leading-tight"
                    onClick={() => setDragEnabled(!dragEnable)}
                >{dragEnable === true ? 'Desabilitar ordernamento' : 'Abilitar ordenamento'}</p>
            </div>

            <Separator className="my-4" />
            <ul className="flex flex-col gap-y-4">
                {items.map((item, index) => (
                    <li
                        key={item.id}
                        draggable={dragEnable}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(event) => handleDragOver(event, index)}
                        onDragEnd={handleDragEnd}
                        className={
                            cn(
                                dragEnable === true && "p-2 m-1 bg-muted rounded-sm"
                            )
                        }
                    >
                        <div className="flex gap-4 items-center w-full">
                            {dragEnable === true && <GripVertical className="cursor-grab" />}
                            <MenuItemCard item={item} />
                        </div>

                    </li>
                ))}
            </ul>
        </div>
    );
}

