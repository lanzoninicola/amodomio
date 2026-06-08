import { InstagramLogoIcon } from "@radix-ui/react-icons";
import {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  Await,
  Link,
  Outlet,
  defer,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from "@remix-run/react";
import {
  Bell,
  Divide,
  Info,
  Instagram,
  LayoutTemplate,
  MapPin,
  Proportions,
  SearchIcon,
} from "lucide-react";
import React, { ReactNode, Suspense, useEffect, useState } from "react";

import ItalyFlag from "~/components/italy-flag/italy-flag";
import Loading from "~/components/loading/loading";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import CardapioOrderCtaButton from "~/domain/cardapio/components/cardapio-order-cta-button";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { WebsiteNavigationSidebar } from "~/domain/website-navigation/components/website-navigation-sidebar";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import PUBLIC_NAVIGATION_LINKS from "~/domain/website-navigation/links/public-navigation";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";
import { PushOptIn } from "~/domain/push/components/push-opt-in";
import useCurrentPage from "~/hooks/use-current-page";
import {
  NotificationCenterProvider,
  useNotificationCenter,
} from "~/domain/push/notification-center-context";
import { PwaInstallPrompt } from "~/domain/pwa/pwa-install-prompt";
import { CardapioSizesContent } from "~/domain/cardapio/components/cardapio-sizes-content";
import CardapioDatabaseUnavailable from "~/domain/cardapio/components/cardapio-database-unavailable/cardapio-database-unavailable";
import CardapioErrorRedirect from "~/domain/cardapio/components/cardapio-error-redirect/cardapio-error-redirect";
import RouteProgressBar from "~/components/route-progress-bar/route-progress-bar";
import { isDatabaseConnectivityError } from "~/lib/errors/connectivity";
import CardapioFacebookPixel from "~/domain/cardapio/components/cardapio-facebook-pixel";
import { trackCardapioFacebookPixelTrigger } from "~/domain/cardapio/facebook-pixel.client";

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
  items: MenuItemWithAssociations[];
}

export const meta: MetaFunction = ({ data }) => {
  return [
    { title: "Cardápio A Modo Mio - Pizzaria Italiana em Pato Branco" },
    {
      name: "description",
      content:
        "É a pizza! Italiana! Um sabor que você nunca experimentou! Descubra no nosso cardápio as melhores pizzas da cidade. Experimente e saboreie a verdadeira italianidade em Pato Branco.",
    },
    {
      name: "og:title",
      content: "Cardápio A Modo Mio - Pizzaria Italiana em Pato Branco",
    },
    {
      name: "og:description",
      content:
        "É a pizza! Italiana! Um sabor que nunca experimentou! Descubra no nosso cardápio as melhores pizzas da cidade. Experimente e saboreie a verdadeira italianidade em Pato Branco.",
    },
    {
      name: "og:image",
      content: "https://www.amodomio.com.br/images/cardapio_og_image.jpg",
    },
    { name: "og:url", content: "https://www.amodomio.com.br/cardapio" },
    {
      name: "og:site_name",
      content: "Cardápio A Modo Mio - Pizzaria Italiana em Pato Branco",
    },
    { name: "og:type", content: "website" },
  ];
};

export const links: LinksFunction = () => [
  { rel: "manifest", href: "/site.webmanifest" },
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: "/favicons/apple-touch-icon.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicons/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicons/favicon-16x16.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "192x192",
    href: "/favicons/android-chrome-192x192.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "512x512",
    href: "/favicons/android-chrome-512x512.png",
  },
  { rel: "shortcut icon", href: "/favicon.ico" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const simulateError = url.searchParams.get("simularErro");
  const simulateErrorByQuery = simulateError === "cardapio-layout";

  const CARDAPIO_SETTINGS_CONTEXT = "cardapio";
  const requestedKeys = [
    "fazer_pedido.public.url",
    "aviso_loja_fechada.yesno",
    "notificacoes.enabled",
  ] as const;

  const defaults = {
    fazerPedidoPublicURL: WEBSITE_LINKS.cardapioFallbackURL.href,
    showLojaFechadaMessage: false,
    notificationsEnabled: false,
  };

  let settingsMap: Record<string, string | null> = {};

  try {
    const globalSettings = await prismaClient.setting.findMany({
      where: {
        context: CARDAPIO_SETTINGS_CONTEXT,
        name: { in: [...requestedKeys] },
      },
      select: { name: true, value: true },
      orderBy: [{ createdAt: "desc" }],
    });

    settingsMap = globalSettings.reduce<Record<string, string | null>>(
      (acc, setting) => {
        if (acc[setting.name] !== undefined) return acc;
        acc[setting.name] = setting.value;
        return acc;
      },
      {}
    );
  } catch (error) {
    console.error(
      "[cardapio] non-blocking settings load failed, using defaults",
      error
    );
  }

  const fPUrl = settingsMap[requestedKeys[0]] ?? defaults.fazerPedidoPublicURL;
  const showLojaFechadaMessage = parseBooleanSetting(
    settingsMap[requestedKeys[1]],
    defaults.showLojaFechadaMessage
  );
  const notificationsEnabled = parseBooleanSetting(
    settingsMap[requestedKeys[2]],
    defaults.notificationsEnabled
  );

  if (simulateErrorByQuery) {
    throw new Error("SIMULACAO_ERRO_CARDAPIO_LAYOUT");
  }

  const { getFacebookPixelRuntimeConfigForPath } = await import(
    "~/domain/cardapio/facebook-pixel.server"
  );
  const facebookPixel = await getFacebookPixelRuntimeConfigForPath(
    url.pathname
  );

  return defer({
    fazerPedidoPublicURL: fPUrl,
    showLojaFechadaMessage,
    notificationsEnabled,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    facebookPixel,
  });
}

export default function CardapioWeb() {
  const currentPage = useCurrentPage();

  const { showLojaFechadaMessage, notificationsEnabled, facebookPixel } =
    useLoaderData<typeof loader>();

  // const sessionId = useClientSessionId();

  // // Controle de renderização no cliente
  // const [isClient, setIsClient] = useState(false);
  // useEffect(() => {
  //     setIsClient(true);
  // }, []);

  // if (!isClient) return null; // ou um spinner, se quiser

  return (
    <NotificationCenterProvider enabled={notificationsEnabled}>
      <RouteProgressBar />
      {facebookPixel ? <CardapioFacebookPixel config={facebookPixel} /> : null}
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

export function ErrorBoundary() {
  const error = useRouteError();
  const saiposHref = WEBSITE_LINKS.saiposCardapio.href;

  console.error("[cardapio] route error boundary", error);

  if (isDatabaseConnectivityError(error)) {
    return <CardapioDatabaseUnavailable error={error} />;
  }

  return <CardapioErrorRedirect redirectHref={saiposHref} />;
}

function shouldShowBanner(date: Date = new Date()) {
  const day = date.getDay(); // 0 = domingo, 1 = segunda, ... 6 = sábado
  return day === 1 || day === 2; // mostra apenas segunda e terça
}

function BannerFechado() {
  const text =
    "Estamos fechado agora! Nosso horarío de funcionamento: Quarta a domingo, das 18h às 22h";
  const [isClosed, setIsClosed] = useState<boolean | null>(null);

  useEffect(() => {
    setIsClosed(shouldShowBanner());
  }, []);

  if (!isClosed) return null;

  return (
    <>
      <ScrollingBanner
        cnContainer="fixed top-0 right-0 w-fit bg-red-500 z-50"
        data-element="banner-fechado"
      >
        <span className="font-neue text-white  font-semibold uppercase tracking-wide">
          {text}
        </span>
      </ScrollingBanner>
      <ScrollingBanner
        cnContainer="fixed bottom-0 right-0 w-fit bg-red-500 z-50"
        data-element="banner-fechado"
      >
        <span className="font-neue text-white font-semibold uppercase tracking-wide">
          {text}
        </span>
      </ScrollingBanner>
    </>
  );
}

function CardapioHeader() {
  const currentPage = useCurrentPage();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const { fazerPedidoPublicURL, notificationsEnabled, vapidPublicKey } =
    useLoaderData<typeof loader>();
  const usesDesktopSidebar =
    location.pathname === WEBSITE_LINKS.cardapioPublic.href ||
    currentPage === "single";

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-30 bg-white md:max-w-6xl md:-translate-x-1/2 md:left-1/2",
        usesDesktopSidebar && "md:hidden"
      )}
    >
      <div className="flex h-[calc(50px+env(safe-area-inset-top))] flex-col border-b border-gray-200 bg-white px-1 pb-3 pt-[calc(0.5rem+env(safe-area-inset-top))] md:h-[70px] md:border-b-0 md:pt-2">
        <div className="grid grid-cols-3 items-center w-full">
          {/* <div className="flex gap-1 items-center" onClick={() => setShowSearch(!showSearch)}>
                        <HamburgerMenuIcon className="w-6 h-6" />
                        <span className="font-neue text-[10px] font-semibold  uppercase">Menu</span>
                    </div> */}

          <Link
            to={WEBSITE_LINKS.cardapioPublic.href}
            className="flex col-span-2"
          >
            <div className="px-4 -py-3">
              <Logo
                color="black"
                circle
                className="w-8 p-0 md:hidden"
                tagline={false}
              />
              <Logo
                color="black"
                onlyText={true}
                className="hidden h-[50px] w-[150px] md:block"
                tagline={false}
              />
            </div>
          </Link>

          <div className="w-full flex items-center gap-x-2 justify-end col-span-1">
            {notificationsEnabled && <NotificationBell />}
            <Link to={"buscar"} className="hidden md:block">
              <div
                className="flex h-10 w-10 items-center justify-center cursor-pointer"
                onClick={() => setShowSearch(!showSearch)}
              >
                <SearchIcon color={"black"} className="h-5 w-5" />
                {/* <span className="font-neue text-[10px] font-semibold  uppercase text-brand-blue">Pesquisar</span> */}
              </div>
            </Link>
            <div className="hidden md:block">
              <WebsiteNavigationSidebar
                homeLink={{
                  label: WEBSITE_LINKS.cardapioPublic.title,
                  to: WEBSITE_LINKS.cardapioPublic.href,
                }}
                navigationLinks={PUBLIC_NAVIGATION_LINKS}
                buttonTrigger={{
                  label: "",
                  classNameLabel:
                    "block font-neue text-[10px] font-semibold uppercase",
                  classNameButton:
                    "justify-end h-full text-black bg-transparent hover:bg-transparent hover:text-black px-0",
                }}
                cnLink="font-neue md:text-xl uppercase tracking-widest"
                preMenuContent={<CompanyInfo />}
              >
                <div className="flex flex-col justify-center mb-2 font-neue">
                  <p className=" font-semibold md:text-xl leading-relaxed uppercase tracking-wide">
                    Hórarios de funcionamento
                  </p>
                  <div className="flex flex-col justify-center mb-4">
                    <p className="text-muted-foreground font-neue md:text-xl">
                      Quarta - Domingo
                    </p>
                    <p className="text-muted-foreground font-neue md:text-xl">
                      18:00 - 22:00
                    </p>
                  </div>
                </div>

                <div className="pr-4 mb-4">
                  <Suspense fallback={<Loading />}>
                    <Await resolve={fazerPedidoPublicURL}>
                      {(url) => {
                        return (
                          <FazerPedidoButton
                            cnLabel="text-2xl tracking-wider"
                            externalLinkURL={url}
                            onClick={() =>
                              trackCardapioFacebookPixelTrigger(
                                "fazer_pedido_click"
                              )
                            }
                          />
                        );
                      }}
                    </Await>
                  </Suspense>
                </div>
              </WebsiteNavigationSidebar>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de informação de contato */}

      <div className="hidden bg-white items-center justify-between border-t border-b px-4 py-2 md:flex">
        <div className="flex gap-4 items-center">
          <ExternalLink
            to={WEBSITE_LINKS.instagram.href}
            aria-label={WEBSITE_LINKS.instagram.title}
            ariaLabel="Link pagina instagram"
          >
            <InstagramLogoIcon
              color="black"
              className="w-[16px] h-[16px] md:w-[24px] md:h-[24px]"
            />
            {/* <span className="font-semibold tracking-wide text-[12px]">Instagram</span> */}
          </ExternalLink>
          <ExternalLink
            to={WEBSITE_LINKS.maps.href}
            aria-label={WEBSITE_LINKS.maps.title}
            ariaLabel="Link para o google maps"
          >
            <MapPin
              color="black"
              className="w-[16px] h-[16px] md:w-[24px] md:h-[24px]"
            />
            {/* <span className="font-semibold tracking-wide text-[12px]">Maps</span> */}
          </ExternalLink>
        </div>

        <WhatsappExternalLink
          phoneNumber="46991272525"
          ariaLabel="Envia uma mensagem com WhatsApp"
          message={"Olá, gostaria fazer um pedido"}
          className="flex flex-col gap-1 items-center cursor-pointer active:bg-black/50"
        >
          <span className="font-mono  text-[.85rem] md:text-lg font-semibold">
            (46) 99127-2525
          </span>
        </WhatsappExternalLink>
      </div>

      <div className="hidden bg-black items-center justify-center h-[24px] md:flex md:h-[32px]">
        <p className="font-neue text-white text-[11px] md:text-sm uppercase tracking-wider font-semibold">
          Hórarios de funcionamento: Qua <span className="lowercase">a</span>{" "}
          Dom, <span className="lowercase">das</span> 18h{" "}
          <span className="lowercase">às</span> 22h
        </p>
      </div>

      {/* <ScrollingBanner
                cnContainer="h-[30px] md:h-[40px] bg-white border-b border-t border-solid border-black flex"
            >
                <div className="flex items-center gap-2 justify-center">

                    <ItalyFlag className="w-4 h-4 md:w-6 md:h-6" />
                    <p className="font-neue text-[15px] uppercase tracking-wider md:text-lg">
                        Todas as nossas pizzas são preparadas com farinha e molho de tomate importados da Itália
                    </p>
                </div>

            </ScrollingBanner> */}
      {currentPage === "other" && notificationsEnabled && (
        <PushOptIn vapidPublicKey={vapidPublicKey} />
      )}
    </header>
  );
}

function NotificationBell() {
  const { unreadCount } = useNotificationCenter();

  return (
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
  );
}

const ScrollingBanner = ({
  children,
  cnContainer,
  style,
}: {
  children?: ReactNode;
  cnContainer?: string;
  style?: React.CSSProperties;
}) => {
  const content = (
    <div className="flex items-center gap-4 px-6">{children}</div>
  );

  return (
    <div
      className={cn("overflow-hidden whitespace-nowrap", cnContainer)}
      style={style}
    >
      <div className="text-center text-lg font-semibold text-black animate-scrollingText whitespace-nowrap flex w-max">
        {content}
        <div aria-hidden="true">{content}</div>
      </div>
    </div>
  );
};

function CompanyInfo({ cnContainer }: { cnContainer?: string }) {
  return (
    <section>
      <div
        className={cn(
          "bg-banner md:bg-banner-md bg-center bg-cover bg-no-repeat min-h-[150px] flex items-end justify-end py-2 mb-2 mr-2",
          cnContainer
        )}
      >
        <div className="flex justify-end gap-4 px-4">
          <Link
            to={WEBSITE_LINKS.instagram.href}
            aria-label={WEBSITE_LINKS.instagram.title}
            className="flex items-center justify-center gap-1 rounded-full backdrop-blur-lg bg-black/30 w-[48px] h-[48px]"
          >
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
          <Link
            to={WEBSITE_LINKS.maps.href}
            aria-label={WEBSITE_LINKS.maps.title}
            className="flex items-center justify-center gap-1 rounded-full backdrop-blur-lg bg-black/30 w-[48px] h-[48px]"
          >
            <MapPin size={24} color="white" />
            {/* <span className="font-semibold tracking-wide text-[12px]">Maps</span> */}
          </Link>
        </div>
      </div>

      <div className="flex flex-col font-neue">
        <h2 className="font-semibold md:text-xl tracking-wide uppercase">
          A Modo Mio | Pizzeria Italiana
        </h2>
        <h3 className="text-muted-foreground text-sm tracking-wider uppercase">
          Pizza Al Taglio & Delivery
        </h3>
      </div>

      <div className="text-sm  text-muted-foreground mb-2 font-neue">
        <p>Rua Arariboia 64 - Pato Branco</p>
      </div>
    </section>
  );
}

function CardapioFooter() {
  const { fazerPedidoPublicURL } = useLoaderData<typeof loader>();

  return (
    <footer
      className="fixed bottom-0 grid w-full grid-cols-[auto_1fr] items-center gap-3 border-t border-gray-200 bg-white px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]
        z-10 md:hidden
        "
    >
      <div className="flex shrink-0 items-center gap-3 md:gap-4">
        <TamanhosLinkButton />
        <CardapioHighlightsFooterButton />
      </div>

      {/* Botão central */}
      <Suspense fallback={<span>Carregando...</span>}>
        <Await resolve={fazerPedidoPublicURL}>
          {(url) => (
            <div className="min-w-0">
              <CardapioOrderCtaButton
                externalLinkURL={url}
                onClick={() =>
                  trackCardapioFacebookPixelTrigger("fazer_pedido_click")
                }
              />
            </div>
          )}
        </Await>
      </Suspense>
    </footer>
  );
}

function TamanhosLinkButton() {
  return (
    <Link
      to={WEBSITE_LINKS.cardapioTamanhosPagina.href}
      className="flex touch-manipulation rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      prefetch="intent"
      aria-label="Ver tamanhos disponíveis"
    >
      <div className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg active:bg-black/5 md:h-12 md:w-14 md:hover:bg-black/5">
        <Proportions className="h-5 w-5 md:h-6 md:w-6" />
        <span className="font-neue text-[8px] uppercase tracking-wide md:text-[10px]">
          Tamanhos
        </span>
      </div>
    </Link>
  );
}

function CardapioHighlightsFooterButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const openHighlights = () => {
    if (location.pathname === WEBSITE_LINKS.cardapioPublic.href) {
      window.dispatchEvent(new Event("cardapio:open-highlights"));
      return;
    }

    navigate(`${WEBSITE_LINKS.cardapioPublic.href}?dicas=1`);
  };

  return (
    <button
      type="button"
      className="flex h-11 w-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg active:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black md:hidden"
      onClick={openHighlights}
      aria-label="Abrir dicas do cardápio"
    >
      <Info className="h-5 w-5" />
      <span className="font-neue text-[8px] uppercase tracking-wide">
        Dicas
      </span>
    </button>
  );
}
