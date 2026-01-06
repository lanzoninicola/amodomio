import { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "~/components/ui/button";
import { CardapioSizesContent, SIZE_ORDER, sizeConfig } from "~/domain/cardapio/components/cardapio-sizes-content";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";

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

export default function CardapioTamanhosPage() {
    return (
        <main className="font-neue bg-gradient-to-b from-zinc-50 via-white to-white">
            <section className="relativeive mx-auto max-w-5xl  pt-32 pb-16 font-neue md:pt-44 md:pb-24 ">
                <div className="relative w-full max-w-[430px] overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-800 shadow-2xl ring-1 ring-black/10">
                    <video
                        className="aspect-[9/16] h-full w-full object-cover"
                        controls
                        preload="metadata"
                        playsInline
                        autoPlay
                        muted
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

                    <div className="absolute inset-x-0 bottom-0 px-4 pb-5 pt-12">
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
                </div>
                <div className="mt-10 rounded-3xl bg-white/80 p-4 shadow-lg backdrop-blur px-4 md:p-6">
                    <div className="mb-4 flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Comparação</span>
                        <h2 className="text-xl font-semibold md:text-2xl">Veja as diferenças lado a lado</h2>
                        <p className="text-sm text-muted-foreground">
                            Escolha um tamanho e veja quantas pessoas serve, quantos sabores e as medidas aproximadas.
                        </p>
                    </div>
                    <CardapioSizesContent />
                </div>

                <div className="mt-10 space-y-4 px-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
                        <Sparkles className="h-4 w-4" />
                        Resumão rápido
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {SIZE_ORDER.map((size) => {
                            const info = sizeConfig[size];
                            return (
                                <div
                                    key={size}
                                    className="flex h-full flex-col gap-2 rounded-2xl bg-white/90 p-4 shadow-md backdrop-blur"
                                >
                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
                                        {info.label}
                                    </div>
                                    <div className="text-lg font-semibold leading-tight">{info.serves}</div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {info.flavors}. {info.dims}.
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-3 w-full mt-4">
                        <Link to={GLOBAL_LINKS.cardapioPublic.href} prefetch="intent" className="w-full">
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
                </div>
            </section>

        </main>
    );
}
