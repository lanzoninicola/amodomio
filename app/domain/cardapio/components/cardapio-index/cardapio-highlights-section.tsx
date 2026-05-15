import { Link } from "@remix-run/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, ChevronRight, Heart, MessageCircle, Share2, ShoppingBag, X } from "lucide-react";
import SectionThreadHeader, {
    type ThreadSectionProfile,
} from "~/domain/cardapio/components/section-thread-header/section-thread-header";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import Logo from "~/components/primitives/logo/logo";
import ExternalLink from "~/components/primitives/external-link/external-link";
import { Carousel, CarouselContent, CarouselItem } from "~/components/ui/carousel";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { LikeIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import { cn } from "~/lib/utils";
import capitalize from "~/utils/capitalize";
import formatMoneyString from "~/utils/format-money-string";
import {
    buildRandomGroups,
    type CardapioIndexItem,
    getCardapioItemHref,
    getGroupedItemsList,
    getItemMarginPerc,
    getNoveltyItems,
    getPrimaryCardapioMedia,
    getVisiblePublicPriceVariations,
    itemHasPublicTag,
    type GroupedItems,
    isGrouped,
} from "~/domain/cardapio/cardapio-index.shared";
import { SECTION_THREAD_PROFILE_BY_SECTION } from "./cardapio-index-shared";

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
    const flatItems = isGrouped(items) ? items.flatMap((group) => getGroupedItemsList(group)) : items;
    const topMarginItems = [...flatItems]
        .sort((a, b) => getItemMarginPerc(b) - getItemMarginPerc(a))
        .slice(0, 12);
    const chefSuggestionGroups = buildRandomGroups(topMarginItems, 4);
    const topLikedItems = likesEnabled
        ? [...flatItems]
            .sort((a, b) => (b.likes?.amount ?? 0) - (a.likes?.amount ?? 0))
            .slice(0, 6)
        : [];

    return (
        <>
            <CardapioSocialFeed
                items={flatItems}
                likesEnabled={likesEnabled}
            />

            {noveltyItems.length > 0 ? <NoveltiesHeroSection items={noveltyItems} /> : null}

            <div className="gap-4 md:flex md:flex-row md:items-start">
                <section id="destaque" className="mx-2 flex min-w-0 flex-col gap-4 md:flex-1">
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
                        <section id="mais-curtidas" className="mx-2 flex min-w-0 flex-col gap-4 md:flex-1">
                            <MaisCurtidasRanking
                                items={topLikedItems}
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

            <ItalianIngredientsSection />

            <div className="mx-4 my-4 h-[2px] bg-zinc-900" />
        </>
    );
}

type FeedCategoryKey = "sugestoes" | "curtidas" | "classicas" | "premium" | "vegetarianas";

const FEED_CATEGORIES: Array<{ key: FeedCategoryKey; label: string }> = [
    { key: "sugestoes", label: "Sugestões" },
    { key: "curtidas", label: "Mais curtidas" },
    { key: "classicas", label: "Clássicas" },
    { key: "premium", label: "Premium" },
    { key: "vegetarianas", label: "Vegetarianas" },
];

function CardapioSocialFeed({
    items,
    likesEnabled,
}: {
    items: CardapioIndexItem[];
    likesEnabled: boolean;
}) {
    const [activeCategory, setActiveCategory] = useState<FeedCategoryKey>("sugestoes");
    const feedRef = useRef<HTMLDivElement>(null);

    const feedItems = getSocialFeedItems(items, activeCategory);

    useEffect(() => {
        feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [activeCategory]);

    if (!feedItems.length) return null;

    return (
        <section className="relative mb-6 bg-zinc-950 text-white md:-mx-0 md:bg-[#111]">
            <div className="mx-auto w-full md:max-w-[460px] md:py-4">
                <div className="sticky top-[50px] z-20 flex gap-2 overflow-x-auto border-b border-white/10 bg-black/70 px-3 py-3 backdrop-blur-xl md:top-[70px] md:rounded-t-[1.75rem] no-scrollbar">
                    {FEED_CATEGORIES.map((category) => (
                        <button
                            key={category.key}
                            type="button"
                            onClick={() => setActiveCategory(category.key)}
                            className={cn(
                                "relative whitespace-nowrap px-1 pb-1 font-neue text-[12px] font-semibold uppercase leading-none text-white/55 transition-colors",
                                activeCategory === category.key ? "text-white" : "hover:text-white"
                            )}
                        >
                            {category.label}
                            <span
                                className={cn(
                                    "absolute bottom-[-0.35rem] left-0 h-[2px] rounded-full bg-white transition-all",
                                    activeCategory === category.key ? "w-full opacity-100" : "w-0 opacity-0"
                                )}
                            />
                        </button>
                    ))}
                </div>

                <div
                    ref={feedRef}
                    className="h-[calc(100dvh-50px)] snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black md:h-[min(820px,calc(100dvh-86px))] md:rounded-b-[1.75rem] md:border md:border-white/10 md:shadow-2xl"
                >
                    {feedItems.map((item, index) => (
                        <SocialFeedItem
                            key={`${activeCategory}-${item.id}`}
                            item={item}
                            likesEnabled={likesEnabled}
                            eager={index <= 1}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

function SocialFeedItem({
    item,
    likesEnabled,
    eager,
}: {
    item: CardapioIndexItem;
    likesEnabled: boolean;
    eager: boolean;
}) {
    const [saved, setSaved] = useState(false);
    const media = getPrimaryCardapioMedia(item);
    const mediaUrl = media?.secureUrl || "";
    const isVideo =
        media?.kind === "video" ||
        /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(mediaUrl);
    const featuredPrice = getSocialFeedPrice(item);

    const shareItem = useCallback(() => {
        if (typeof navigator === "undefined" || !navigator.share) return;
        navigator.share({
            title: item.name,
            text: item.ingredients || `Conheça ${item.name} no cardápio A Modo Mio.`,
            url: `${window.location.origin}${getCardapioItemHref(item)}`,
        }).catch(() => null);
    }, [item]);

    return (
        <article className="relative h-[calc(100dvh-50px)] snap-start snap-always overflow-hidden bg-zinc-950 md:h-[min(820px,calc(100dvh-86px))]">
            <div className="absolute inset-0">
                {mediaUrl && isVideo ? (
                    <video
                        src={mediaUrl}
                        className="h-full w-full object-cover"
                        autoPlay
                        muted
                        playsInline
                        loop
                        preload={eager ? "metadata" : "none"}
                    />
                ) : (
                    <div className="h-full w-full scale-[1.03] animate-[pulse_8s_ease-in-out_infinite] motion-reduce:animate-none">
                        <CardapioItemImageSingle
                            src={mediaUrl}
                            placeholder={item.imagePlaceholderURL || ""}
                            placeholderIcon={false}
                            placeholderText={item.name}
                            cnPlaceholderContainer="from-zinc-950 via-zinc-900 to-zinc-800"
                            cnPlaceholderText="font-lora text-7xl text-white/70"
                            cnContainer="h-full w-full"
                            enableOverlay={false}
                        />
                    </div>
                )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/25" />
            <div className="absolute inset-x-0 bottom-0 z-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-5 pr-24">
                <Link to={getCardapioItemHref(item)} className="group block">
                    <h2 className="font-lora text-4xl font-bold leading-[0.95] text-white drop-shadow-lg transition group-hover:opacity-85">
                        {item.name}
                    </h2>
                    {item.ingredients ? (
                        <p className="mt-3 line-clamp-3 font-neue text-[15px] leading-snug text-white/85 drop-shadow">
                            {capitalize(item.ingredients)}
                        </p>
                    ) : null}
                    {featuredPrice ? (
                        <p className="mt-4 font-neue text-sm font-semibold uppercase tracking-wide text-white">
                            A partir de {formatMoneyString(featuredPrice.priceAmount)}
                        </p>
                    ) : null}
                </Link>

                <div className="mt-4 max-w-[15rem]">
                    <FazerPedidoButton
                        label="Adicionar ao pedido"
                        size="sm"
                        variant="secondary"
                        cnContainer="rounded-full bg-white/95 px-4 py-2.5 shadow-xl"
                        cnLabel="text-[12px]"
                        ariaLabel={`Adicionar ${item.name} ao pedido`}
                    />
                </div>
            </div>

            <div className="absolute bottom-8 right-3 z-20 flex flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]">
                {likesEnabled ? (
                    <LikeIt
                        item={item as unknown as React.ComponentProps<typeof LikeIt>["item"]}
                        size={25}
                        color="white"
                        cnContainer="h-12 w-12 rounded-full bg-black/35 p-0 backdrop-blur-md hover:bg-black/45"
                        cnIcon="drop-shadow"
                    />
                ) : null}
                <SocialFeedAction
                    label="Salvar"
                    active={saved}
                    onClick={() => setSaved((current) => !current)}
                    icon={<Bookmark className={cn("h-5 w-5", saved ? "fill-white" : "fill-none")} />}
                />
                <SocialFeedAction
                    label="Compartilhar"
                    onClick={shareItem}
                    icon={<Share2 className="h-5 w-5" />}
                />
                <Link
                    to={getCardapioItemHref(item)}
                    className="flex flex-col items-center gap-1 text-white"
                    aria-label={`Ver detalhes de ${item.name}`}
                >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
                        <MessageCircle className="h-5 w-5" />
                    </span>
                    <span className="font-neue text-[9px] font-semibold uppercase leading-none text-white/80">
                        Detalhes
                    </span>
                </Link>
                <ExternalLink
                    to={WEBSITE_LINKS.cardapioFallbackURL.href}
                    ariaLabel={`Pedir ${item.name}`}
                    className="flex flex-col items-center gap-1 text-white"
                >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
                        <ShoppingBag className="h-5 w-5" />
                    </span>
                    <span className="font-neue text-[9px] font-semibold uppercase leading-none text-white/80">
                        Pedir
                    </span>
                </ExternalLink>
            </div>
        </article>
    );
}

function SocialFeedAction({
    label,
    icon,
    active,
    onClick,
}: {
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn("flex flex-col items-center gap-1 text-white", active ? "text-white" : "text-white/90")}
            aria-label={label}
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
                {icon}
            </span>
            <span className="font-neue text-[9px] font-semibold uppercase leading-none text-white/80">
                {label}
            </span>
        </button>
    );
}

function getSocialFeedItems(items: CardapioIndexItem[], category: FeedCategoryKey) {
    const tagged = (tag: string) => items.filter((item) => itemHasPublicTag(item, tag));
    const sortedByLikes = [...items].sort((a, b) => (b.likes?.amount ?? 0) - (a.likes?.amount ?? 0));
    const sortedByMargin = [...items].sort((a, b) => getItemMarginPerc(b) - getItemMarginPerc(a));

    const byCategory: Record<FeedCategoryKey, CardapioIndexItem[]> = {
        sugestoes: [...sortedByMargin].sort((a, b) => {
            const aPremium = getPremiumScore(a);
            const bPremium = getPremiumScore(b);
            return bPremium - aPremium || getItemMarginPerc(b) - getItemMarginPerc(a) || (b.likes?.amount ?? 0) - (a.likes?.amount ?? 0);
        }),
        curtidas: sortedByLikes,
        classicas: tagged("classica").length ? tagged("classica") : tagged("clássica"),
        premium: tagged("premium").length ? tagged("premium") : sortedByMargin.filter((item) => getPremiumScore(item) > 0),
        vegetarianas: tagged("vegetariana").length ? tagged("vegetariana") : tagged("vegetarianas"),
    };

    const selectedItems = byCategory[category].length ? byCategory[category] : byCategory.sugestoes;
    return selectedItems.slice(0, 16);
}

function getPremiumScore(item: CardapioIndexItem) {
    const source = `${item.name} ${item.ingredients || ""}`.toLocaleLowerCase();
    return ["mortazza", "burrata", "pistache", "pistacchio", "trufa", "parma", "gorgonzola"].reduce(
        (score, term) => score + (source.includes(term) ? 1 : 0),
        0
    );
}

function getSocialFeedPrice(item: CardapioIndexItem) {
    const prices = getVisiblePublicPriceVariations(item);
    return prices.find((variation) => variation.isReference) ?? prices[0] ?? null;
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

function SuggestionMiniCarousel({ items }: { items: CardapioIndexItem[] }) {
    const allItems = items.slice(0, 8);
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const itemWidth = 140;
    const itemGap = 16;
    const step = itemWidth + itemGap;
    const sideSpacerWidth = Math.max((containerWidth - itemWidth) / 2, 0);

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
        }, 2500);
        return () => window.clearInterval(timer);
    }, [allItems.length, paused, scrollToIndex]);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const updateWidth = () => {
            setContainerWidth(wrapper.clientWidth);
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        resizeObserver.observe(wrapper);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const handleInteraction = useCallback(() => {
        setPaused(true);
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = window.setTimeout(() => setPaused(false), 6000);
    }, []);

    const activeItem = allItems[current] ?? allItems[0];
    const activePrice = activeItem ? getVisiblePublicPriceVariations(activeItem)[0] : null;

    if (!activeItem) return null;

    return (
        <div ref={wrapperRef} className="w-full min-w-0 overflow-hidden">
            <div className="overflow-hidden">
                <div
                    ref={containerRef}
                    className="flex snap-x snap-mandatory overflow-x-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onScroll={handleScroll}
                    onTouchStart={handleInteraction}
                    onMouseDown={handleInteraction}
                >
                    <div style={{ flexShrink: 0, width: sideSpacerWidth }} />

                    {allItems.map((item, index) => {
                        const media = getPrimaryCardapioMedia(item);
                        const hasImage = Boolean(media?.secureUrl);
                        const isActive = index === current;
                        const initial = item.name?.charAt(0).toUpperCase() ?? "?";
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
                                    className="aspect-square w-full overflow-hidden rounded-full transition-all duration-500"
                                    style={{
                                        transform: isActive ? "scale(1)" : "scale(0.78)",
                                        opacity: isActive ? 1 : 0.38,
                                    }}
                                >
                                    {hasImage ? (
                                        <CardapioItemImageSingle
                                            src={media?.secureUrl || ""}
                                            placeholder={item.imagePlaceholderURL || ""}
                                            placeholderIcon={false}
                                            placeholderText=""
                                            cnContainer="h-full w-full"
                                            enableOverlay={false}
                                        />
                                    ) : (
                                        <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-900">
                                            <span className="font-lora text-5xl font-bold text-white/80 leading-none">
                                                {initial}
                                            </span>
                                            <span className="font-neue text-[10px] tracking-[0.2em] uppercase text-white/40 mt-2 px-3 text-center leading-tight">
                                                {item.name}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ flexShrink: 0, width: sideSpacerWidth }} />
                </div>
            </div>

            <Link to={getCardapioItemHref(activeItem)} className="group mt-4 block px-6 text-center">
                <h3 className="font-lora text-lg font-bold text-zinc-950 transition-opacity group-hover:opacity-60">
                    {activeItem.name}
                </h3>
                <p className="mt-1 font-neue text-sm text-zinc-500">
                    {capitalize(activeItem.ingredients || "")}
                </p>
                {activePrice ? (
                    <p className="mt-1 font-neue text-xs text-zinc-400">
                        {formatMoneyString(activePrice.priceAmount)}
                    </p>
                ) : null}
            </Link>

            <div className="mt-4 flex items-center justify-center gap-1.5">
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
        </div>
    );
}

function ItalianPizzaLineArt() {
    return (
        <svg
            viewBox="0 0 300 380"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            className="w-full max-w-[200px]"
            aria-hidden
        >
            <path d="M 145 35 C 165 30 192 42 202 62 C 212 82 207 108 198 128 C 196 136 197 140 197 148 C 192 168 184 188 171 204 C 159 220 143 226 130 224 C 116 222 102 208 95 193 C 88 178 88 158 92 141 C 92 134 96 129 96 121 C 92 106 89 83 94 64 C 100 46 121 32 145 35 Z" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 145 35 C 140 21 127 14 113 14 C 98 13 86 21 86 34 C 83 46 89 56 94 64" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M 202 62 C 210 49 208 32 197 22 C 186 11 169 10 156 16 C 150 20 146 28 145 35" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M 94 121 C 83 126 79 137 82 148 C 85 158 95 162 100 155" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 149 74 C 160 67 175 67 183 73" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 147 86 C 157 79 174 79 180 87 C 173 97 156 98 147 86" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 107 77 C 114 71 124 71 129 77" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 106 88 C 113 82 124 82 128 89 C 122 96 113 96 106 88" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 164 83 C 162 102 161 122 158 138 C 155 150 148 156 152 162" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 140 158 C 144 164 154 164 158 159" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 127 176 C 136 169 149 168 159 174 C 163 177 163 181 158 183" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 136 170 C 142 166 148 166 153 170" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 126 185 C 136 196 155 196 161 185" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 123 230 C 118 248 116 268 118 284" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 153 227 C 158 244 160 265 157 280" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 118 284 C 103 294 86 298 68 295" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 157 280 C 172 290 190 296 210 293" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 218 70 C 227 50 248 44 265 50 C 280 56 288 72 287 90 C 286 107 276 121 268 134 C 260 146 254 158 252 172 C 250 184 254 197 247 208 C 240 218 226 220 222 230" stroke="#1a1a1a" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M 218 70 C 218 53 220 38 228 29 C 236 20 248 17 258 20 C 268 23 276 32 278 46 C 281 58 282 72 287 90" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 252 78 C 260 72 271 73 276 79" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 255 88 C 262 82 273 83 276 90" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 271 92 C 276 106 275 122 269 134 C 265 144 258 150 261 156" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 247 172 C 253 166 261 166 263 173 C 259 181 249 180 247 172" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 222 230 C 220 244 222 258 226 268" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
        </svg>
    )
}

function ItalianIngredientsSection() {
    return (
        <section className="relative bg-white overflow-hidden">
            <img src="/images/roman_man.png" alt="" className="w-[55%] h-auto opacity-40" aria-hidden />
            <blockquote className="absolute top-1/2 right-4 -translate-y-1/2 z-10 flex flex-col items-end gap-2 border-r-2 border-black/30 pr-3 w-[52%]">
                <p className="font-lora italic font-bold text-black/85 leading-snug text-[1.2rem] text-right">
                    Todas as nossas pizzas são preparadas com farinha e molho de tomate importados da Itália.
                </p>
                <span className="font-neue text-[0.6rem] uppercase tracking-widest text-black/30">A Modo Mio</span>
            </blockquote>
        </section>
    )
}

function ChefSuggestionsCarousel({
    title,
    subtitle,
    mobileTitle,
    groups,
    headerProfile,
}: {
    title?: string;
    subtitle?: string;
    mobileTitle?: React.ReactNode;
    groups: CardapioIndexItem[][];
    headerProfile?: ThreadSectionProfile;
}) {
    const [isOpen, setIsOpen] = useState(false);

    if (!groups.length) return null;

    const items = groups.flat();
    const carousel = <SuggestionMiniCarousel items={items} />;

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
                        isOpen ? "max-h-[360px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
                    )}
                >
                    {carousel}
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
                {carousel}
            </div>
        </div>
    );
}


function MaisCurtidasRanking({
    items,
    headerProfile,
}: {
    items: CardapioIndexItem[];
    headerProfile?: ThreadSectionProfile;
}) {
    const [isOpen, setIsOpen] = useState(false);

    if (!items.length) return null;

    const rankList = (
        <div className="flex flex-col gap-1">
            {items.map((item, index) => {
                const media = getPrimaryCardapioMedia(item);
                const rank = index + 1;
                const medalClass = "text-zinc-500 border-zinc-300 bg-white";
                const likeCount = item.likes?.amount ?? 0;

                return (
                    <Link
                        key={item.id}
                        to={getCardapioItemHref(item)}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                    >
                        <span
                            className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                                medalClass
                            )}
                        >
                            {rank}
                        </span>
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                            {media?.secureUrl && (media.kind === "video" || /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(media.secureUrl)) ? (
                                <video
                                    src={media.secureUrl}
                                    muted
                                    loop
                                    playsInline
                                    autoPlay
                                    preload="metadata"
                                    className="h-full w-full object-cover"
                                />
                            ) : media?.secureUrl ? (
                                <img
                                    src={media.secureUrl}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950">
                                    <span className="font-lora text-lg font-bold text-white/80 uppercase leading-none">
                                        {item.name.charAt(0)}
                                    </span>
                                </div>
                            )}
                        </div>
                        <span className="flex-1 font-neue text-sm font-medium text-zinc-800 leading-tight">
                            {item.name}
                        </span>
                        {likeCount > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
                                <Heart className="h-3 w-3 fill-zinc-300 text-zinc-300" />
                                {likeCount}
                            </span>
                        ) : null}
                    </Link>
                );
            })}
        </div>
    );

    return (
        <div className="p-2">
            <div className="md:hidden">
                <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setIsOpen((v) => !v)}
                    aria-expanded={isOpen}
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="font-lora text-2xl font-bold tracking-tight leading-tight">
                            Mais curtidas
                        </h2>
                        <ChevronRight
                            className={cn(
                                "h-6 w-6 shrink-0 transition-transform duration-300",
                                isOpen && "rotate-90"
                            )}
                        />
                    </div>
                    <p className="font-neue text-sm tracking-wide mt-2 text-zinc-600">
                        nossos clientes gostam de mostrar o que é bom. Aqui está uma seleção dos sabores que eles mais curtem e querem compartilhar com todo mundo.
                    </p>
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
                        isOpen ? "max-h-[600px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
                    )}
                >
                    {rankList}
                </div>
            </div>

            <div className="hidden md:block">
                <SectionThreadHeader
                    profile={headerProfile ?? SECTION_THREAD_PROFILE_BY_SECTION.likes}
                    title="Mais curtidas: "
                    subtitle="nossos clientes gostam de mostrar o que é bom. Aqui está uma seleção dos sabores que eles mais curtem e querem compartilhar com todo mundo."
                    className="mb-3"
                />
                {rankList}
            </div>
        </div>
    );
}
