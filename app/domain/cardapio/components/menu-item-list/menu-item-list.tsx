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

type MenuItemVisibilityFilterOption = "active" | "lancamento-futuro" | "venda-pausada" | "inactive"

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

    const [currentFilter, setCurrentFilter] = useState<MenuItemVisibilityFilterOption | null>("active")

    // const [optVisibleItems, setOptVisibleItems] = useState<boolean | null>(true)
    // const [optActiveItems, setOptActiveItems] = useState<boolean | null>(null)
    // const [optUpcomingItems, setOptUpcomingItems] = useState<boolean | null>(null)

    const handleVisibilityFilter = (option: MenuItemVisibilityFilterOption) => {

        if (option === "active") {
            setCurrentFilter("active")
            setItems(initialItems.filter(item => item.active === true))
        }

        if (option === "inactive") {
            setCurrentFilter("inactive")
            setItems(initialItems.filter(item => item.active === false))
        }

        if (option === "lancamento-futuro") {
            setCurrentFilter("lancamento-futuro")
            setItems(initialItems.filter(item => item.active === true && item.upcoming === true))
        }

        if (option === "venda-pausada") {
            setCurrentFilter("venda-pausada")
            setItems(initialItems.filter(item => item.active === true && item.visible === false && item.upcoming === false))
        }
    }


    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-8 gap-x-8 items-center mb-6">
                <div className="md:p-4 items-center col-span-3 md:col-span-2">
                    <p className="text-sm cursor-pointer hover:underline text-muted-foreground leading-tight"
                        onClick={() => setDragEnabled(!dragEnable)}
                    >{dragEnable === true ? 'Desabilitar ordernamento' : 'Abilitar ordenamento'}</p>
                </div>

                <div className="items-center col-span-5 md:col-span-6" >
                    <Input name="search" className="w-full" placeholder="Pesquisar..." onChange={(e) => handleSearch(e)} value={search} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:flex   md:gap-4 items-center justify-center">
                <OptionTab label="Venda ativa" onClickFn={() => handleVisibilityFilter("active")} highlightCondition={currentFilter === "active"} />
                <OptionTab label="Lançamento futuro" onClickFn={() => handleVisibilityFilter("lancamento-futuro")} highlightCondition={currentFilter === "lancamento-futuro"} />
                <OptionTab label="Venda pausada" onClickFn={() => handleVisibilityFilter("venda-pausada")} highlightCondition={currentFilter === "venda-pausada"} />
                <OptionTab label="Inativos" onClickFn={() => handleVisibilityFilter("inactive")} highlightCondition={currentFilter === "inactive"} />
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

