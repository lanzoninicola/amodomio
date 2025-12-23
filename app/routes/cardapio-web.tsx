import { MenuItemTag, Tag } from "@prisma/client";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";
import { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { ArrowRight, Instagram, MapPin, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import BadgeTag from "~/domain/tags/components/badge-tag";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import { WebsiteNavigationSidebar } from "~/domain/website-navigation/components/website-navigation-sidebar";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import PUBLIC_WEBSITE_NAVIGATION_ITEMS from "~/domain/website-navigation/public/public-website.nav-links";
import { prismaAll } from "~/lib/prisma/prisma-all.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import getSearchParam from "~/utils/get-search-param";
import { badRequest, ok } from "~/utils/http-response.server";


/**
 * TODO:
 * - [x] Add to menu Horario Atendimento
 * - [x] Add to menu link instagram
 * - [] Add to menu link fazer pedido
 * - [] Different layouts
 * - [] Fechamento Horario Atendimento no botao de fazer pedido
 * - [] Session feature
 * - [] Like it feature
 * - [] Share it feature
 * - [] Notification feature
 * - [] Let install it wpapp
 * - [] Me sinto fortunado (choose a random menu item)
 * - [] Cache https://vercel.com/docs/frameworks/remix
 */

export interface CardapioOutletContext {
    items: MenuItemWithAssociations[]
}

export const meta: MetaFunction = ({ data }) => {
    return [
        { title: "Cardápio A Modo Mio - Pizzaria Italiana em Pato Branco" },
        { name: "description", content: "É a pizza! Italiana! Um sabor que você nunca experimentou! Descubra no nosso cardápio as melhores pizzas da cidade. Experimente e saboreie a verdadeira italianidade em Pato Branco." },
        { name: "og:title", content: "Cardápio A Modo Mio - Pizzaria Italiana em Pato Branco" },
        { name: "og:description", content: "É a pizza! Italiana! Um sabor que nunca experimentou! Descubra no nosso cardápio as melhores pizzas da cidade. Experimente e saboreie a verdadeira italianidade em Pato Branco." },
        { name: "og:image", content: "https://www.amodomio.com.br/images/cardapio_og_image.jpg" },
        { name: "og:url", content: "https://www.amodomio.com.br/cardapio" },
        { name: "og:site_name", content: "Cardápio A Modo Mio - Pizzaria Italiana em Pato Branco" },
        { name: "og:type", content: "website" },
    ];
};



export async function loader({ request }: LoaderFunctionArgs) {
    const env = process.env?.NODE_ENV

    // const tagParam = getSearchParam({ request, paramName: 'tag' })

    //@ts-ignore
    const itemsQuery = prismaIt(menuItemPrismaEntity.findAll({
        where: {
            visible: true,
            // tags: {
            //     some: {
            //         Tag: {
            //             name: tagParam || undefined
            //         }
            //     }
            // }
        },
        option: {
            sorted: true,
            direction: "asc"
        },
        // mock: env === "development"
    }, {
        imageTransform: true,
        imageScaleWidth: 375
    }))




    const tagsQuery = prismaIt(tagPrismaEntity.findAll({
        public: true
    }))

    const results = await Promise.all([itemsQuery, tagsQuery])

    const [errItems, items] = results[0]
    const [errTags, tags] = results[1]

    if (errItems) {
        return badRequest(errItems)
    }


    return ok({
        items, tags
    })


}


export default function CardapioWeb() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []
    const tags = loaderData?.payload.tags as Tag[] || []

    // const [storedValue, setStoredValue] = useLocalStorage("sessionId", null)


    if (loaderData?.status > 399) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
    }

    // // synchronize initially
    // useLayoutEffect(() => {
    //     setStoredValue("sidebar")
    // }, []);

    // synchronize on change
    // useEffect(() => {
    //     window.localStorage.setItem("sidebar", isOpen);
    // }, [isOpen]);

    return (
        <>
            <CardapioHeader items={items} tags={tags} />

            <div className="md:m-auto md:max-w-2xl">
                <section className="mt-24 p-4 mb-8 ">
                    <div className="flex flex-col font-neue">
                        <h2 className="font-semibold text-xs">A Modo Mio | Pizzeria Italiana</h2>
                        <h3 className="text-muted-foreground">Pizza Al Taglio & Delivery</h3>
                    </div>

                    <div className="text-xs text-muted-foreground mb-6 font-neue">
                        <p>Rua Arariboia 64 - Pato Branco</p>
                    </div>
                    <div className="grid grid-cols-3 gap-x-4">

                        <Link to={GLOBAL_LINKS.instagram.href} aria-label={GLOBAL_LINKS.instagram.title} className="flex items-center justify-center gap-1 rounded-lg bg-muted py-1">
                            <Instagram />
                            <span className="font-semibold text-xs">Instagram</span>
                        </Link>
                        <WhatsappExternalLink
                            phoneNumber="46991272525"
                            ariaLabel="Envia uma mensagem com WhatsApp"
                            message={"Olá, gostaria fazer um pedido"}
                            className="flex items-center justify-center gap-2 rounded-lg bg-muted py-1 "
                        >
                            <WhatsAppIcon color="black" />
                            <span className="font-semibold text-xs">WhatsApp</span>
                        </WhatsappExternalLink>
                        <Link to={GLOBAL_LINKS.maps.href} aria-label={GLOBAL_LINKS.maps.title} className="flex items-center justify-center gap-1 rounded-lg bg-muted py-1">
                            <MapPin />
                            <span className="font-semibold text-xs">Maps</span>
                        </Link>
                    </div>
                </section>
                <Separator />
                {/* <Featured /> */}
                <Outlet context={{ items }} />

            </div>
            <CardapioFooter />
        </>
    )
}

interface CardapioHeaderProps {
    items: MenuItemWithAssociations[], tags: Tag[]
}

function CardapioHeader({ items, tags }: CardapioHeaderProps) {
    const [showSearch, setShowSearch] = useState(false)

    return (
        <header className="bg-white shadow fixed top-0 w-screen  border-b-slate-100 px-4 pt-2 py-1 z-50 md:max-w-2xl md:-translate-x-1/2 md:left-1/2" >
            <div className="flex flex-col">
                <div className="grid grid-cols-3 items-center w-full">
                    {/* <div className="flex gap-1 items-center" onClick={() => setShowSearch(!showSearch)}>
                        <HamburgerMenuIcon className="w-6 h-6" />
                        <span className="font-neue text-[10px] font-semibold  uppercase">Menu</span>
                    </div> */}

                    <WebsiteNavigationSidebar
                        homeLink={{ label: "Cardápio", to: "cardapio" }}
                        navigationLinks={PUBLIC_WEBSITE_NAVIGATION_ITEMS}
                        buttonTrigger={{
                            label: "Menu",
                            classNameLabel: "block font-neue text-[10px] font-semibold  uppercase",
                            classNameButton: "justify-start w-full h-full",
                        }}
                    >
                        <div className="flex flex-col justify-center mb-4">
                            <p className="font-neue font-semibold text-lg leading-relaxed">Hórarios de funcionamento</p>
                            <div className="flex flex-col justify-center mb-4">
                                <p className="text-muted-foreground font-neue text-lg ">Quarta - Domingo</p>
                                <p className="text-muted-foreground font-neue text-lg ">18:00 - 22:00</p>
                            </div>
                        </div>

                    </WebsiteNavigationSidebar>

                    <Link to="/cardapio-web" className="flex justify-center">
                        <Logo color="black" className="w-[60px]" tagline={false} showSantaHat />
                    </Link>
                    <div className="flex justify-end items-center cursor-pointer" onClick={() => setShowSearch(!showSearch)}>
                        <SearchIcon />
                        <span className="font-neue text-[10px] font-semibold  uppercase">Pesquisar</span>
                    </div>
                </div>
                {showSearch && <CardapioSearch items={items} setShowSearch={setShowSearch} />}
            </div>


            <ul className="overflow-x-auto py-3" style={{
                display: "-webkit-inline-box"
            }}>
                {tags.map((tag) => (
                    <li key={tag.id} className="ml-2">
                        <Link to={`?tag=${tag.name}`} className="text-xs font-neue font-semibold uppercase text-muted-foreground">
                            <BadgeTag tag={tag} classNameLabel="text-[10px]" />
                        </Link>
                    </li>
                ))}
            </ul>
        </header>
    )
}

function CardapioFooter() {
    return (
        <footer className="py-6 px-2 fixed bottom-0 w-screen md:max-w-2xl md:-translate-x-1/2 md:left-1/2 ">
            {/* <Separator className="my-4" /> */}
            <div className="px-2 w-full">
                <ExternalLink to={GLOBAL_LINKS.saiposCardapio.href}
                    ariaLabel="Cardápio digital pizzaria A Modo Mio"
                    className="flex justify-between font-neue rounded-sm bg-green-400 py-2 px-4"
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

    const [currentItems, setCurrentItems] = useState<MenuItemWithAssociations[]>([]);
    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {

        const value = event.target.value.toLowerCase();
        setSearch(value);

        if (!value) {
            setCurrentItems([]);
            return;
        }


        const itemsFounded = items.filter(item =>
            item.name.toLowerCase().includes(value) ||
            item.ingredients.toLowerCase().includes(value) ||
            item.description.toLowerCase().includes(value) ||
            (item.tags?.public && item.tags?.public.filter(tag => tag.toLowerCase().includes(value)).length > 0)
        );



        setCurrentItems(itemsFounded);
    };



    return (
        <div className="flex flex-col">
            <div className="bg-white flex flex-col py-3">
                <Input placeholder="Digitar 'abobrinha' ou 'vegetarianas'" className="font-neue text-sm h-8" onChange={handleSearch} />
                {
                    search && <p className="font-neue text-xs text-muted-foreground mt-2">{currentItems.length} de {items.length} resultados para
                        <span className="font-semibold"> {search}</span>
                    </p>
                }
                <Separator className="my-4" />
                <div className="max-h-[350px] overflow-y-auto">
                    <ul className="flex flex-col gap-2">
                        {currentItems.map((item) => (
                            <li className="py-1 flex-1 min-w-[70px]" key={item.id}>
                                <Link
                                    to={`/cardapio-web/#${item.id}`}
                                    className="grid grid-cols-8 items-center w-full"
                                >
                                    <div className="bg-center bg-cover bg-no-repeat w-8 h-8 rounded-lg col-span-1 "
                                        style={{
                                            backgroundImage: `url(${item.MenuItemImage?.thumbnailUrl || "/images/cardapio-web-app/placeholder.png"})`,
                                        }}></div>
                                    <div className="flex flex-col col-span-7">
                                        <span className="font-neue text-[0.65rem] font-semibold leading-tight uppercase">{item.name}</span>
                                        <span className="font-neue text-[0.65rem] leading-tight">{item.ingredients}</span>
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
