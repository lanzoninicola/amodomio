import { Link } from "@remix-run/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import SectionThreadHeader, {
    type ThreadSectionProfile,
} from "~/domain/cardapio/components/section-thread-header/section-thread-header";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import Logo from "~/components/primitives/logo/logo";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "~/components/ui/carousel";
import { cn } from "~/lib/utils";
import capitalize from "~/utils/capitalize";
import formatMoneyString from "~/utils/format-money-string";
import {
    buildRandomGroups,
    type CardapioIndexItem,
    getCardapioItemHref,
    getItemMarginPerc,
    getNoveltyItems,
    getPrimaryCardapioMedia,
    getVisiblePublicPriceVariations,
    type GroupedItems,
    isGrouped,
} from "~/domain/cardapio/cardapio-index.shared";
import { SECTION_THREAD_PROFILE_BY_SECTION } from "./cardapio-index-shared";
import Autoplay from "embla-carousel-autoplay";

export function CardapioHighlightsSection({
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
    const noveltyItems = getNoveltyItems(items);
    const flatItems = isGrouped(items) ? items.flatMap((group) => group.menuItems) : items;
    const topMarginItems = [...flatItems]
        .sort((a, b) => getItemMarginPerc(b) - getItemMarginPerc(a))
        .slice(0, 12);
    const chefSuggestionGroups = buildRandomGroups(topMarginItems, 4);
    const topLikedItems = likesEnabled
        ? [...flatItems]
            .sort((a, b) => (b.likes?.amount ?? 0) - (a.likes?.amount ?? 0))
            .slice(0, 4)
        : [];

    return (
        <>
            {noveltyItems.length > 0 ? <NoveltiesHeroSection items={noveltyItems} /> : null}

            <div className="md:flex md:flex-row gap-4">
                <section id="destaque" className="flex flex-col gap-4 mx-2 md:flex-1">
                    <ChefSuggestionsCarousel
                        title="O que vou sugerir para vocês hoje: "
                        subtitle="selecionei uma combinação que valoriza ingredientes nobres e equilíbrio de sabores."
                        groups={chefSuggestionGroups}
                        headerProfile={SECTION_THREAD_PROFILE_BY_SECTION.chef}
                    />
                </section>

                {likesEnabled ? (
                    <>
                        <div className="col-span-full mx-2 my-4 h-[2px] bg-zinc-900 md:hidden" />
                        <section id="mais-curtidas" className="flex flex-col gap-4 mx-2 md:flex-1">
                            <ChefSuggestionsCarousel
                                title="Mais curtidas: "
                                mobileTitle="Mais curtidas"
                                subtitle="nossos clientes gostam de mostrar o que é bom. Aqui está uma seleção dos sabores que eles mais curtem e querem compartilhar com todo mundo."
                                groups={[topLikedItems]}
                                headerProfile={SECTION_THREAD_PROFILE_BY_SECTION.likes}
                            />
                        </section>
                    </>
                ) : null}
            </div>

            {reelsEnabled && reelUrls.length > 0 ? (
                <>
                    <div className="mx-4 my-4 h-[2px] bg-zinc-900 md:hidden" />
                    <section className="mx-4 md:mx-0 my-2">
                        <div className="mb-2">
                            <h2 className="font-neue font-semibold text-sm tracking-tight">Reels sugeridos</h2>
                            <p className="font-neue text-sm mt-1 text-zinc-700">conteúdos curtos da equipe para inspirar seu próximo pedido.</p>
                        </div>
                        <ReelsCarousel urls={reelUrls} />
                    </section>
                </>
            ) : null}

            <div className="mx-4 my-4 h-[2px] bg-zinc-900" />
        </>
    );
}

function NoveltiesHeroSection({ items }: { items: CardapioIndexItem[] }) {
    const allItems = items.slice(0, 6);
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const itemWidth = 220;
    const itemGap = 20;
    const step = itemWidth + itemGap;

    const scrollToIndex = useCallback((index: number, instant = false) => {
        containerRef.current?.scrollTo({
            left: index * step,
            behavior: instant ? "auto" : "smooth",
        });
    }, [step]);

    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;
        const index = Math.round(containerRef.current.scrollLeft / step);
        setCurrent(Math.max(0, Math.min(index, allItems.length - 1)));
    }, [allItems.length, step]);

    useEffect(() => {
        if (paused || allItems.length <= 1) return;
        const timer = window.setInterval(() => {
            setCurrent((previous) => {
                const next = (previous + 1) % allItems.length;
                scrollToIndex(next, next === 0);
                return next;
            });
        }, 4000);
        return () => window.clearInterval(timer);
    }, [allItems.length, paused, scrollToIndex]);

    const handleInteraction = useCallback(() => {
        setPaused(true);
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = window.setTimeout(() => setPaused(false), 6000);
    }, []);

    const activeItem = allItems[current] ?? allItems[0];
    const activePrice = activeItem ? getVisiblePublicPriceVariations(activeItem)[0] : null;

    if (!activeItem) return null;

    return (
        <section id="novo-lancamento">
            <div className="mb-6 px-4 flex flex-col items-center">
                <h2 className="font-neue text-md font-semibold tracking-tight uppercase text-zinc-950">
                    Novos Lançamentos
                </h2>
                <div className="mt-1 flex items-center gap-2">
                    <span className="font-neue text-[10px] uppercase tracking-[0.36em] text-zinc-500">
                        {items.length} novos sabores
                    </span>
                </div>
            </div>

            <div className="overflow-hidden">
                <div
                    ref={containerRef}
                    className="flex snap-x snap-mandatory overflow-x-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onScroll={handleScroll}
                    onTouchStart={handleInteraction}
                    onMouseDown={handleInteraction}
                >
                    <div style={{ flexShrink: 0, width: `calc(50vw - ${itemWidth / 2}px)` }} />

                    {allItems.map((item, index) => {
                        const media = getPrimaryCardapioMedia(item);
                        const isActive = index === current;
                        return (
                            <div
                                key={item.id}
                                className="snap-center flex-shrink-0"
                                style={{
                                    width: itemWidth,
                                    marginRight: index < allItems.length - 1 ? itemGap : 0,
                                }}
                            >
                                <div
                                    className="aspect-square w-full overflow-hidden rounded-full bg-zinc-100 transition-all duration-500"
                                    style={{
                                        transform: isActive ? "scale(1)" : "scale(0.78)",
                                        opacity: isActive ? 1 : 0.38,
                                    }}
                                >
                                    <CardapioItemImageSingle
                                        src={media?.secureUrl || ""}
                                        placeholder={item.imagePlaceholderURL || ""}
                                        placeholderIcon={false}
                                        placeholderText={item.name}
                                        cnPlaceholderContainer="from-zinc-200 via-zinc-100 to-zinc-50"
                                        cnPlaceholderText="font-lora text-sm text-zinc-500"
                                        cnContainer="h-full w-full"
                                        enableOverlay={false}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ flexShrink: 0, width: `calc(50vw - ${itemWidth / 2}px)` }} />
                </div>
            </div>

            <Link to={getCardapioItemHref(activeItem)} className="group mt-6 block px-6 text-center">
                <h3 className="font-lora text-2xl font-bold text-zinc-950 transition-opacity group-hover:opacity-60">
                    {activeItem.name}
                </h3>
                <p className="mt-1 font-neue text-sm text-zinc-500">
                    {capitalize(activeItem.ingredients || "Novo sabor no cardápio.")}
                </p>
                {activePrice ? (
                    <p className="mt-2 font-neue text-sm text-zinc-400">
                        {formatMoneyString(activePrice.priceAmount)}
                    </p>
                ) : null}
            </Link>

            <div className="mt-5 flex items-center justify-center gap-1.5">
                {allItems.map((_, index) => (
                    <div
                        key={index}
                        className={cn(
                            "h-[3px] rounded-full transition-all duration-300",
                            index === current ? "w-6 bg-zinc-950" : "w-[6px] bg-zinc-300"
                        )}
                    />
                ))}
            </div>

            <div className="mx-4 my-4 h-[2px] bg-zinc-900" />
        </section>
    );
}

function ReelsCarousel({ urls }: { urls: string[] }) {
    const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
    const containerRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

    useEffect(() => {
        const refs = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
        if (!refs.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target as HTMLVideoElement;
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        video.play().catch(() => null);
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: [0.25, 0.6, 0.9] }
        );

        refs.forEach((video) => observer.observe(video));
        return () => observer.disconnect();
    }, [urls]);

    const openFullscreen = useCallback((index: number) => {
        const video = videoRefs.current[index];
        const container = containerRefs.current[index];
        if (!video) return;
        const mobileVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
        video.controls = true;
        if (typeof mobileVideo.webkitEnterFullscreen === "function") {
            mobileVideo.webkitEnterFullscreen();
            return;
        }
        if (container && typeof container.requestFullscreen === "function") {
            container.requestFullscreen().catch(() => null);
        }
    }, []);

    useEffect(() => {
        const refs = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
        if (!refs.length) return;

        const handleFullscreenChange = () => {
            const fullscreenElement = document.fullscreenElement as HTMLElement | null;
            const index = fullscreenElement
                ? containerRefs.current.findIndex((element) => element === fullscreenElement)
                : -1;
            setFullscreenIndex(index >= 0 ? index : null);
            refs.forEach((video) => {
                if (!fullscreenElement) video.controls = false;
            });
        };

        const handlers = refs.map((video) => {
            const onBegin = () => {
                video.controls = true;
            };
            const onEnd = () => {
                video.controls = false;
            };
            video.addEventListener("webkitbeginfullscreen", onBegin as EventListener);
            video.addEventListener("webkitendfullscreen", onEnd as EventListener);
            return { video, onBegin, onEnd };
        });

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            handlers.forEach(({ video, onBegin, onEnd }) => {
                video.removeEventListener("webkitbeginfullscreen", onBegin as EventListener);
                video.removeEventListener("webkitendfullscreen", onEnd as EventListener);
            });
        };
    }, [urls]);

    return (
        <Carousel opts={{ align: "start" }} className="relative">
            <CarouselContent>
                {urls.map((url, index) => (
                    <CarouselItem key={`${url}-${index}`} className="basis-[18%] md:basis-1/5 lg:basis-1/6">
                        <div
                            ref={(element) => {
                                containerRefs.current[index] = element;
                            }}
                            className="relative overflow-hidden rounded-xl bg-black"
                            onClick={() => openFullscreen(index)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Abrir reel ${index + 1} em tela cheia`}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openFullscreen(index);
                                }
                            }}
                        >
                            <video
                                ref={(element) => {
                                    videoRefs.current[index] = element;
                                }}
                                className="h-full w-full aspect-[4/5] object-cover"
                                src={url}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                controls={false}
                                aria-label={`Reel ${index + 1}`}
                            />
                            {fullscreenIndex === index ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (document.fullscreenElement) {
                                                document.exitFullscreen().catch(() => null);
                                            }
                                        }}
                                        className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-lg"
                                        aria-label="Fechar"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                    <div className="absolute bottom-16 right-3 z-10">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (document.fullscreenElement) {
                                                    document.exitFullscreen().catch(() => null);
                                                }
                                            }}
                                            className="inline-flex h-9 items-center rounded-full bg-black/90 px-4 text-[11px] font-semibold tracking-[0.2em] text-white shadow-lg backdrop-blur-lg"
                                            aria-label="VOLTAR"
                                        >
                                            VOLTAR
                                        </button>
                                    </div>
                                </>
                            ) : null}
                            <div
                                className={cn(
                                    "pointer-events-none absolute left-3 z-10 flex items-center gap-2",
                                    fullscreenIndex === index ? "bottom-16" : "bottom-2"
                                )}
                            >
                                <Logo
                                    circle
                                    color="white"
                                    className={cn(fullscreenIndex === index ? "h-11 w-11 p-1.5" : "h-6 w-6 p-0.5")}
                                />
                                <span className="text-sm font-semibold tracking-wide text-white drop-shadow">
                                    amodomio
                                </span>
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
    );
}

function ChefSuggestionsCarousel({
    title,
    subtitle,
    mobileTitle,
    groups,
    carouselDelay = 2500,
    headerProfile,
}: {
    title?: string;
    subtitle?: string;
    mobileTitle?: React.ReactNode;
    groups: CardapioIndexItem[][];
    carouselDelay?: number;
    headerProfile?: ThreadSectionProfile;
}) {
    const [api, setApi] = useState<CarouselApi | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!api) return;
        const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
        api.on("select", onSelect);
        setSelectedIndex(api.selectedScrollSnap());
        return () => api.off("select", onSelect);
    }, [api]);

    if (!groups.length) return null;

    const items = groups.flat();
    const groupSize = 4;
    const selectedGroupIndex = Math.floor(selectedIndex / groupSize);

    const carouselContent = (
        <Carousel
            setApi={setApi}
            opts={{ loop: true, align: "start" }}
            plugins={[
                Autoplay({
                    delay: carouselDelay,
                    stopOnInteraction: false,
                    stopOnMouseEnter: true,
                }),
            ]}
            className="relative"
        >
            <CarouselContent>
                {items.map((item) => {
                    const featuredImage =
                        item.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
                        item.MenuItemGalleryImage?.[0];

                    return (
                        <CarouselItem key={item.id} className="basis-full">
                            <Link to={getCardapioItemHref(item)} className="group relative block overflow-hidden rounded-md">
                                <div className="relative h-[220px] md:h-[280px]">
                                    <CardapioItemImageSingle
                                        src={featuredImage?.secureUrl || ""}
                                        placeholder={item.imagePlaceholderURL || ""}
                                        placeholderIcon={false}
                                        placeholderText={item.ingredients}
                                        cnContainer="h-full w-full"
                                        enableOverlay={false}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90" />
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <span className="font-neue text-white text-xs tracking-widest uppercase font-semibold drop-shadow leading-tight">
                                            {item.name}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </CarouselItem>
                    );
                })}
            </CarouselContent>

            <div className="absolute inset-x-0 -bottom-3 flex items-center justify-center gap-2 md:-bottom-4">
                {groups.map((_, index) => (
                    <button
                        key={index}
                        type="button"
                        aria-label={`Ir para slide ${index + 1}`}
                        onClick={() => api?.scrollTo(index * groupSize)}
                        className={cn(
                            "h-2 w-2 rounded-full transition-all",
                            selectedGroupIndex === index ? "w-6 bg-black/80" : "bg-black/30"
                        )}
                    />
                ))}
            </div>
        </Carousel>
    );

    return (
        <div className="p-2">
            <div className="md:hidden">
                <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setIsOpen((value) => !value)}
                    aria-expanded={isOpen}
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="font-lora text-2xl font-bold tracking-tight leading-tight">
                            {mobileTitle ?? "Sugestões para hoje"}
                        </h2>
                        <ChevronRight
                            className={cn(
                                "h-6 w-6 shrink-0 transition-transform duration-300",
                                isOpen && "rotate-90"
                            )}
                        />
                    </div>

                    {subtitle ? <p className="font-neue text-sm tracking-wide mt-2 text-zinc-600">{subtitle}</p> : null}

                    {headerProfile ? (
                        <div className="flex items-center gap-2 mt-3">
                            {headerProfile.avatarImageUrl ? (
                                <img
                                    src={headerProfile.avatarImageUrl}
                                    alt={headerProfile.username}
                                    className="h-8 w-8 rounded-full object-cover border border-zinc-200"
                                />
                            ) : null}
                            <span className="font-neue text-sm font-semibold">
                                {headerProfile.username === "chef.nicola" ? "Chef Nicola" : headerProfile.username}
                            </span>
                        </div>
                    ) : null}
                </button>

                <div
                    className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isOpen ? "max-h-[400px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
                    )}
                >
                    {carouselContent}
                </div>
            </div>

            <div className="hidden md:block">
                {title ? (
                    <SectionThreadHeader
                        profile={headerProfile ?? SECTION_THREAD_PROFILE_BY_SECTION.chef}
                        title={title}
                        subtitle={subtitle}
                        className="mb-3"
                    />
                ) : null}
                {carouselContent}
            </div>
        </div>
    );
}
