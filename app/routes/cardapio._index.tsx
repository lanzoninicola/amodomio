// app/routes/cardapio._index.tsx

import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Await,
  defer,
  Link,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from "@remix-run/react";
import React, { Suspense, useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import Loading from "~/components/loading/loading";
import CardapioDatabaseUnavailable from "~/domain/cardapio/components/cardapio-database-unavailable/cardapio-database-unavailable";
import prismaClient from "~/lib/prisma/client.server";
import CardapioErrorRedirect from "~/domain/cardapio/components/cardapio-error-redirect/cardapio-error-redirect";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import { isDatabaseConnectivityError } from "~/lib/errors/connectivity";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { loadCardapioIndexData } from "~/domain/cardapio/cardapio-index.server";
import {
  CardapioCatalogSection,
  CardapioHighlightsSection,
  LikeCelebrationOverlay,
} from "~/domain/cardapio/components/cardapio-index/cardapio-index-sections";
import CardapioOrderCtaButton from "~/domain/cardapio/components/cardapio-order-cta-button";
import CardapioDesktopSidebarHeader from "~/domain/cardapio/components/cardapio-desktop-sidebar-header";
import { trackCardapioFacebookPixelTrigger } from "~/domain/cardapio/facebook-pixel.client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "~/components/ui/carousel";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import type {
  CardapioIndexItem,
  GroupedItems,
} from "~/domain/cardapio/cardapio-index.shared";
import type { loader as cardapioLayoutLoader } from "./cardapio";

export const headers: HeadersFunction = () => ({
  "Cache-Control": "s-maxage=1, stale-while-revalidate=59",
});

export async function loader({ request }: LoaderFunctionArgs) {
  return defer(await loadCardapioIndexData(request));
}

export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (values?.action === "post-like-it") {
    const postId = values?.postId as string;
    const amount = 1;

    const [err, likeAmount] = await prismaIt(
      prismaClient.postLike.create({
        data: {
          createdAt: new Date().toISOString(),
          amount,
          Post: {
            connect: {
              id: postId,
            },
          },
        },
      })
    );

    if (err) {
      return badRequest({
        action: "post-like-it",
        likeAmount,
      });
    }

    return ok({
      action: "post-like-it",
      likeAmount,
    });
  }

  if (values?.action === "post-share-it") {
    const postId = values?.postId as string;

    const [err, shareAmount] = await prismaIt(
      prismaClient.postShare.create({
        data: {
          createdAt: new Date().toISOString(),
          Post: {
            connect: {
              id: postId,
            },
          },
        },
      })
    );

    if (err) {
      return badRequest({
        action: "post-share-it",
        shareAmount,
      });
    }

    return ok({
      action: "post-share-it",
      shareAmount,
    });
  }

  return null;
}

export default function CardapioWebIndex() {
  const {
    items,
    tags,
    reelUrls,
    reelsEnabled,
    menuItemInterestEnabled,
    likesEnabled,
    filterViewMode,
  } = useLoaderData<typeof loader>();
  const [showLikeCelebration, setShowLikeCelebration] = useState(false);
  const [likeCelebrationSeed, setLikeCelebrationSeed] = useState(1);
  const forceLikeOverlay = false;

  useEffect(() => {
    const handler = () => {
      setLikeCelebrationSeed(Date.now());
      setShowLikeCelebration(true);
    };

    window.addEventListener("cardapio:like-celebration", handler);
    return () =>
      window.removeEventListener("cardapio:like-celebration", handler);
  }, []);

  useEffect(() => {
    if (!forceLikeOverlay) return;
    setShowLikeCelebration(true);
    const intervalId = window.setInterval(() => {
      setLikeCelebrationSeed(Date.now());
    }, 1800);
    return () => window.clearInterval(intervalId);
  }, [forceLikeOverlay]);

  useEffect(() => {
    if (!showLikeCelebration || forceLikeOverlay) return;
    const timeoutId = window.setTimeout(() => {
      setShowLikeCelebration(false);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [showLikeCelebration, likeCelebrationSeed]);

  return (
    <section
      className="mb-28 flex flex-col pt-[calc(4rem+env(safe-area-inset-top))] md:fixed md:inset-0 md:z-20 md:mb-0 md:block md:overflow-y-auto md:bg-white md:pt-0"
      data-element="cardapio-index"
    >
      <LikeCelebrationOverlay
        isOpen={forceLikeOverlay || showLikeCelebration}
        seed={likeCelebrationSeed}
        onClose={() => setShowLikeCelebration(false)}
      />

      <Suspense fallback={null}>
        <Await resolve={items}>
          {(items) => {
            return (
              <div className="md:hidden">
                <CardapioHighlightsSection
                  items={items}
                  likesEnabled={likesEnabled}
                  reelUrls={reelUrls}
                  reelsEnabled={reelsEnabled}
                />
              </div>
            );
          }}
        </Await>
      </Suspense>

      <Suspense fallback={<Loading />}>
        <Await resolve={Promise.all([tags, items])}>
          {([loadedTags, loadedItems]) => {
            return (
              <>
                <aside className="fixed inset-y-0 left-0 hidden w-[300px] overflow-y-auto border-r border-zinc-200 bg-white px-5 py-6 md:block lg:w-[340px]">
                  <DesktopCardapioSidebar
                    items={loadedItems}
                    likesEnabled={likesEnabled}
                    reelUrls={reelUrls}
                    reelsEnabled={reelsEnabled}
                  />
                </aside>

                <ValentinesDayPromotionCarousel />

                <main className="min-h-full md:ml-[300px] md:mr-[252px] lg:ml-[340px] lg:mr-[304px] 2xl:mx-auto 2xl:max-w-[780px]">
                  <CardapioCatalogSection
                    items={loadedItems}
                    tags={loadedTags}
                    interestTrackingEnabled={menuItemInterestEnabled}
                    likesEnabled={likesEnabled}
                    desktopFeedLayout
                    filterViewMode={filterViewMode}
                  />
                </main>

                <DesktopFloatingOrderButton />
              </>
            );
          }}
        </Await>
      </Suspense>
    </section>
  );
}

const VALENTINES_DAY_PROMOTION_IMAGES = [
  "https://media.amodomio.com.br/images/marketing/2026-DIA-DOS-NAMORADOS/1---2026-dia-dos-namorados.png",
  "https://media.amodomio.com.br/images/marketing/2026-DIA-DOS-NAMORADOS/2---2026-dia-dos-namorados.png",
  "https://media.amodomio.com.br/images/marketing/2026-DIA-DOS-NAMORADOS/3---2026-dia-dos-namorados.png",
];

const VALENTINES_DAY_PROMOTION_FULLSCREEN_IMAGES = [
  "https://media.amodomio.com.br/images/marketing/2026-DIA-DOS-NAMORADOS/1---2026-dia-dos-namorados-1080p.png",
  "https://media.amodomio.com.br/images/marketing/2026-DIA-DOS-NAMORADOS/2---2026-dia-dos-namorados-1080p.png",
  "https://media.amodomio.com.br/images/marketing/2026-DIA-DOS-NAMORADOS/3---2026-dia-dos-namorados-1080p.png",
];

function ValentinesDayPromotionCarousel() {
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 2400,
      stopOnInteraction: true,
      stopOnMouseEnter: true,
    })
  );
  const [api, setApi] = useState<CarouselApi>();
  const [mobileExpandedApi, setMobileExpandedApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  useEffect(() => {
    if (!api) return;

    const updateCurrentSlide = () => setCurrentSlide(api.selectedScrollSnap());
    updateCurrentSlide();
    api.on("select", updateCurrentSlide);

    return () => {
      api.off("select", updateCurrentSlide);
    };
  }, [api]);

  useEffect(() => {
    if (!mobileExpandedApi) return;

    mobileExpandedApi.scrollTo(currentSlide, true);

    const updateCurrentSlide = () => {
      const selectedSlide = mobileExpandedApi.selectedScrollSnap();
      setCurrentSlide(selectedSlide);
      api?.scrollTo(selectedSlide, true);
    };

    mobileExpandedApi.on("select", updateCurrentSlide);

    return () => {
      mobileExpandedApi.off("select", updateCurrentSlide);
    };
  }, [api, currentSlide, mobileExpandedApi]);

  useEffect(() => {
    if (!api) return;

    if (isExpanded || isMobileExpanded) {
      autoplayPlugin.current.stop();
      return;
    }

    autoplayPlugin.current.play();
  }, [api, isExpanded, isMobileExpanded]);

  return (
    <>
      <div className="mt-8 text-center md:hidden">
        <h2 className="font-lora text-2xl font-bold tracking-tight">
          Dia dos Namorados
        </h2>
        <p className="mt-1 font-neue text-sm font-semibold uppercase text-zinc-500">
          Combo 2 sabores
        </p>
      </div>

      <div
        className={`relative mx-auto mb-6 mt-4 w-[70vw] max-w-[260px] -rotate-1 border border-black/10 bg-[#fffdf8] p-2 pb-5 shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition-[width] duration-300 ease-out md:fixed md:right-6 md:top-6 md:z-30 md:m-0 md:max-w-none md:rotate-0 md:rounded-2xl md:bg-white md:p-1.5 md:shadow-lg lg:right-8 ${
          isExpanded ? "md:z-[60] md:w-[440px]" : "md:w-[220px] lg:w-[260px]"
        }`}
      >
        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          plugins={[autoplayPlugin.current]}
        >
          <CarouselContent className="-ml-0">
            {(isExpanded
              ? VALENTINES_DAY_PROMOTION_FULLSCREEN_IMAGES
              : VALENTINES_DAY_PROMOTION_IMAGES
            ).map((src, index) => (
              <CarouselItem key={src} className="pl-0">
                <div className="relative overflow-hidden md:rounded-xl">
                  <img
                    className={
                      isExpanded
                        ? "hidden h-[calc(100dvh-5rem)] w-full object-contain md:block"
                        : "aspect-[4/5] w-full object-cover"
                    }
                    src={src}
                    alt={`Promoção do Dia dos Namorados, imagem ${
                      index + 1
                    } de ${
                      isExpanded
                        ? VALENTINES_DAY_PROMOTION_FULLSCREEN_IMAGES.length
                        : VALENTINES_DAY_PROMOTION_IMAGES.length
                    }`}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />

                  <button
                    type="button"
                    className="absolute inset-0 flex cursor-zoom-in items-start justify-end bg-transparent p-2 md:hidden"
                    onClick={() => setIsMobileExpanded(true)}
                    aria-label="Ampliar promoção"
                  >
                    <span className="rounded-full bg-black/65 p-2 text-white backdrop-blur-sm">
                      <Maximize2 className="h-4 w-4" />
                    </span>
                  </button>

                  {!isExpanded ? (
                    <button
                      type="button"
                      className="absolute inset-0 hidden cursor-zoom-in items-start justify-end bg-transparent p-2 md:flex"
                      onClick={() => setIsExpanded(true)}
                      aria-label="Ampliar promoção"
                    >
                      <span className="rounded-full bg-black/65 p-2 text-white backdrop-blur-sm">
                        <Maximize2 className="h-4 w-4" />
                      </span>
                    </button>
                  ) : null}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          {isExpanded ? (
            <>
              <CarouselPrevious className="left-3 border-0 bg-black/65 text-white hover:bg-black/80 hover:text-white" />
              <CarouselNext className="right-3 border-0 bg-black/65 text-white hover:bg-black/80 hover:text-white" />
            </>
          ) : null}
        </Carousel>

        <div className="pt-3 text-center md:py-1.5">
          {!isExpanded ? (
            <p className="mb-2 font-neue text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              <span className="md:hidden">Toque para ver a promoção</span>
              <span className="hidden md:inline">
                Clique para ver a promoção
              </span>
            </p>
          ) : null}

          <div className="flex items-center justify-center gap-1.5">
            {VALENTINES_DAY_PROMOTION_IMAGES.map((src, index) => (
              <button
                key={src}
                type="button"
                className={`h-1.5 rounded-full transition-[width,background-color] ${
                  currentSlide === index
                    ? "w-5 bg-zinc-900"
                    : "w-1.5 bg-zinc-300"
                }`}
                onClick={() => api?.scrollTo(index)}
                aria-label={`Ir para imagem ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {isExpanded ? (
          <button
            type="button"
            className="absolute right-3 top-3 z-10 hidden items-center gap-2 rounded-full bg-black/75 px-3 py-2 font-neue text-xs font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90 md:flex"
            onClick={() => setIsExpanded(false)}
            aria-label="Fechar promoção ampliada"
          >
            <X className="h-4 w-4" />
            Fechar
          </button>
        ) : null}
      </div>

      <Dialog open={isMobileExpanded} onOpenChange={setIsMobileExpanded}>
        <DialogContent className="h-[100dvh] w-screen max-w-none border-0 bg-transparent p-2 pt-16 shadow-none md:hidden [&>button]:hidden">
          <DialogTitle className="sr-only">
            Promoção do Dia dos Namorados
          </DialogTitle>

          <div className="fixed left-3 top-3 z-[60]">
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 font-neue text-sm font-bold text-black shadow-xl"
              >
                <ArrowLeft className="h-5 w-5" />
                Voltar ao cardápio
              </button>
            </DialogClose>
          </div>

          <div className="m-auto w-full max-w-[430px] bg-[#fffdf8] p-2 pb-5 shadow-2xl">
            <Carousel
              setApi={setMobileExpandedApi}
              opts={{ align: "start", startIndex: currentSlide }}
            >
              <CarouselContent className="-ml-0">
                {VALENTINES_DAY_PROMOTION_FULLSCREEN_IMAGES.map(
                  (src, index) => (
                    <CarouselItem key={src} className="pl-0">
                      <img
                        className="h-[calc(100dvh-5rem)] w-full object-contain"
                        src={src}
                        alt={`Promoção do Dia dos Namorados, imagem ${
                          index + 1
                        } de ${
                          VALENTINES_DAY_PROMOTION_FULLSCREEN_IMAGES.length
                        }`}
                        decoding="async"
                      />
                    </CarouselItem>
                  )
                )}
              </CarouselContent>
              <CarouselPrevious className="left-3 border-0 bg-black/65 text-white hover:bg-black/80 hover:text-white" />
              <CarouselNext className="right-3 border-0 bg-black/65 text-white hover:bg-black/80 hover:text-white" />
            </Carousel>

            <div className="flex items-center justify-center gap-1.5 pt-4">
              {VALENTINES_DAY_PROMOTION_FULLSCREEN_IMAGES.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  className={`h-1.5 rounded-full transition-[width,background-color] ${
                    currentSlide === index
                      ? "w-5 bg-zinc-900"
                      : "w-1.5 bg-zinc-300"
                  }`}
                  onClick={() => mobileExpandedApi?.scrollTo(index)}
                  aria-label={`Ir para imagem ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DesktopCardapioSidebar({
  items,
  likesEnabled,
  reelUrls,
  reelsEnabled,
}: {
  items: CardapioIndexItem[] | GroupedItems[];
  likesEnabled: boolean;
  reelUrls: string[];
  reelsEnabled: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <CardapioDesktopSidebarHeader />

      <CardapioHighlightsSection
        items={items}
        likesEnabled={likesEnabled}
        reelUrls={reelUrls}
        reelsEnabled={reelsEnabled}
        includeNovelties={false}
        showMobileHiddenContent
        desktopColumnLayout
      />
    </div>
  );
}

function DesktopFloatingOrderButton() {
  const cardapioLayoutData =
    useRouteLoaderData<typeof cardapioLayoutLoader>("routes/cardapio");

  return (
    <div className="fixed bottom-6 right-12 z-50 hidden w-[240px] md:block lg:right-16">
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
                trackCardapioFacebookPixelTrigger("fazer_pedido_click")
              }
            />
          )}
        </Await>
      </Suspense>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const saiposHref = WEBSITE_LINKS.saiposCardapio.href;

  console.error("[cardapio._index] route error boundary", error);

  if (isDatabaseConnectivityError(error)) {
    return <CardapioDatabaseUnavailable error={error} />;
  }

  return <CardapioErrorRedirect redirectHref={saiposHref} />;
}
