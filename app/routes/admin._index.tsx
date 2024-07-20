import { useOutletContext } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { AdminOutletContext } from "./admin";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import MenuItemCard from "~/domain/cardapio/components/menu-item-card/menu-item-card";



export default function AdminIndex() {

    return (
        <Container>
            <div className="flex flex-col gap-4 items-center mb-8">
                <h1 className="text-center text-xl font-bold leading-tight tracking-tighter md:text-xl lg:leading-[1.1]">
                    Bem vindo ao painel de administração! 👋🏻
                </h1>
                <h2 className="max-w-[450px] text-center text-md text-muted-foreground sm:text-sm">
                    Para começar, selecione uma das opções no menu de navegação acima a esquerda. 👆🏻 👈🏻
                </h2>
            </div>
            <CardapioItems />
        </Container>
    )
}


function CardapioItems() {
    const outletContext = useOutletContext<AdminOutletContext>()
    const initialItems = outletContext?.cardapioItems
    const [items, setItems] = useState<MenuItemWithAssociations[]>(initialItems || [])

    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {

        const value = event.target.value

        setSearch(value)

        if (!value) return setItems(initialItems)

        const searchedItems = initialItems
            .filter(item => item.name?.toLowerCase().includes(value.toLowerCase())
                || item.ingredients?.toLowerCase().includes(value.toLowerCase())
                || item.description?.toLowerCase().includes(value.toLowerCase())
                || item.tags.filter(tag => tag.name?.toLowerCase().includes(value.toLowerCase())).length > 0)


        setItems(searchedItems)

    }

    return (
        <div className="flex flex-col gap-2 items-center">

            <div className="flex flex-col gap-4 items-center w-[500px]">
                <Input name="search" className="w-full py-4 text-lg" placeholder="Pesquisar no cardapio..." onChange={(e) => handleSearch(e)} value={search} />
                <div className="flex justify-between items-center w-full">
                    <div className="flex gap-4">
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Novidade</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Vegetarianas</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Carne</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Doce</span>
                    </div>
                    <span className="text-xs text-muted-foreground ">Resultados: {items.length}</span>
                </div>
            </div>

            <div className="h-[250px] overflow-y-auto p-6">
                <div className="grid grid-cols-4 gap-4">
                    {
                        items.map(item => {
                            return (
                                <div className="border rounded-lg p-4">
                                    <h2 className="text-xs uppercase font-semibold tracking-wide">{item.name}</h2>
                                    <p className="text-xs text-muted-foreground">{item.ingredients}</p>
                                </div>
                            )
                        })
                    }

                </div>
            </div>


        </div>
    )
}