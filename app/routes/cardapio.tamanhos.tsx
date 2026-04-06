import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import React from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Button } from "~/components/ui/button";
import { CardapioSizesSections } from "~/domain/cardapio/components/cardapio-sizes-content";

import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import prismaClient from "~/lib/prisma/client.server";

const TAMANHOS_SETTING_CONTEXT = 'cardapio'
const TAMANHOS_SETTING_KEY = 'tamanho.page.video-url'


async function loadSizesVideoUrl() {
    const setting = await prismaClient.setting.findFirst({
        where: {
            context: TAMANHOS_SETTING_CONTEXT,
            name: TAMANHOS_SETTING_KEY,
        },
        orderBy: [{ createdAt: "desc" }],
    });

    const raw = setting?.value?.trim() ?? "";
    try {
        new URL(raw);
        return raw;
    } catch {
        return "";
    }
}

export const meta: MetaFunction = () => {
    return [
        { title: "Tamanhos das Pizzas - A Modo Mio" },
        {
            name: "description",
            content:
                "Entenda os tamanhos da pizza al taglio da A Modo Mio e encontre a medida ideal para compartilhar ou saborear sozinho.",
        },
        { name: "og:title", content: "Tamanhos das Pizzas - A Modo Mio" },
        {
            name: "og:description",
            content: "Assista ao vídeo e compare os tamanhos das nossas pizzas para escolher o formato perfeito.",
        },
        {
            name: "og:url",
            content: "https://www.amodomio.com.br/cardapio/tamanhos",
        },
    ];
};


export async function loader(_: LoaderFunctionArgs) {
    const sizes = await prismaClient.menuItemSize.findMany({
        where: {
            visible: true,
            key: {
                startsWith: "pizza",
            },
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            nameShort: true,
            maxServeAmount: true,
            maxServeAmountDescription: true,
            maxToppingsAmount: true,
            maxToppingsAmountDescription: true,
        },
    });

    const sizeIds = sizes.map((size) => size.id);

    const priceVariations = sizeIds.length
        ? await prismaClient.menuItemSellingPriceVariation.findMany({
            where: {
                menuItemSizeId: { in: sizeIds },
                showOnCardapio: true,
                ItemSellingChannel: {
                    key: "cardapio",
                },
            },
            select: {
                menuItemSizeId: true,
                priceAmount: true,
            },
        })
        : [];

    const priceBySize = new Map<string, { min: number; max: number }>();
    for (const variation of priceVariations) {
        if (!variation.menuItemSizeId) continue;
        const current = priceBySize.get(variation.menuItemSizeId);
        if (!current) {
            priceBySize.set(variation.menuItemSizeId, {
                min: variation.priceAmount,
                max: variation.priceAmount,
            });
            continue;
        }
        priceBySize.set(variation.menuItemSizeId, {
            min: Math.min(current.min, variation.priceAmount),
            max: Math.max(current.max, variation.priceAmount),
        });
    }

    const sizesWithPrices = sizes.map((size) => {
        const prices = priceBySize.get(size.id);
        return {
            ...size,
            minPrice: prices?.min ?? null,
            maxPrice: prices?.max ?? null,
        };
    });

    const videoUrl = await loadSizesVideoUrl();

    return json({ sizes: sizesWithPrices, videoUrl });
}

export default function CardapioTamanhosPage() {
    const { sizes, videoUrl } = useLoaderData<typeof loader>();
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const handleRestartVideo = () => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        void video.play();
    };

    return (
        <main className="bg-white font-neue">
            {/* Hero Section */}
            <section className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-36 md:pt-48">
                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
                    <div className="flex flex-col gap-5 pt-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Tamanhos</span>
                        <h1 className="max-w-xl text-3xl font-semibold leading-tight text-zinc-900 md:text-5xl">
                            Escolha o tamanho ideal para o seu momento.
                        </h1>
                        <p className="max-w-2xl text-base text-zinc-600 md:text-lg">
                            Assista ao vídeo para entender o formato de cada pizza e compare rapidamente quantas pessoas,
                            sabores e faixa de preço antes de voltar para o cardápio.
                        </p>
                        <div className="hidden md:flex flex-wrap gap-3 pt-2">
                            <Link to={WEBSITE_LINKS.cardapioPublic.href} prefetch="intent">
                                <Button size="lg" className="gap-2 tracking-wide uppercase">
                                    <ArrowLeft className="h-4 w-4" />
                                    Ver cardápio
                                </Button>
                            </Link>
                            <Link to="/cardapio/buscar" prefetch="intent">
                                <Button variant="secondary" size="lg" className="tracking-wide uppercase">
                                    Explorar sabores
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="relative w-full overflow-hidden border border-zinc-200 bg-zinc-950">
                        <video
                            className="aspect-[9/16] h-full w-full object-cover"
                            controls
                            preload="metadata"
                            playsInline
                            autoPlay
                            muted
                            ref={videoRef}
                            poster="/images/cardapio-web-app/pizza-placeholder-sm.png"
                        >
                            {videoUrl ? <source src={videoUrl} type="video/mp4" /> : null}
                            Seu navegador não suporta vídeos HTML5.
                        </video>

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-transparent" />

                        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">Vídeo curto</p>
                                <p className="text-sm text-white/80">Individual, Pequeno, Médio e Família em 1 minuto</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleRestartVideo}
                                className="flex items-center gap-x-2 border border-white/20 bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-900 backdrop-blur"
                            >
                                <RotateCcw size={14} />
                                Recomeçar
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-4 md:pb-24">
                <div className="mt-6 md:mt-8">
                    <div className="mb-4 flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Comparação</span>
                        <h2 className="text-xl font-semibold md:text-2xl">Compare tamanhos sem complicação</h2>
                        <p className="text-sm text-muted-foreground">
                            Veja tudo de uma vez: pessoas atendidas, sabores e faixa de preços.
                        </p>
                    </div>
                    <CardapioSizesSections hideTitle sizes={sizes} className="mt-8" />
                </div>
            </section>

            <section className="mb-12 px-4 lg:hidden">
                <div className="flex w-full flex-wrap gap-3">
                    <Link to={WEBSITE_LINKS.cardapioPublic.href} prefetch="intent" className="w-full">
                        <Button size="lg" className="gap-2 tracking-wide uppercase w-full">
                            <ArrowLeft className="h-4 w-4" />
                            Ver cardápio
                        </Button>
                    </Link>
                    <Link to="/cardapio/buscar" prefetch="intent" className="w-full">
                        <Button variant="secondary" size="lg" className="tracking-wide uppercase w-full">
                            Explorar sabores
                        </Button>
                    </Link>
                </div>
            </section>
        </main>
    );
}
