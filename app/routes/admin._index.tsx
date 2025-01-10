import { useLoaderData, useOutletContext } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { AdminOutletContext } from "./admin";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { LoaderFunctionArgs, LoaderFunction } from "@remix-run/node";
import { ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { mapPriceVariationsLabel } from "~/domain/cardapio/fn.utils";
import CopyButton from "~/components/primitives/copy-button/copy-button";

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
    const [_, cardapioItems] = await prismaIt(menuItemPrismaEntity.findAll({
        where: {
            visible: true
        }
    }))

    return ok({ cardapioItems })
}


export default function AdminIndex() {

    return (
        <Container>
            <div className="flex flex-col gap-4 items-center mb-4">
                <h1 className="text-center text-xl font-bold leading-tight tracking-tighter md:text-xl lg:leading-[1.1]">
                    Bem vindo ao painel de administração! 👋🏻
                </h1>
            </div>
            <CardapioItems />
        </Container>
    )
}


function CardapioItems() {
    // const outletContext = useOutletContext<AdminOutletContext>()
    // const initialItems = outletContext?.cardapioItems

    const loaderData = useLoaderData<typeof loader>()
    const initialItems: MenuItemWithAssociations[] = loaderData.payload?.cardapioItems || []
    const [items, setItems] = useState<MenuItemWithAssociations[]>(initialItems || [])

    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {

        const value = event.target.value

        setSearch(value)

        if (!value) return setItems(initialItems)

        const searchedItems = initialItems
            .filter(item => {

                const tags = item?.tags?.public || []

                return (
                    item.name?.toLowerCase().includes(value.toLowerCase())
                    || item.ingredients?.toLowerCase().includes(value.toLowerCase())
                    || item.description?.toLowerCase().includes(value.toLowerCase())
                    || (tags.filter(t => t?.toLowerCase().includes(value.toLowerCase())).length > 0)
                )
            })


        setItems(searchedItems)

    }

    return (
        <div className="flex flex-col gap-2 items-center">

            <div className="flex flex-col gap-4 items-center md:w-[500px]">
                <Input name="search" className="w-full py-4 text-lg" placeholder="Pesquisar no cardapio..." onChange={(e) => handleSearch(e)} value={search} />
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center w-full">
                    <div className="flex gap-4">
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Novidade</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Vegetarianas</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Carne</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Doce</span>
                    </div>
                    <span className="text-xs text-muted-foreground ">Resultados: {items.length}</span>
                </div>
            </div>

            <div className="h-[350px] overflow-y-auto p-2 md:p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                    {
                        items.map(item => {
                            return (
                                <div className="border rounded-lg p-4" key={item.id}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h2 className="text-xs uppercase font-semibold tracking-wide">{item.name}</h2>
                                        <CopyButton
                                            // label="Copiar elenco para imprimir"
                                            classNameLabel="text-sm md:text-xs "
                                            classNameButton="border-none text-sm md:text-xs p-1 mr-0 h-max hover:bg-brand-green hover:text-white"
                                            textToCopy={`*${item.name}*: ${item.ingredients}`}
                                            variant="outline"
                                        />
                                    </div>

                                    <ul className="grid grid-cols-2 items-end mb-2">
                                        {
                                            item.priceVariations.map(pv => {
                                                if (pv.amount <= 0) return

                                                return (
                                                    <li className="flex flex-col" key={pv.id}>
                                                        <p className="text-xs">{mapPriceVariationsLabel(pv.label)}: <span className="font-semibold">{pv.amount.toFixed(2)}</span></p>
                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
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