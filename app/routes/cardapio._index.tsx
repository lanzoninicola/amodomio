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
import React, { Suspense, useEffect, useState } from "react";
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

                <main className="min-h-full md:ml-[300px] md:mr-[72px] lg:ml-[340px] 2xl:mx-auto 2xl:max-w-[780px]">
                  <CardapioCatalogSection
                    items={loadedItems}
                    tags={loadedTags}
                    interestTrackingEnabled={menuItemInterestEnabled}
                    likesEnabled={likesEnabled}
                    desktopFeedLayout
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
