// app/routes/cardapio._index.tsx

import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, defer, useLoaderData, useRouteError } from "@remix-run/react";
import React, { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
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
    const [showLikeCelebration, setShowLikeCelebration] = useState(false);
    const [likeCelebrationSeed, setLikeCelebrationSeed] = useState(1);
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
        <section className="flex flex-col mb-24 pt-28 md:pt-48" data-element="cardapio-index">
            <LikeCelebrationOverlay
                isOpen={forceLikeOverlay || showLikeCelebration}
                seed={likeCelebrationSeed}
                onClose={() => setShowLikeCelebration(false)}
            />
            <Separator className="my-6 md:hidden" />

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

export function ErrorBoundary() {
    const error = useRouteError();
    const saiposHref = WEBSITE_LINKS.saiposCardapio.href;

    console.error("[cardapio._index] route error boundary", error);

    if (isDatabaseConnectivityError(error)) {
        return <CardapioDatabaseUnavailable error={error} />;
    }

    return <CardapioErrorRedirect redirectHref={saiposHref} />;
}
