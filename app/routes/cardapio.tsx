import { Tag } from "@prisma/client";
import { MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLocation, useSearchParams } from "@remix-run/react";
import { LayoutList } from "lucide-react";
import { LayoutTemplate } from "lucide-react";
import { Filter, Instagram, MapPin, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ItalyFlag from "~/components/italy-flag/italy-flag";
import Badge from "~/components/primitives/badge/badge";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import CardapioItemDialog from "~/domain/cardapio/components/cardapio-item-dialog/cardapio-item-dialog";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import BadgeTag from "~/domain/tags/components/badge-tag";
import { WebsiteNavigationSidebar } from "~/domain/website-navigation/components/website-navigation-sidebar";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import PUBLIC_WEBSITE_NAVIGATION_ITEMS from "~/domain/website-navigation/public/public-website.nav-links";
import { cn } from "~/lib/utils";


/**
 * TODO:
 * - [x] Add to menu Horario Atendimento
 * - [x] Add to menu link instagram
 * - [] Add anotações pizza (batas fritas, batata ao forno)
 * - [] Funnel venda, ao press fazer pedido, lembrar outras coisa, pizza doces o bebidas
 * - [] Add customer comments, from a copia incolla operation
 * - [] Add to menu link fazer pedido
 * - [] Add to menu "como funciona"
 * - [] Like it bounded to product sells
 * - [x] Different layouts
 * - [] Fechamento Horario Atendimento no botao de fazer pedido
 * - [] Session feature
 * - [x] Like it feature
 * - [x] Share it feature
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






export default function CardapioWeb() {
    const location = useLocation();

    // const [storedValue, setStoredValue] = useLocalStorage("sessionId", null)



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
            <CardapioHeader />

            <div className="md:m-auto md:max-w-2xl">
                <section className="mt-16 p-4 mb-4 ">
                    <div className="flex flex-col font-body-website">
                        <h2 className="font-semibold text-lg">A Modo Mio | Pizzeria Italiana</h2>
                        <h3 className="text-muted-foreground">Pizza Al Taglio & Delivery</h3>
                    </div>

                    <div className="text-xs text-muted-foreground mb-6 font-body-website">
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

                <div className="grid grid-cols-10 rounded-lg bg-muted m-4 p-2">
                    <div className="flex items-center justify-center col-span-1">
                        <ItalyFlag width={24} />
                    </div>
                    <p className="font-body-website text-sm col-span-8 text-center">Todas os nossas pizzas são preparadas com <span className="font-semibold">farinha e molho de tomate importados da Itália</span></p>
                    <div className="flex items-center justify-center col-span-1">
                        <ItalyFlag width={24} />
                    </div>
                </div>

                <div className="flex gap-4 justify-center mb-2">
                    <Link to={"/cardapio"} className={
                        cn(
                            "p-2",
                            location.pathname === "/cardapio" && "border-b-brand-blue border-b-2",

                        )
                    } >
                        <LayoutTemplate />
                    </Link>
                    <Link to={"/cardapio/list"} className={
                        cn(
                            "p-2",
                            location.pathname === "/cardapio/list" && "border-b-brand-blue border-b-2",

                        )
                    } >
                        <LayoutList />
                    </Link>
                </div>

                {/* <Featured /> */}

                <Outlet />




            </div>

            <CardapioFooter />
        </>
    )
}



function CardapioHeader() {
    const [showSearch, setShowSearch] = useState(false)

    return (
        <header className="fixed top-0 w-screen z-50 md:max-w-2xl md:-translate-x-1/2 md:left-1/2" >
            <div className="flex flex-col bg-brand-blue px-4 pt-2 py-1">
                <div className="grid grid-cols-3 items-center w-full">
                    {/* <div className="flex gap-1 items-center" onClick={() => setShowSearch(!showSearch)}>
                        <HamburgerMenuIcon className="w-6 h-6" />
                        <span className="font-body-website text-[10px] font-semibold  uppercase">Menu</span>
                    </div> */}

                    <WebsiteNavigationSidebar
                        homeLink={{ label: GLOBAL_LINKS.cardapioPublic.title, to: GLOBAL_LINKS.cardapioPublic.href }}
                        navigationLinks={PUBLIC_WEBSITE_NAVIGATION_ITEMS}
                        buttonTrigger={{
                            label: "Menu",
                            classNameLabel: "block font-body-website text-[10px] font-semibold  uppercase text-white",
                            classNameButton: "justify-start w-full h-full",
                            colorIcon: "white",
                        }}
                    >
                        <div className="flex flex-col justify-center mb-2 font-body-website">
                            <p className=" font-semibold text-sm leading-relaxed">Hórarios de funcionamento</p>
                            <div className="flex flex-col justify-center mb-4">
                                <p className="text-muted-foreground font-body-website">Quarta - Domingo</p>
                                <p className="text-muted-foreground font-body-website">18:00 - 22:00</p>
                            </div>
                        </div>


                        <div className="pr-4 mb-4">
                            <FazerPedidoButton cnLabel="text-xs" />
                        </div>

                    </WebsiteNavigationSidebar>

                    <Link to={GLOBAL_LINKS.cardapioPublic.href} className="flex justify-center">
                        <Logo color="white" className="w-[60px]" tagline={false} />
                    </Link>
                    <div className="flex justify-end items-center cursor-pointer" onClick={() => setShowSearch(!showSearch)}>
                        <SearchIcon color="white" />
                        <span className="font-body-website text-[10px] font-semibold  uppercase text-white">Pesquisar</span>
                    </div>
                </div>

            </div>
        </header>
    )
}





function CardapioFooter() {

    const labels = ["cyuc", "HORÁRIO DE ATENDIMENTO", "QUA-DOM 18:00-22:00"];


    return (
        <div className={
            cn(
                "fixed bottom-0 w-screen md:max-w-2xl md:-translate-x-1/2 md:left-1/2 ",
            )
        }>
            <footer >
                <div className="h-full w-full py-2 px-4 bg-white">
                    <FazerPedidoButton variant="primary" />
                </div>
            </footer>
        </div>

    )
}

function CardapioSearch({ items, setShowSearch }: {
    items: MenuItemWithAssociations[],
    setShowSearch: React.Dispatch<React.SetStateAction<boolean>>
}) {

    const [currentItems, setCurrentItems] = useState<MenuItemWithAssociations[]>([]);
    const [search, setSearch] = useState("")
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

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
        <div className="bg-white flex flex-col py-2 px-4 rounded-sm shadow-lg w-[350px] md:w-[450px]">
            <div className=" flex flex-col py-3">

                <div className="max-h-[350px] overflow-y-auto">
                    <ul className="flex flex-col gap-2">
                        {currentItems.map((item) => (
                            <CardapioItemDialog key={item.id} item={item} triggerComponent={
                                <li className="grid grid-cols-8 py-1" >

                                    <div className="self-start bg-center bg-cover bg-no-repeat w-8 h-8 rounded-lg col-span-1 "
                                        style={{
                                            backgroundImage: `url(${item.MenuItemImage?.thumbnailUrl || "/images/cardapio-web-app/placeholder.png"})`,
                                        }}></div>
                                    <div className="flex flex-col col-span-7">
                                        <span className="font-body-website text-[0.85rem] font-semibold leading-tight uppercase text-left">{item.name}</span>
                                        <span className="font-body-website text-[0.85rem] leading-tight text-left">{item.ingredients}</span>
                                    </div>

                                </li>
                            } />

                        ))}
                    </ul>
                </div>

                <Separator className="my-4" />

                {
                    search && <p className="font-body-website text-xs text-muted-foreground mb-2">{currentItems.length} de {items.length} resultados para
                        <span className="font-semibold"> {search}</span>
                    </p>
                }

                <Input
                    ref={inputRef}
                    placeholder="Digitar 'abobrinha' ou 'vegetarianas'" className="font-body-website text-sm h-8" onChange={handleSearch}

                />


            </div>

            <Button type="button" variant="secondary" onClick={() => setShowSearch(false)}>
                <div className="flex gap-2 items-center font-body-website tracking-wide text-xs font-semibold uppercase">
                    <XIcon className="w-[12px] h-[12px]" />
                    <span className="text-[12px] tracking-widest font-semibold uppercase" style={{
                        lineHeight: "normal",
                    }}>Fechar</span></div>
            </Button>


        </div>
    )


}