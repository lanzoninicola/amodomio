// app/routes/cardapio._index.tsx

import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { InstagramLogoIcon } from "@radix-ui/react-icons";
import { Await, defer, Link, useLoaderData, useRouteError, useRouteLoaderData, useSearchParams } from "@remix-run/react";
import { MapPin, SearchIcon } from "lucide-react";
import React, { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import ExternalLink from "~/components/primitives/external-link/external-link";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
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
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { trackCardapioFacebookPixelTrigger } from "~/domain/cardapio/facebook-pixel.client";
import type { loader as cardapioLayoutLoader } from "./cardapio";

export const headers: HeadersFunction = () => ({
    "Cache-Control": "s-maxage=1, stale-while-revalidate=59"
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
                            id: postId
                        }
                    }
                }
            })
        );

        if (err) {
            return badRequest({
                action: "post-like-it",
                likeAmount
            });
        }

        return ok({
            action: "post-like-it",
            likeAmount
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
                            id: postId
                        }
                    }
                }
            })
        );

        if (err) {
            return badRequest({
                action: "post-share-it",
                shareAmount
            });
        }

        return ok({
            action: "post-share-it",
            shareAmount
        });
    }

    return null;
}

export default function CardapioWebIndex() {
    const { items, tags, reelUrls, reelsEnabled, menuItemInterestEnabled, likesEnabled } = useLoaderData<typeof loader>();
    const cardapioLayoutData = useRouteLoaderData<typeof cardapioLayoutLoader>("routes/cardapio");
    const [showLikeCelebration, setShowLikeCelebration] = useState(false);
    const [showHighlightsSheet, setShowHighlightsSheet] = useState(false);
    const [likeCelebrationSeed, setLikeCelebrationSeed] = useState(1);
    const [searchParams, setSearchParams] = useSearchParams();
    const forceLikeOverlay = false;

    useEffect(() => {
        const handler = () => {
            setLikeCelebrationSeed(Date.now());
            setShowLikeCelebration(true);
        };

        window.addEventListener("cardapio:like-celebration", handler);
        return () => window.removeEventListener("cardapio:like-celebration", handler);
    }, []);

    useEffect(() => {
        if (searchParams.get("dicas") !== "1") return;

        setShowHighlightsSheet(true);
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete("dicas");
        setSearchParams(nextSearchParams, { replace: true });
    }, [searchParams, setSearchParams]);

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
        <section className="flex flex-col mb-24 pt-16 md:pt-48" data-element="cardapio-index">
            <LikeCelebrationOverlay
                isOpen={forceLikeOverlay || showLikeCelebration}
                seed={likeCelebrationSeed}
                onClose={() => setShowLikeCelebration(false)}
            />

            <Sheet open={showHighlightsSheet} onOpenChange={setShowHighlightsSheet}>
                <SheetContent side="left" className="w-[92vw] overflow-y-auto p-0 md:hidden">
                    <SheetHeader className="px-4 pb-2 pt-6 text-left">
                        <SheetTitle className="font-neue text-base uppercase tracking-widest">
                            Inspirações
                        </SheetTitle>
                    </SheetHeader>
                    <CardapioHighlightsSheetContactHeader />
                    <CardapioHighlightsSheetSearchButton />

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
                                            <Await resolve={cardapioLayoutData?.fazerPedidoPublicURL ?? WEBSITE_LINKS.cardapioFallbackURL.href}>
                                                {(url) => (
                                                    <FazerPedidoButton
                                                        cnLabel="text-md tracking-wider font-semibold font-neue"
                                                        externalLinkURL={url}
                                                        onClick={() => trackCardapioFacebookPixelTrigger("fazer_pedido_click")}
                                                    />
                                                )}
                                            </Await>
                                        </Suspense>
                                    </div>
                                </div>
                            )}
                        </Await>
                    </Suspense>
                </SheetContent>
            </Sheet>


            <Suspense fallback={null}>
                <Await resolve={items}>
                    {(items) => {
                        return (
                            <CardapioHighlightsSection
                                items={items}
                                likesEnabled={likesEnabled}
                                reelUrls={reelUrls}
                                reelsEnabled={reelsEnabled}
                            />
                        );
                    }}
                </Await>
            </Suspense>

            <Suspense fallback={<Loading />}>
                <Await resolve={Promise.all([tags, items])}>
                    {([loadedTags, loadedItems]) => {
                        return (
                            <CardapioCatalogSection
                                items={loadedItems}
                                tags={loadedTags}
                                interestTrackingEnabled={menuItemInterestEnabled}
                                likesEnabled={likesEnabled}
                            />
                        );
                    }}
                </Await>
            </Suspense>
        </section>
    );
}

function CardapioHighlightsSheetSearchButton() {
    return (
        <div className="px-4 pb-4">
            <Link
                to="/cardapio/buscar"
                className="flex h-12 w-full items-center justify-center gap-2 bg-zinc-950 px-4 font-neue text-sm font-semibold uppercase tracking-widest text-white"
            >
                <SearchIcon className="h-4 w-4" />
                Buscar sabores
            </Link>
        </div>
    );
}

function CardapioHighlightsSheetContactHeader() {
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
                    Horários: Qua <span className="lowercase">a</span> Dom, 18h <span className="lowercase">às</span> 22h
                </p>
            </div>
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
