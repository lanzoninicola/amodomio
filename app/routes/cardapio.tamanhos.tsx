import { MetaFunction, json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import React from "react";
import { ArrowLeft, RefreshCcw, RotateCcw } from "lucide-react";

import { Button } from "~/components/ui/button";
import { CardapioSizesSections } from "~/domain/cardapio/components/cardapio-sizes-content";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import prismaClient from "~/lib/prisma/client.server";

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

export async function loader() {
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
                  MenuItemSellingChannel: {
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

    return json({ sizes: sizesWithPrices });
}

export default function CardapioTamanhosPage() {
    const { sizes } = useLoaderData<typeof loader>();
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const handleRestartVideo = () => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        void video.play();
    };

    return (
        <main className="font-neue bg-gradient-to-b from-zinc-50 via-white to-white">
            {/* Hero Section */}
            <section className="relative mx-auto max-w-5xl  pt-32 pb-4 font-neue md:pt-44 md:pb-24 ">
                <div className="relative w-full max-w-[430px] overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-800 ring-1 ring-black/10">
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
                        <source
                            src="https://res.cloudinary.com/dy8gw8ahl/video/upload/v1767722031/2026_tamanhos_pizzas_h7mvsf.mp4"
                            type="video/mp4"
                        />
                        Seu navegador não suporta vídeos HTML5.
                    </video>

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3 ">
                        <div className=" flex flex-col gap-3">
                            <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
                                Escolha o tamanho perfeito para o seu momento.
                            </h1>
                            <p className="max-w-3xl text-base text-white/80 md:text-lg">
                                Assista ao vídeo, entenda o formato e veja quantas pessoas cada tamanho atende antes de
                                voltar para o cardápio.
                            </p>
                        </div>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 px-4 pb-8 pt-12">
                        <div className="rounded-2xl bg-white/85 p-3 shadow-md backdrop-blur">
                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-white/90">
                                <span>Tamanhos</span>
                                <span className="text-slate-500">Vídeo 1 min</span>
                            </div>
                            <p className="mt-1 text-sm text-white/80">
                                Escolha Individual, Pequena, Médio ou Família e veja quantas pessoas cada um atende.
                            </p>
                        </div>
                    </div>

                    <div className="absolute right-4 bottom-4">
                        <button
                            type="button"
                            onClick={handleRestartVideo}
                            className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm backdrop-blur"
                        >
                            <div className="flex items-center gap-x-2">
                                <RotateCcw size={14} />
                                Recomeçar vídeo
                            </div>


                        </button>
                    </div>
                </div>
            </section>
            {/* Content Section */}
            <section className="relative mx-auto max-w-5xl font-neue md:pt-44 md:pb-24 ">
                <div className="mt-6  bg-white/80 p-4 px-4 md:p-6">
                    <div className="mb-4 flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Comparação</span>
                        <h2 className="text-xl font-semibold md:text-2xl">Compare tamanhos sem complicação</h2>
                        <p className="text-sm text-muted-foreground">
                            Veja tudo de uma vez: pessoas atendidas, sabores e faixa de preços.
                        </p>
                    </div>
                    <CardapioSizesSections hideTitle sizes={sizes} />
                </div>


            </section>

            <section className="my-10 px-4">
                <div className="flex flex-wrap gap-3 w-full">
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
