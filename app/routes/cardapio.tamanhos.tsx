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
        <main className="bg-gradient-to-b from-zinc-50 via-white to-white">
            <section className="mx-auto max-w-5xl px-4 pt-28 pb-16 md:pt-32 md:pb-24">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
                        <Sparkles className="h-4 w-4" />
                        Guia de tamanhos
                    </div>
                    <div className="flex flex-col gap-3">
                        <h1 className="font-neue text-3xl font-semibold leading-tight md:text-4xl">
                            Escolha o tamanho perfeito para o seu momento.
                        </h1>
                        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
                            Um guia rápido, visual e moderno para entender como funciona nosso formato al taglio. Assista ao vídeo,
                            compare porções e sabores e volte ao cardápio com confiança.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link to={GLOBAL_LINKS.cardapioPublic.href} prefetch="intent">
                                <Button size="lg" className="gap-2 font-neue tracking-wide uppercase">
                                    <ArrowLeft className="h-4 w-4" />
                                    Voltar ao cardápio
                                </Button>
                            </Link>
                            <Link to="/cardapio/buscar" prefetch="intent">
                                <Button variant="outline" size="lg" className="font-neue tracking-wide uppercase">
                                    Explorar sabores
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-start">
                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <div className="aspect-video w-full bg-black/5">
                            <video
                                className="h-full w-full rounded-none object-cover"
                                controls
                                preload="metadata"
                                playsInline
                                poster="/images/cardapio-web-app/pizza-placeholder-sm.png"
                            >
                                <source
                                    src="https://res.cloudinary.com/dy8gw8ahl/video/upload/v1767722031/2026_tamanhos_pizzas_h7mvsf.mp4"
                                    type="video/mp4"
                                />
                                Seu navegador não suporta vídeos HTML5.
                            </video>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                            <span className="font-neue">Vídeo curto explicando os tamanhos.</span>
                            <a
                                className="font-neue font-semibold text-brand-blue underline underline-offset-4"
                                href="https://res.cloudinary.com/dy8gw8ahl/video/upload/v1767722031/2026_tamanhos_pizzas_h7mvsf.mp4"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Abrir em nova aba
                            </a>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
                        <div className="mb-4 flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Comparação</span>
                            <h2 className="font-neue text-xl font-semibold md:text-2xl">Veja as diferenças lado a lado</h2>
                            <p className="text-sm text-muted-foreground">
                                Escolha um tamanho e veja quantas pessoas serve, quantos sabores e as medidas aproximadas.
                            </p>
                        </div>
                        <CardapioSizesContent />
                    </div>
                </div>

                <div className="mt-10 rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-4 shadow-sm md:p-6">
                    <div className="mb-4 flex flex-col gap-2">
                        <h3 className="font-neue text-lg font-semibold md:text-xl">Resumão rápido</h3>
                        <p className="text-sm text-muted-foreground">
                            Se quiser decidir em segundos, siga a régua abaixo. Todos os tamanhos são feitos no estilo pizza al taglio.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                        {SIZE_ORDER.map((size) => {
                            const info = sizeConfig[size];
                            return (
                                <div
                                    key={size}
                                    className="flex h-full flex-col justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_4px_24px_-18px_rgba(0,0,0,0.35)]"
                                >
                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
                                        {info.label}
                                    </div>
                                    <div className="font-neue text-xl font-semibold leading-tight">{info.serves}</div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {info.flavors}. {info.dims}.
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </main>
    );
}
