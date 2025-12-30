import { InstagramLogoIcon } from "@radix-ui/react-icons";
import { LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Await, Link, Outlet, defer, useLoaderData } from "@remix-run/react";
import { ArrowRight, Bell, Divide, Donut, Info, Instagram, LayoutTemplate, MapPin, Proportions, SearchIcon, User, Users } from "lucide-react";
import React, { ReactNode, Suspense, useEffect, useState } from "react";

import ItalyFlag from "~/components/italy-flag/italy-flag";
import Loading from "~/components/loading/loading";
import ExternalLink from "~/components/primitives/external-link/external-link";
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
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";
import { PushOptIn } from "~/domain/push/components/push-opt-in";
import useCurrentPage from "~/hooks/use-current-page";
import { NotificationCenterProvider, useNotificationCenter } from "~/domain/push/notification-center-context";
import { PwaInstallPrompt } from "~/domain/pwa/pwa-install-prompt";


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

export const links: LinksFunction = () => [
    { rel: "manifest", href: "/site.webmanifest" },
    { rel: "apple-touch-icon", sizes: "180x180", href: "/favicons/apple-touch-icon.png" },
    { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicons/favicon-32x32.png" },
    { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicons/favicon-16x16.png" },
    { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicons/android-chrome-192x192.png" },
    { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicons/android-chrome-512x512.png" },
    { rel: "shortcut icon", href: "/favicon.ico" },
];

export async function loader({ request }: LoaderFunctionArgs) {

    const requestedKeys = [
        "cardapio.fazer_pedido.public.url",
        "cardapio.aviso_loja_fechada.yesno",
    ] as const;

    const cardapioSettings = await prismaClient.cardapioSetting.findMany({
        where: { key: { in: [...requestedKeys] } },
        select: { key: true, value: true },
    });

    const settingsMap = cardapioSettings.reduce<Record<string, string | null>>((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
    }, {});

    const fPUrl = settingsMap[requestedKeys[0]] ?? GLOBAL_LINKS.cardapioFallbackURL.href;

    const showLojaFechadaMessage = parseBooleanSetting(settingsMap[requestedKeys[1]], true);

    return defer({
        fazerPedidoPublicURL: fPUrl,
        showLojaFechadaMessage,
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    })

}




export default function CardapioWeb() {
    const currentPage = useCurrentPage();

    const { showLojaFechadaMessage, vapidPublicKey } = useLoaderData<typeof loader>()

    // const sessionId = useClientSessionId();

    // // Controle de renderização no cliente
    // const [isClient, setIsClient] = useState(false);
    // useEffect(() => {
    //     setIsClient(true);
    // }, []);

    // if (!isClient) return null; // ou um spinner, se quiser

    return (
        <NotificationCenterProvider>
            {showLojaFechadaMessage && <BannerFechado />}
            <CardapioHeader />

            <div className="md:m-auto md:max-w-6xl">
                {/* <PwaInstallPrompt className="mt-16 md:mt-24 mb-6" /> */}
                {/* {currentPage === "other" && <CompanyInfo />} */}
                <Outlet />

            </div>
            {currentPage === "other" && <CardapioFooter />}
        </NotificationCenterProvider>
    );
}

function shouldShowBanner(date: Date = new Date()) {
    const day = date.getDay(); // 0 = domingo, 1 = segunda, ... 6 = sábado
    return day === 1 || day === 2; // mostra apenas segunda e terça
}

function BannerFechado() {

    const text = "Estamos fechado agora! Nosso horarío de funcionamento: Quarta a domingo, das 18h às 22h"
    const [isClosed, setIsClosed] = useState<boolean | null>(null);

    useEffect(() => {
        setIsClosed(shouldShowBanner());
    }, []);

    if (!isClosed) return null;

    return (
        <>
            <ScrollingBanner cnContainer="fixed top-0 inset-x-0 w-screen bg-red-500 z-50" data-element="banner-fechado">
                <span className="font-neue text-white  font-semibold uppercase tracking-wide">{text}</span>
            </ScrollingBanner>
            <ScrollingBanner cnContainer="fixed bottom-0 w-screen bg-red-500 z-50" data-element="banner-fechado">
                <span className="font-neue text-white font-semibold uppercase tracking-wide">{text}</span>
            </ScrollingBanner>
        </>
    )
}




function CardapioHeader() {
    const currentPage = useCurrentPage()
    const [showSearch, setShowSearch] = useState(false)
    const { fazerPedidoPublicURL, vapidPublicKey } = useLoaderData<typeof loader>()
    const { unreadCount } = useNotificationCenter()

    return (
        <header className="fixed top-0 w-full z-10 md:max-w-6xl md:-translate-x-1/2 md:left-1/2 " >
            <div className="flex flex-col bg-white px-1 pt-2 py-3 h-[50px] md:h-[70px]">
                <div className="grid grid-cols-3 items-center w-full">
                    {/* <div className="flex gap-1 items-center" onClick={() => setShowSearch(!showSearch)}>
                        <HamburgerMenuIcon className="w-6 h-6" />
                        <span className="font-neue text-[10px] font-semibold  uppercase">Menu</span>
                    </div> */}

                    <Link to={GLOBAL_LINKS.cardapioPublic.href} className="flex col-span-2">
                        <div className="px-4 -py-3">
                            <Logo color="black" onlyText={true} className="w-[120px] h-[30px] md:w-[150px] md:h-[50px]" tagline={false} showSantaHat />
                        </div>
                    </Link>

                    <div className="w-full flex items-center gap-x-2 justify-end col-span-1">
                        <Link to="/cardapio/notificacoes" prefetch="intent">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative h-10 w-10 p-0 inline-flex items-center justify-center align-middle"
                                aria-label="Notificações"
                            >
                                <Bell className="h-5 w-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                                )}
                            </Button>
                        </Link>
                        <Link to={'buscar'} >
                            <div className="flex h-10 w-10 items-center justify-center cursor-pointer" onClick={() => setShowSearch(!showSearch)}>
                                <SearchIcon color={"black"} className="h-5 w-5" />
                                {/* <span className="font-neue text-[10px] font-semibold  uppercase text-brand-blue">Pesquisar</span> */}
                            </div>
                        </Link>
                        <WebsiteNavigationSidebar
                            homeLink={{ label: GLOBAL_LINKS.cardapioPublic.title, to: GLOBAL_LINKS.cardapioPublic.href }}
                            navigationLinks={PUBLIC_WEBSITE_NAVIGATION_ITEMS}
                            buttonTrigger={{
                                label: "",
                                classNameLabel: "block font-neue text-[10px] font-semibold uppercase",
                                classNameButton: "justify-end h-full text-black bg-transparent hover:bg-transparent hover:text-black px-0",
                            }}
                            cnLink="font-neue md:text-xl uppercase tracking-widest"
                            preMenuContent={
                                <CompanyInfo />
                            }

                        >
                            <div className="flex flex-col justify-center mb-2 font-neue">
                                <p className=" font-semibold md:text-xl leading-relaxed uppercase tracking-wide">Hórarios de funcionamento</p>
                                <div className="flex flex-col justify-center mb-4">
                                    <p className="text-muted-foreground font-neue md:text-xl">Quarta - Domingo</p>
                                    <p className="text-muted-foreground font-neue md:text-xl">18:00 - 22:00</p>
                                </div>
                            </div>

                        <div className="w-full py-2 text-xs text-muted-foreground">
                            <span className="opacity-60 font-mono">Versão {__APP_VERSION__}</span>
                        </div>

                        <Separator className="my-6" />

                            <div className="pr-4 mb-4">
                                <Suspense fallback={<Loading />}>
                                    <Await resolve={fazerPedidoPublicURL}>
                                        {(url) => {
                                            return <FazerPedidoButton cnLabel="text-2xl tracking-wider" externalLinkURL={url} />
                                        }}
                                    </Await>
                                </Suspense>

                            </div>

                        </WebsiteNavigationSidebar>
                    </div>
                </div>

            </div>

            {/* Barra de informação de contato */}

            <div className=" bg-white   flex items-center justify-between border-t border-b px-4 py-2">
                <div className="flex gap-4 items-center">
                    <ExternalLink to={GLOBAL_LINKS.instagram.href} aria-label={GLOBAL_LINKS.instagram.title} ariaLabel="Link pagina instagram"
                    >
                        <InstagramLogoIcon color="black" className="w-[16px] h-[16px] md:w-[24px] md:h-[24px]" />
                        {/* <span className="font-semibold tracking-wide text-[12px]">Instagram</span> */}
                    </ExternalLink>
                    <ExternalLink to={GLOBAL_LINKS.maps.href} aria-label={GLOBAL_LINKS.maps.title} ariaLabel="Link para o google maps"
                    >
                        <MapPin color="black" className="w-[16px] h-[16px] md:w-[24px] md:h-[24px]" />
                        {/* <span className="font-semibold tracking-wide text-[12px]">Maps</span> */}
                    </ExternalLink>
                </div>

                <WhatsappExternalLink
                    phoneNumber="46991272525"
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Olá, gostaria fazer um pedido"}
                    className="flex flex-col gap-1 items-center cursor-pointer active:bg-black/50"
                >
                    <span className="font-mono  text-[.85rem] md:text-lg font-semibold">(46) 99127-2525</span>

                </WhatsappExternalLink>
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
            {currentPage === "other" && <PushOptIn vapidPublicKey={vapidPublicKey} />}

        </header>
    )
}


const ScrollingBanner = ({ children, cnContainer, style }: { children?: ReactNode, cnContainer?: string, style?: React.CSSProperties }) => {
    const content = (
        <div className="flex items-center gap-4 px-6">
            {children}
        </div>
    );

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
                className="text-center text-lg font-semibold text-black animate-scrollingText whitespace-nowrap flex w-max"
            >
                {content}
                <div aria-hidden="true">
                    {content}
                </div>
            </div>
        </div>
    );
};




function CompanyInfo({ cnContainer }: { cnContainer?: string }) {

    return (
        <section>
            <div className={
                cn(
                    "bg-banner md:bg-banner-md bg-center bg-cover bg-no-repeat min-h-[150px] flex items-end justify-end py-2 mb-2 mr-2",
                    cnContainer
                )
            }>
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

            <div className="flex flex-col font-neue">
                <h2 className="font-semibold md:text-xl tracking-wide uppercase">A Modo Mio | Pizzeria Italiana</h2>
                <h3 className="text-muted-foreground text-sm tracking-wider uppercase">Pizza Al Taglio & Delivery</h3>
            </div>

            <div className="text-sm  text-muted-foreground mb-2 font-neue">
                <p>Rua Arariboia 64 - Pato Branco</p>
            </div>


        </section>

    )
}

function CardapioFooter() {
    const { fazerPedidoPublicURL } = useLoaderData<typeof loader>();

    return (
        <footer className="fixed bottom-0 w-full h-[70px] bg-white px-4 flex items-center justify-between border-t border-gray-200
        z-10 md:max-w-6xl md:-translate-x-1/2 md:left-1/2
        ">
            {/* Botão Tamanhos à esquerda */}
            <div className="flex">
                <CardapioSizesDialog />
            </div>

            {/* Botão flutuante central */}
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-6 z-20">
                <Suspense fallback={<span>Carregando...</span>}>
                    <Await resolve={fazerPedidoPublicURL}>
                        {(url) => (
                            <div className="flex flex-col gap-1">
                                <FazerPedidoButton
                                    // variant="accent"
                                    cnLabel="text-md tracking-wider font-semibold font-neue"
                                    externalLinkURL={url}
                                />
                                <div className="flex flex-col justify-center items-center gap-0 ">
                                    <p className="font-neue font-semibold text-[10px]">Hórarios de funcionamento</p>
                                    <p className="text-muted-foreground font-neue text-xs ">QUA a DOM das 18h às 22h</p>
                                </div>
                            </div>
                        )}
                    </Await>
                </Suspense>
            </div>

            {/* Botão Tamanhos à direita (se for necessário) */}
            <div className="flex">
                <CardapioSizesDialog />
            </div>
        </footer>
    );
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


type SizesSelection = "individual" | "pequeno" | "medio" | "familia";

const SIZE_ORDER: SizesSelection[] = ["individual", "pequeno", "medio", "familia"];

const sizeConfig: Record<
    SizesSelection,
    {
        label: string;
        serves: string;
        flavors: string;
        dims: string;
        donuts: number;
        imgW: string;
    }
> = {
    individual: {
        label: "Individual",
        serves: "Serve até 1 pessoa",
        flavors: "Máximo 1 sabor",
        dims: "aprox. 25x15cm",
        donuts: 1,
        imgW: "w-[50px]",
    },
    pequeno: {
        // por enquanto, exatamente igual ao "Individual"
        label: "Pequeno",
        serves: "Serve até 1 pessoa",
        flavors: "Máximo 1 sabor",
        dims: "aprox. metade de uma média",
        donuts: 1,
        imgW: "w-[60px]", // levemente maior para diferenciar visualmente
    },
    medio: {
        label: "Médio",
        serves: "Serve até 2 pessoas",
        flavors: "Máximo 2 sabores",
        dims: "aprox. 40x20cm (8 fatias)",
        donuts: 2,
        imgW: "w-[80px]",
    },
    familia: {
        label: "Família",
        serves: "Serve até 6 pessoas",
        flavors: "Máximo 4 sabores",
        dims: "aprox. 60x40cm (16 fatias)",
        donuts: 4,
        imgW: "w-[120px]",
    },
};

export function CardapioSizesDialog() {
    const [currentSize, setCurrentSize] = useState<SizesSelection>("individual");

    const onKeySelect: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            (e.currentTarget as HTMLButtonElement).click();
            e.preventDefault();
        }
    };

    function ButtonSelection({ size }: { size: SizesSelection }) {
        const cfg = sizeConfig[size];
        const active = currentSize === size;

        return (
            <button
                type="button"
                role="tab"
                aria-pressed={active}
                aria-selected={active}
                onKeyDown={onKeySelect}
                onClick={() => setCurrentSize(size)}
                className={cn(
                    "group relative flex flex-col items-center justify-center gap-y-4 rounded-xl border transition h-[130px]",
                    "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40",
                    active
                        ? "border-brand-blue bg-brand-blue/5"
                        : "border-zinc-200 bg-white"
                )}
            >
                <img
                    src="/images/cardapio-web-app/pizza-placeholder-sm.png"
                    alt={`Tamanho ${cfg.label}`}
                    className={cn(cfg.imgW, "h-auto")}
                    draggable={false}
                />
                <span className="mt-2 font-neue text-sm font-semibold tracking-wide uppercase">
                    {cfg.label}
                </span>

                {active && (
                    <span className="absolute -top-2 right-2 rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Selecionado
                    </span>
                )}
            </button>
        );
    }

    const current = sizeConfig[currentSize];

    return (
        <CardapioFooterMenuItemDialog
            triggerComponent={
                <div className="flex flex-col items-center justify-center">
                    <Proportions className="col-span-1 md:col-span-2" />
                    <span className="font-neue text-[10px] uppercase tracking-widest">Tamanhos</span>
                </div>
            }
        >
            <div className="h-[580px] overflow-auto py-4">
                <div className="mb-6">
                    <h3 className="font-neue text-2xl font-semibold tracking-tight">
                        Tamanhos disponíveis
                    </h3>
                    <span className="text-sm text-zinc-600">
                        Selecione o tamanho para visualizar os detalhes
                    </span>
                </div>

                {/* Botões de tamanho */}
                <div
                    role="tablist"
                    aria-label="Selecionar tamanho"
                    className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                >
                    {SIZE_ORDER.map((s) => (
                        <ButtonSelection key={s} size={s} />
                    ))}
                </div>

                <Separator className="my-6" />

                {/* Detalhes do tamanho */}
                <div className="mx-auto flex max-w-sm flex-col items-center gap-y-2 text-center">
                    <h4 className="mb-2 font-neue text-lg font-semibold uppercase ">
                        Tamanho {current.label}
                    </h4>

                    <div className="grid grid-cols-3 gap-x-4 font-neue">

                        {/* Serve */}
                        <div className="flex flex-col items-center gap-2 leading-tight text-sm">
                            {currentSize === "familia" || currentSize === "medio" ? (
                                <Users size={32} />
                            ) : (
                                <User size={32} />
                            )}
                            <span>{current.serves}</span>
                        </div>

                        {/* Sabores */}
                        <div className="flex flex-col items-center gap-2 leading-tight text-sm">
                            <div className="flex gap-1">
                                {Array.from({ length: current.donuts }).map((_, i) => (
                                    <Donut key={i} size={32} />
                                ))}
                            </div>
                            <span>{current.flavors}</span>
                        </div>

                        {/* Dimensões */}
                        <div className="flex flex-col items-center gap-2 leading-tight text-sm">
                            <Proportions size={32} />
                            <span>{current.dims}</span>
                        </div>

                    </div>
                </div>
            </div>
        </CardapioFooterMenuItemDialog>
    );
}
