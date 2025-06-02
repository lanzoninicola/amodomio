import { MetaFunction } from "@remix-run/node";
import { Link, Outlet, matchPath, useLocation } from "@remix-run/react";
import { Donut, Instagram, MapPin, Proportions, SearchIcon, User, Users } from "lucide-react";
import { ReactNode, useState } from "react";

import ItalyFlag from "~/components/italy-flag/italy-flag";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { WebsiteNavigationSidebar } from "~/domain/website-navigation/components/website-navigation-sidebar";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import PUBLIC_WEBSITE_NAVIGATION_ITEMS from "~/domain/website-navigation/public/public-website.nav-links";
import { cn } from "~/lib/utils";


/**
 * TODO:
 * - [] ragrupamento, quando inserisco uma nova pizza sae sempre para ultima
 * - [] clico na foto e abre um modal com a foto maior
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
    const pathname = location?.pathname;

    const searchPagePath = "/cardapio/buscar";
    const singleItemPattern = "/cardapio/:id";

    const isSearchPage = pathname === searchPagePath;
    const isSingleItemPage = matchPath(singleItemPattern, pathname);

    const currentPage = isSearchPage
        ? "busca"
        : isSingleItemPage
            ? "single"
            : "other";

    // const sessionId = useClientSessionId();

    // // Controle de renderização no cliente
    // const [isClient, setIsClient] = useState(false);
    // useEffect(() => {
    //     setIsClient(true);
    // }, []);

    // if (!isClient) return null; // ou um spinner, se quiser

    return (
        <>
            <CardapioHeader />
            <div className="md:m-auto md:max-w-6xl">
                {currentPage === "other" && <CompanyInfo />}
                <Outlet />
            </div>
            {currentPage === "other" && <CardapioFooter />}
        </>
    );
}





function CardapioHeader() {
    const [showSearch, setShowSearch] = useState(false)

    return (
        <header className="fixed top-0 w-full z-50 md:max-w-6xl md:-translate-x-1/2 md:left-1/2 " >
            <div className="flex flex-col bg-white px-4 pt-2 py-3 h-[50px] md:h-[70px]">
                <div className="grid grid-cols-3 items-center w-full">
                    {/* <div className="flex gap-1 items-center" onClick={() => setShowSearch(!showSearch)}>
                        <HamburgerMenuIcon className="w-6 h-6" />
                        <span className="font-neue text-[10px] font-semibold  uppercase">Menu</span>
                    </div> */}

                    <WebsiteNavigationSidebar
                        homeLink={{ label: GLOBAL_LINKS.cardapioPublic.title, to: GLOBAL_LINKS.cardapioPublic.href }}
                        navigationLinks={PUBLIC_WEBSITE_NAVIGATION_ITEMS}
                        buttonTrigger={{
                            label: "",
                            classNameLabel: "block font-neue text-[10px] font-semibold uppercase",
                            classNameButton: "justify-start w-full h-full text-black bg-transparent hover:bg-transparent hover:text-black px-0",
                        }}
                        cnLink="font-neue text-xl uppercase tracking-widest"

                    >
                        <div className="flex flex-col justify-center mb-2 font-neue">
                            <p className=" font-semibold text-xl leading-relaxed uppercase tracking-wide">Hórarios de funcionamento</p>
                            <div className="flex flex-col justify-center mb-4">
                                <p className="text-muted-foreground font-neue text-xl">Quarta - Domingo</p>
                                <p className="text-muted-foreground font-neue text-xl">18:00 - 22:00</p>
                            </div>
                        </div>


                        <div className="pr-4 mb-4">
                            <FazerPedidoButton cnLabel="text-2xl tracking-wider" />
                        </div>

                    </WebsiteNavigationSidebar>

                    <Link to={GLOBAL_LINKS.cardapioPublic.href} className="flex justify-center">
                        <div className="px-4 -py-3">
                            <Logo color="black" onlyText={true} className="w-[120px] h-[30px] md:w-[150px] md:h-[50px]" tagline={false} />
                        </div>
                    </Link>
                    <Link to={'buscar'} className="flex justify-end">
                        <div className="flex justify-end items-center cursor-pointer" onClick={() => setShowSearch(!showSearch)}>
                            <SearchIcon color={"black"} />
                            {/* <span className="font-neue text-[10px] font-semibold  uppercase text-brand-blue">Pesquisar</span> */}
                        </div>
                    </Link>
                </div>

            </div>
            <ScrollingBanner
                cnContainer="h-[30px] md:h-[40px] bg-white border-b border-t border-solid border-black flex"
            >
                <div className="flex items-center gap-2 justify-center">
                    {/* @ts-ignore */}
                    <ItalyFlag className="w-4 h-4 md:w-6 md:h-6" />
                    <p className="font-neue text-[15px] uppercase tracking-wider md:text-lg">
                        Todas as nossas pizzas são preparadas com farinha e molho de tomate importados da Itália
                    </p>
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
                className="text-center px-10 text-lg font-semibold text-black animate-scrollingText whitespace-nowrap flex"
            >
                {children}
            </div>
        </div>
    );
};




function CompanyInfo() {




    return (
        <section>
            <div className="mt-20 md:mt-28 bg-banner md:bg-banner-md bg-center bg-cover bg-no-repeat min-h-[150px] mb-4 flex items-end justify-end py-2">
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

            <div className="flex flex-col font-neue items-center">
                <h2 className="font-semibold text-xl tracking-wide uppercase">A Modo Mio | Pizzeria Italiana</h2>
                <h3 className="text-muted-foreground text-sm tracking-wider uppercase">Pizza Al Taglio & Delivery</h3>
            </div>

            <div className="text-sm  text-muted-foreground mb-2 font-neue">
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
                "fixed bottom-0 w-screen md:max-w-6xl md:-translate-x-1/2 md:left-1/2  shadow-sm",
            )
        }>
            <footer className="grid grid-cols-4 md:grid-cols-8 gap-x-2 bg-white px-4" >
                <CardapioSizesDialog />
                <div className="h-full w-full py-2 col-span-3 md:col-span-6">
                    <FazerPedidoButton variant="accent" cnLabel="text-2xl tracking-wider" />
                </div>
            </footer>
        </div>

    )
}

interface CardapioFooterMenuItemDialogProps {
    children?: React.ReactNode;
    triggerComponent?: React.ReactNode;
}

function CardapioFooterMenuItemDialog({ children, triggerComponent }: CardapioFooterMenuItemDialogProps) {

    return (
        <Dialog>
            <DialogTrigger asChild className="w-full">
                <button>
                    {triggerComponent}
                </button>
            </DialogTrigger>
            <DialogContent className="p-0 bg-transparent border-none">
                <div className="bg-white p-4">
                    {children}
                    <DialogClose asChild>
                        <div className="w-full">
                            <Button type="button" variant="secondary" className="w-full" >
                                <span className=" tracking-wide font-semibold uppercase">Fechar</span>
                            </Button>
                        </div>

                    </DialogClose>
                </div>

            </DialogContent>

        </Dialog>
    )
}

type SizesSelection = "individual" | "medio" | "familia"

function CardapioSizesDialog() {

    const [currentSize, setCurrentSize] = useState<SizesSelection>("individual")

    const ButtonSelection = ({ size }: { size: SizesSelection }) => {
        return (
            <button
                className={cn(
                    "grid grid-rows-4 justify-items-center items-center rounded-md p-1",
                    currentSize === size && "border-2 border-brand-blue"
                )}
                onClick={() => setCurrentSize(size)}
            >
                <img src="/images/cardapio-web-app/pizza-placeholder-sm.png" alt={`Tamanho ${size}`}
                    className={
                        cn(
                            "w-[50px] row-span-3",
                            size === "medio" && "w-[75px]",
                            size === "familia" && "w-[150px]"
                        )
                    }
                />
                <span className="font-neue tracking-wider font-semibold row-span-1">
                    {
                        size === "individual" ? "Individual" :
                            size === "medio" ? "Médio" :
                                size === "familia" ? "Família" : "Tamanho"
                    }
                </span>
            </button>
        )
    }

    return (
        <CardapioFooterMenuItemDialog triggerComponent={
            <div className="flex flex-col gap-0 justify-center items-center">
                <Proportions className="col-span-1 md:col-span-2" />
                <span className="font-neue tracking-widest text-sm">Tamanhos</span>
            </div>}
        >
            <div className="h-[550px] overflow-auto py-4">
                <div className="mb-6">
                    <h3 className="font-semibold text-2xl uppercase font-neue tracking-wider">
                        Tamanhos disponiveis
                    </h3>
                    <span className="text-sm">Seleciona o tamanho para visualizar os detalhes</span>
                </div>
                <div className="grid grid-cols-3 gap-4">

                    <ButtonSelection size="individual" />
                    <ButtonSelection size="medio" />
                    <ButtonSelection size="familia" />

                </div>
                <Separator className="my-6" />

                <div className="flex flex-col justify-center gap-y-4">
                    <h4 className="font-neue tracking-widest font-semibold text-lg uppercase text-center mb-4">
                        Tamanho {
                            currentSize === "individual" ? "Individual" :
                                currentSize === "medio" ? "Médio" :
                                    currentSize === "familia" ? "Família" : "Tamanho"
                        }
                    </h4>
                    <div className="grid grid-rows-3 gap-y-6">
                        <div className="flex flex-col gap-0 items-center">
                            {
                                currentSize === "individual" ? <User size={32} /> : <Users size={32} />
                            }
                            <span>Serve até {
                                currentSize === "individual" ? "1 pessoa" :
                                    currentSize === "medio" ? "2 pessoas" :
                                        currentSize === "familia" ? "6 pessoas" : "Tamanho"
                            }</span>
                        </div>
                        <div className="flex flex-col gap-0 items-center">
                            {
                                currentSize === "individual" ? <Donut size={32} /> :
                                    currentSize === "medio" ? <div className="flex gap-x-2">
                                        <Donut size={32} />
                                        <Donut size={32} />
                                    </div> :
                                        currentSize === "familia" ?
                                            <div className="flex gap-x-2">
                                                <Donut size={32} />
                                                <Donut size={32} />
                                                <Donut size={32} />
                                                <Donut size={32} />
                                            </div> : "Tamanho"
                            }
                            <span>Máximo {
                                currentSize === "individual" ? "1 sabor" :
                                    currentSize === "medio" ? "2 sabores" :
                                        currentSize === "familia" ? "4 sabores" : "Tamanho"
                            }</span>

                        </div>
                        <div className="flex flex-col gap-0 items-center">
                            <Proportions size={32} />
                            <span>{
                                currentSize === "individual" ? "aprox. 25x15cm " :
                                    currentSize === "medio" ? "aprox. 40x20cm (8 fatias)" :
                                        currentSize === "familia" ? "aprox. 60x40cm (16 fatias)" : "Tamanho"
                            }</span>

                        </div>
                    </div>

                </div>

            </div>
        </CardapioFooterMenuItemDialog >
    )
}

