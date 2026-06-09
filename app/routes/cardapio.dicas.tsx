import { InstagramLogoIcon } from "@radix-ui/react-icons";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  Await,
  defer,
  Link,
  useLoaderData,
  useRouteLoaderData,
} from "@remix-run/react";
import { ArrowLeft, MapPin, SearchIcon } from "lucide-react";
import { Suspense } from "react";

import Loading from "~/components/loading/loading";
import ExternalLink from "~/components/primitives/external-link/external-link";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import { loadCardapioIndexData } from "~/domain/cardapio/cardapio-index.server";
import { CardapioHighlightsSection } from "~/domain/cardapio/components/cardapio-index/cardapio-index-sections";
import CardapioOrderCtaButton from "~/domain/cardapio/components/cardapio-order-cta-button";
import { trackCardapioFacebookPixelTrigger } from "~/domain/cardapio/facebook-pixel.client";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";

import type { loader as cardapioLayoutLoader } from "./cardapio";

export const meta: MetaFunction = () => [
  { title: "Dicas do Cardápio - A Modo Mio" },
  {
    name: "description",
    content: "Inspirações e sugestões para escolher seu próximo sabor.",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  return defer(await loadCardapioIndexData(request));
}

export default function CardapioDicas() {
  const { items, reelUrls, reelsEnabled, likesEnabled } =
    useLoaderData<typeof loader>();
  const cardapioLayoutData =
    useRouteLoaderData<typeof cardapioLayoutLoader>("routes/cardapio");

  return (
    <>
      <main className="mb-28 pt-[calc(4rem+env(safe-area-inset-top))] md:hidden">
        <div className="flex items-center gap-3 px-4 pb-4 pt-2">
          <a
            href={WEBSITE_LINKS.cardapioPublic.href}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-black/5"
            aria-label="Voltar ao cardápio"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <h1 className="font-neue text-base font-semibold uppercase tracking-widest">
            Inspirações
          </h1>
        </div>

        <CardapioDicasContactHeader />

        <div className="px-4 pb-4">
          <Link
            to="/cardapio/buscar"
            className="flex h-12 w-full items-center justify-center gap-2 bg-zinc-950 px-4 font-neue text-sm font-semibold uppercase tracking-widest text-white"
          >
            <SearchIcon className="h-4 w-4" />
            Buscar sabores
          </Link>
        </div>

        <Suspense fallback={<Loading />}>
          <Await resolve={items}>
            {(items) => (
              <div className="pb-8 pt-2">
                <CardapioHighlightsSection
                  items={items}
                  likesEnabled={likesEnabled}
                  reelUrls={reelUrls}
                  reelsEnabled={reelsEnabled}
                  includeNovelties={false}
                  showMobileHiddenContent
                />

                <div className="px-4 pb-4 pt-2">
                  <Suspense fallback={<span>Carregando...</span>}>
                    <Await
                      resolve={
                        cardapioLayoutData?.fazerPedidoPublicURL ??
                        WEBSITE_LINKS.cardapioFallbackURL.href
                      }
                    >
                      {(url) => (
                        <CardapioOrderCtaButton
                          externalLinkURL={url}
                          onClick={() =>
                            trackCardapioFacebookPixelTrigger(
                              "fazer_pedido_click"
                            )
                          }
                        />
                      )}
                    </Await>
                  </Suspense>
                </div>
              </div>
            )}
          </Await>
        </Suspense>
      </main>

      <div className="hidden min-h-screen items-center justify-center md:flex">
        <Link
          to={WEBSITE_LINKS.cardapioPublic.href}
          className="font-neue text-sm font-semibold uppercase tracking-widest underline"
        >
          Voltar ao cardápio
        </Link>
      </div>
    </>
  );
}

function CardapioDicasContactHeader() {
  return (
    <div className="mx-4 mb-4 rounded-sm bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <ExternalLink
            to={WEBSITE_LINKS.instagram.href}
            aria-label={WEBSITE_LINKS.instagram.title}
            ariaLabel="Link pagina instagram"
          >
            <InstagramLogoIcon color="black" className="h-5 w-5" />
          </ExternalLink>
          <ExternalLink
            to={WEBSITE_LINKS.maps.href}
            aria-label={WEBSITE_LINKS.maps.title}
            ariaLabel="Link para o google maps"
          >
            <MapPin color="black" className="h-5 w-5" />
          </ExternalLink>
        </div>

        <WhatsappExternalLink
          phoneNumber="46991272525"
          ariaLabel="Envia uma mensagem com WhatsApp"
          message={"Olá, gostaria fazer um pedido"}
          className="font-mono text-sm font-semibold"
        >
          (46) 99127-2525
        </WhatsappExternalLink>
      </div>

      <div className="bg-black px-4 py-2 text-center">
        <p className="font-neue text-[11px] font-semibold uppercase tracking-wider text-white">
          Horários: Qua <span className="lowercase">a</span> Dom, 18h{" "}
          <span className="lowercase">às</span> 22h
        </p>
      </div>
    </div>
  );
}
