import { HamburgerMenuIcon } from "@radix-ui/react-icons";
import { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { ArrowRight, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import { Input } from "~/components/ui/input";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";

export interface CardapioOutletContext {
    items: MenuItemWithAssociations[]
}

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "title",
            content: "Cardápio Pizzaria A Modo Mio - Pato Branco",
        }
    ];
};

export async function loader({ request }: LoaderArgs) {
    // @ts-ignore
    const [errItems, items] = await prismaIt(menuItemPrismaEntity.findAll({
        where: {
            visible: true
        },
        option: {
            sorted: true,
            direction: "asc"
        },
        mock: true
    }))

    if (errItems) {
        return badRequest(errItems)
    }

    const [_, tags] = await prismaIt(menuItemTagPrismaEntity.findAllDistinct())

    return ok({ items, tags })

}


export default function CardapioWeb() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []

    return (
        <>
            <CardapioHeader items={items} />
            {/* <Featured /> */}
            <Outlet context={{ items }} />
            <CardapioFooter />
        </>
    )
}

function CardapioHeader({ items }: { items: MenuItemWithAssociations[] }) {
    const [showSearch, setShowSearch] = useState(false)

    return (
        <header className="bg-white shadow fixed top-0 w-screen border-b-slate-100 px-4 py-3 z-50" >
            <div className="flex flex-col">
                <div className="grid grid-cols-3 items-center w-full">
                    <HamburgerMenuIcon className="w-6 h-6" />
                    <Link to="/cardapio-web" className="flex justify-center">
                        <Logo color="black" className="w-[60px]" tagline={false} />
                    </Link>
                    <div className="flex gap-2 justify-end" onClick={() => setShowSearch(!showSearch)}>
                        <SearchIcon />
                    </div>
                </div>
                {showSearch && <CardapioSearch items={items} setShowSearch={setShowSearch} />}
            </div>
        </header>
    )
}

function CardapioFooter() {
    return (
        <footer className="py-6 px-2 fixed bottom-0 w-screen">
            {/* <Separator className="my-4" /> */}
            <div className="px-2 w-full">
                <ExternalLink to="https://app.mogomenu.com.br/amodomio"
                    ariaLabel="Cardápio digital pizzaria A Modo Mio"
                    className="flex justify-between font-body-website rounded-sm bg-green-400 py-2 px-4"
                >
                    <span className="uppercase tracking-wide font-semibold">Fazer pedido</span>
                    <ArrowRight />
                </ExternalLink>
            </div>
        </footer>
    )
}

function CardapioSearch({ items, setShowSearch }: {
    items: MenuItemWithAssociations[],
    setShowSearch: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const [currentItems, setCurrentItems] = useState<any[]>([]);
    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {

        const value = event.target.value.toLowerCase();
        setSearch(value);

        if (!value) {
            setCurrentItems([]);
            return;
        }

        const searchedItems = items.filter(item =>
            item.name.toLowerCase().includes(value) ||
            item.ingredients.toLowerCase().includes(value) ||
            item.description.toLowerCase().includes(value) ||
            item.tags.filter(tag => tag.name.toLowerCase().includes(value)).length > 0
        );

        setCurrentItems(searchedItems);
    };

    return (
        <div className="flex flex-col">
            <div className="bg-white flex flex-col py-3">
                <Input placeholder="Digitar 'abobrinha' ou 'vegetarianas'" className="font-body-website text-sm h-8" onChange={handleSearch} />
                <div className="max-h-[350px] overflow-y-auto pt-4">
                    <ul className="flex flex-col gap-2">
                        {currentItems.map((item) => (
                            <li className="py-1 flex-1 min-w-[70px]" key={item.id}>
                                <Link
                                    to={`/cardapio-web/#${item.id}`}
                                    className="grid grid-cols-8 items-center w-full"
                                >
                                    <div className="bg-center bg-cover bg-no-repeat w-8 h-8 rounded-lg col-span-1 "
                                        style={{
                                            backgroundImage: `url(${item.imageBase64 || "/images/cardapio-web-app/placeholder.png"})`,
                                        }}></div>
                                    <div className="flex flex-col col-span-7">
                                        <span className="font-body-website text-[0.65rem] font-semibold leading-tight uppercase">{item.name}</span>
                                        <span className="font-body-website text-[0.65rem] leading-tight">{item.ingredients}</span>
                                    </div>

                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="flex justify-end  items-center px-2 gap-1"

                onClick={() => setShowSearch(false)}
            >
                <XIcon className="w-[11px] h-[11px]" />
                <p className="text-[9px] tracking-widest font-semibold uppercase" style={{
                    lineHeight: "normal",
                }}>Fechar</p>
            </div>
        </div>
    )


}