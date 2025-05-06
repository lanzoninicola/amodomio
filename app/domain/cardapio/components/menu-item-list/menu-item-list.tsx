import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found"

import MenuItemCard from "../menu-item-card/menu-item-card"
import { useState } from "react"
import { useFetcher } from "@remix-run/react"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { GripVertical } from "lucide-react"
import { cn } from "~/lib/utils"
import { Input } from "~/components/ui/input"
import OptionTab from "~/components/layout/option-tab/option-tab"
import { Separator } from "~/components/ui/separator"

interface MenuItemListProps {
    initialItems: MenuItemWithAssociations[]
}

export type OveredPoint = "none" | "top" | "bottom"

export default function MenuItemList({ initialItems }: MenuItemListProps) {

    if (!initialItems || initialItems.length === 0) {
        return <NoRecordsFound text="Nenhum item encontrado" />
    }

    const [items, setItems] = useState<any[]>(initialItems.filter(i => i.visible === true && i.active === true));
    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
        setSearch(value)
        if (!value) return setItems(initialItems)
        const searchedItems = initialItems
            .filter(item => item.name?.toLowerCase().includes(value.toLowerCase()) || item.ingredients?.toLowerCase().includes(value.toLowerCase()))
        setItems(searchedItems)
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

    const [optVisibleItems, setOptVisibleItems] = useState<boolean | null>(true)
    const [optActiveItems, setOptActiveItems] = useState<boolean | null>(null)

    const handleOptionVisibileItems = (state: boolean) => {
        setOptVisibleItems(state)
        setOptActiveItems(null)
        setItems(initialItems.filter(item => item.visible === state && item.active === true))
    }
    const handleOptionActiveItems = (state: boolean) => {
        setOptActiveItems(state)
        setOptVisibleItems(null)
        setItems(initialItems.filter(item => item.active === state))
    }


    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-8 items-center">
                <div className="p-4 items-center mb-2 col-span-2">
                    <span className="text-sm cursor-pointer hover:underline text-muted-foreground"
                        onClick={() => setDragEnabled(!dragEnable)}
                    >{dragEnable === true ? 'Desabilitar ordernamento' : 'Abilitar ordenamento'}</span>
                </div>

                <div className="items-center mb-2 col-span-6" >
                    <Input name="search" className="w-full" placeholder="Pesquisar..." onChange={(e) => handleSearch(e)} value={search} />
                </div>
            </div>
            <div className="flex gap-4 items-center justify-center">
                <OptionTab label="Venda ativa" onClickFn={() => handleOptionVisibileItems(true)} state={true} highlightCondition={optVisibleItems === true && optActiveItems === null} />
                <span>-</span>
                <OptionTab label="Venda pausada" onClickFn={() => handleOptionVisibileItems(false)} state={false} highlightCondition={optVisibleItems === false && optActiveItems === null} />
                <span>-</span>
                <OptionTab label="Inativos" onClickFn={() => handleOptionActiveItems(false)} state={false} highlightCondition={optActiveItems === false && optVisibleItems === null} />

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

