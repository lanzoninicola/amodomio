import { Tag } from "@prisma/client";
import { MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLocation, useSearchParams } from "@remix-run/react";
import { Filter, Instagram, MapPin, SearchIcon, XIcon } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

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
import useBrandColors from "~/hooks/use-brand-colors";
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




    const pathname = location?.pathname
    const currentPage = pathname === "/cardapio/buscar" ? "busca" : "other"


    return (
        <>
            <CardapioHeader />
            <div className="md:m-auto md:max-w-2xl">
                {currentPage !== "busca" && <CompanyInfo />}

                {/* <Featured /> */}

                <Outlet />
            </div>

            {currentPage !== "busca" && <CardapioFooter />}
        </>
    )
}





function CardapioHeader() {
    const [showSearch, setShowSearch] = useState(false)

    return (
        <header className="fixed top-0 w-full z-50 md:max-w-2xl md:-translate-x-1/2 md:left-1/2 " >
            <div className="flex flex-col bg-white px-4 pt-2 py-3 h-[50px]">
                <div className="grid grid-cols-3 items-center w-full">
                    {/* <div className="flex gap-1 items-center" onClick={() => setShowSearch(!showSearch)}>
                        <HamburgerMenuIcon className="w-6 h-6" />
                        <span className="font-body-website text-[10px] font-semibold  uppercase">Menu</span>
                    </div> */}

                    <WebsiteNavigationSidebar
                        homeLink={{ label: GLOBAL_LINKS.cardapioPublic.title, to: GLOBAL_LINKS.cardapioPublic.href }}
                        navigationLinks={PUBLIC_WEBSITE_NAVIGATION_ITEMS}
                        buttonTrigger={{
                            label: "",
                            classNameLabel: "block font-body-website text-[10px] font-semibold uppercase",
                            classNameButton: "justify-start w-full h-full",
                        }}
                        cnLink="font-body-website text-xl uppercase tracking-widest"

                    >
                        <div className="flex flex-col justify-center mb-2 font-body-website">
                            <p className=" font-semibold text-xl leading-relaxed uppercase tracking-wide">Hórarios de funcionamento</p>
                            <div className="flex flex-col justify-center mb-4">
                                <p className="text-muted-foreground font-body-website text-xl">Quarta - Domingo</p>
                                <p className="text-muted-foreground font-body-website text-xl">18:00 - 22:00</p>
                            </div>
                        </div>


                        <div className="pr-4 mb-4">
                            <FazerPedidoButton cnLabel="text-2xl tracking-wider" />
                        </div>

                    </WebsiteNavigationSidebar>

                    <Link to={GLOBAL_LINKS.cardapioPublic.href} className="flex justify-center">
                        <div className="bg-black px-4 -py-3">
                            <Logo color={"white"} className="w-[90px] h-[30px]" tagline={false} onlyText />
                        </div>
                    </Link>
                    <Link to={'buscar'} className="flex justify-end">
                        <div className="flex justify-end items-center cursor-pointer" onClick={() => setShowSearch(!showSearch)}>
                            <SearchIcon color={"black"} />
                            {/* <span className="font-body-website text-[10px] font-semibold  uppercase text-brand-blue">Pesquisar</span> */}
                        </div>
                    </Link>
                </div>

            </div>
            <ScrollingBanner
                style={{
                    backgroundColor: "white",
                    borderBlock: "1px solid #1B1B1B",
                    height: "30px",
                }}>
                <div className="flex items-center gap-2">
                    {/* @ts-ignore */}
                    <ItalyFlag className="w-4 h-4" />
                    <p className="font-body-website text-[15px] uppercase tracking-wider">Todas as nossas pizzas são preparadas com farinha e molho de tomate importados da Itália</p>
                </div>

            </ScrollingBanner>

        </header>
    )
}


const ScrollingBanner = ({ children, cnContainer, style }: { children?: ReactNode, cnContainer?: string, style?: React.CSSProperties }) => {
    return (
        <div className={
            cn(
                "overflow-hidden whitespace-nowrap",
                cnContainer
            )

        }
            style={style}
        >
            <div
                className="inline-block text-center px-10 text-lg font-semibold text-black animate-scrollingText whitespace-nowrap"
            >
                {children}
            </div>
        </div>
    );
};




function CompanyInfo() {


    return (
        <section>
            <div className="mt-20 bg-banner bg-center bg-cover bg-no-repeat min-h-[150px] mb-4 flex items-end  justify-end py-2">
                <div className="flex justify-end gap-4 px-4">

                    <Link to={GLOBAL_LINKS.instagram.href} aria-label={GLOBAL_LINKS.instagram.title}
                        className="flex items-center justify-center gap-1 rounded-full backdrop-blur-lg bg-black/30 w-[48px] h-[48px]">
                        <Instagram size={24} color="white" />
                        {/* <span className="font-semibold tracking-wide text-[12px]">Instagram</span> */}
                    </Link>
                    <WhatsappExternalLink
                        phoneNumber="46991272525"
                        ariaLabel="Envia uma mensagem com WhatsApp"
                        message={"Olá, gostaria fazer um pedido"}
                        className="flex items-center justify-center gap-2  rounded-full backdrop-blur-lg bg-black/30 w-[48px] h-[48px]"
                    >
                        <WhatsAppIcon color="white" height={24} width={24} />
                        {/* <span className="font-semibold tracking-wide text-[12px]">WhatsApp</span> */}
                    </WhatsappExternalLink>
                    <Link to={GLOBAL_LINKS.maps.href} aria-label={GLOBAL_LINKS.maps.title}
                        className="flex items-center justify-center gap-1 rounded-full backdrop-blur-lg bg-black/30 w-[48px] h-[48px]">
                        <MapPin size={24} color="white" />
                        {/* <span className="font-semibold tracking-wide text-[12px]">Maps</span> */}
                    </Link>
                </div>
            </div>

            <div className="flex flex-col font-body-website items-center">
                <h2 className="font-semibold text-2xl tracking-wide uppercase">A Modo Mio | Pizzeria Italiana</h2>
                <h3 className="text-muted-foreground text-xl uppercase">Pizza Al Taglio & Delivery</h3>
            </div>

            <div className="text-lg text-muted-foreground mb-2 font-body-website">
                <p className="text-center">Rua Arariboia 64 - Pato Branco</p>
            </div>


        </section>

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
                    <FazerPedidoButton variant="accent" cnLabel="text-2xl tracking-wider" />
                </div>
            </footer>
        </div>

    )
}


