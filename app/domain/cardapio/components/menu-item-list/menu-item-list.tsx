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
    dragEnable: boolean
}

export type OveredPoint = "none" | "top" | "bottom"



export default function MenuItemList({ items, setItems, dragEnable }: MenuItemListProps) {

    if (!items || items.length === 0) {
        return <NoRecordsFound text="Nenhum item encontrado" cnClassName="mt-12" />
    }

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
        <ul className="flex flex-col gap-y-4 mt-6" data-element="menu-item-list">
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
    );
}

