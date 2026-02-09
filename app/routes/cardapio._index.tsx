// app/routes/cardapio._index.tsx

import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import React, {
    useState,
    useRef,
    useCallback,
    useEffect,
    Suspense
} from "react";
import {
    MenuItemWithAssociations,
    menuItemPrismaEntity
} from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
import {
    CardapioItemActionBarVertical,
    LikeIt,
    ShareIt
} from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import Loading from "~/components/loading/loading";
import { FilterTagSelect } from "~/domain/cardapio/components/filter-tags/filter-tags";
import { cn } from "~/lib/utils";
import capitalize from "~/utils/capitalize";
import AwardBadge from "~/components/award-badge/award-badge";
import { Separator } from "~/components/ui/separator";
import {
    CardapioItemPrice,
    CardapioItemPriceSelect
} from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import {
    Carousel,
    CarouselApi,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious
} from "~/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import prismaClient from "~/lib/prisma/client.server";
import { Tag } from "@prisma/client";
import { Heart, X } from "lucide-react";
import { useSoundEffects } from "~/components/sound-effects/use-sound-effects";
import { getOrCreateMenuItemInterestClientId } from "~/domain/cardapio/menu-item-interest/menu-item-interest.client";
import Logo from "~/components/primitives/logo/logo";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";
import { getEngagementSettings } from "~/domain/cardapio/engagement-settings.server";
import CardapioErrorRedirect from "~/domain/cardapio/components/cardapio-error-redirect/cardapio-error-redirect";

const INTEREST_ENDPOINT = "/api/menu-item-interest";
const REELS_SETTING_KEY = "reel.urls";
const REELS_SETTING_CONTEXT = "cardapio";
const MENU_ITEM_INTEREST_SETTING_CONTEXT = "cardapio";
const MENU_ITEM_INTEREST_SETTING_NAME = "menu-item-interest-enabled";
const SIMULATE_ERROR_SETTING_CONTEXT = "cardapio";
const SIMULATE_ERROR_SETTING_NAME = "simula.erro";

export const headers: HeadersFunction = () => ({
    "Cache-Control": "s-maxage=1, stale-while-revalidate=59"
});

// ======================================================
// LOADER
// ======================================================
export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const simulateError = url.searchParams.get("simularErro");
    const simulateErrorByQuery = simulateError === "cardapio-index" || simulateError === "cardapio";
    let simulateErrorBySetting = false;

    try {
        const simulateErrorSetting = await prismaClient.setting.findFirst({
            where: {
                context: SIMULATE_ERROR_SETTING_CONTEXT,
                name: SIMULATE_ERROR_SETTING_NAME,
            },
            orderBy: [{ createdAt: "desc" }],
        });

        simulateErrorBySetting = parseBooleanSetting(simulateErrorSetting?.value, false);
    } catch (error) {
        console.error("[cardapio._index] non-blocking simula.erro load failed, using default", error);
    }

    if (simulateErrorByQuery || simulateErrorBySetting) {
        throw new Error("SIMULACAO_ERRO_CARDAPIO_INDEX");
    }

    // itens agrupados do cardápio
    // @ts-ignore
    const items = menuItemPrismaEntity.findAllGroupedByGroupLight(
        {
            where: {
                visible: true
            },
            option: {
                sorted: true,
                direction: "asc"
            }
        },
        {
            imageTransform: true,
            imageScaleWidth: 375
        }
    );

    // tags públicas (filtros)
    const tags = tagPrismaEntity.findAll({
        public: true
    });

    // post em destaque (já estava no teu arquivo)
    const postFeatured = await prismaClient.post.findFirst({
        where: {
            featured: true
        },
        select: {
            id: true,
            title: true,
            _count: {
                select: {
                    PostLike: true,
                    PostShare: true
                }
            }
        }
    });

    const reelSetting = await prismaClient.setting.findFirst({
        where: {
            context: REELS_SETTING_CONTEXT,
            name: REELS_SETTING_KEY
        },
        orderBy: [{ createdAt: "desc" }],
    });

    const reelUrls = parseReelUrls(reelSetting?.value);

    const menuItemInterestSetting = await prismaClient.setting.findFirst({
        where: {
            context: MENU_ITEM_INTEREST_SETTING_CONTEXT,
            name: MENU_ITEM_INTEREST_SETTING_NAME,
        },
        orderBy: [{ createdAt: "desc" }],
    });
    const menuItemInterestEnabled = parseBooleanSetting(menuItemInterestSetting?.value, true);
    const { likesEnabled, sharesEnabled } = await getEngagementSettings();

    return defer({
        items,
        tags,
        postFeatured,
        reelUrls,
        menuItemInterestEnabled,
        likesEnabled,
        sharesEnabled
    });
}

// ======================================================
// ACTION
// (mantive igual ao teu arquivo, só organizado)
// ======================================================
export async function action({ request }: LoaderFunctionArgs) {
    const formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // like de post
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

    // share de post
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

// ======================================================
// PAGE
// ======================================================
export default function CardapioWebIndex() {
    const { items, tags, postFeatured, reelUrls, menuItemInterestEnabled, likesEnabled, sharesEnabled } = useLoaderData<typeof loader>();
    const hasReels = reelUrls.length > 0;
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
        <section className="flex flex-col mb-24" data-element="cardapio-index">
            <LikeCelebrationOverlay
                isOpen={forceLikeOverlay || showLikeCelebration}
                seed={likeCelebrationSeed}
                onClose={() => setShowLikeCelebration(false)}
            />
            <Separator className="my-6 md:hidden" />

            {/* TOPO: Halloween + Destaques (igual ao teu) */}
            <div
                className={cn(
                    "flex flex-col gap-8 md:grid md:grid-cols-2 md:gap-0 md:items-start md:mb-10 md:justify-center",
                    "mt-28 md:mt-48"
                )}
            >
                {/* Bloco Halloween */}
                {/* <Suspense fallback={<Loading />}>
                    <Await resolve={items}>
                        {(items) => {
                            const imageUrls = Array.from(
                                { length: 4 },
                                (_, i) => `/images/halloween/halloween_25_${i + 1}.png`
                            );
                            return (
                                <section id="halloween" className="flex flex-col mx-2 md:flex-1 mt-24 md:mt-0">
                                    <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide p-2">
                                        Sabores da semana de Halloween 🎃
                                    </h3>
                                    <ImagesCarousel imageUrls={imageUrls} autoplay intervalMs={3500} />
                                </section>
                            );
                        }}
                    </Await>
                </Suspense>

                <Separator className="m-4 md:hidden" /> */}

                {/* Destaques */}
                <Suspense fallback={<Loading />}>
                    <Await resolve={items}>
                        {(items) => {
                            const flatItems = isGrouped(items)
                                ? (items as GroupedItems[]).flatMap((g) => g.menuItems)
                                : (items as MenuItemWithAssociations[]);

                            const topMarginItems = [...(flatItems as MenuItemWithAssociations[])]
                                .sort(
                                    (a, b) =>
                                        getItemMarginPerc(b) - getItemMarginPerc(a)
                                )
                                .slice(0, 12);

                            const chefSuggestionGroups = buildRandomGroups(topMarginItems, 4);

                            const getLikesAmount = (item: MenuItem | MenuItemWithAssociations) =>
                                (item as MenuItemWithAssociations)?.likes?.amount ?? 0;

                            const topLikedItems = likesEnabled
                                ? [...flatItems]
                                    .sort((a, b) => getLikesAmount(b) - getLikesAmount(a))
                                    .slice(0, 4)
                                : [];

                            return (
                                <>
                                    <section
                                        id="destaque"
                                        className="flex flex-col gap-4 mx-2 md:flex-1"
                                    >
                                        <ChefSuggestionsCarousel
                                            title="Sugestões do chef"
                                            subtitle="Os sabores selecionados pelo chef para vocês, com combinações especiais e ótimas escolhas para aproveitar o melhor do cardápio."
                                            groups={chefSuggestionGroups}
                                        />
                                    </section>

                                    {likesEnabled && (
                                        <section
                                            id="mais-curtidas"
                                            className="flex flex-col gap-4 mx-2 md:flex-1"
                                        >
                                            <div className="p-2">
                                                <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2 flex items-center gap-2">
                                                    <Heart aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
                                                    <span>Mais curtidas</span>
                                                    <Heart aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
                                                </h3>
                                                <p className="font-neue text-xs md:text-sm tracking-wide text-muted-foreground mb-3">
                                                    Nossos clientes gostam de mostrar o que é bom. Aqui está uma seleção dos
                                                    sabores que eles mais curtem e querem compartilhar com todo mundo.
                                                </p>
                                                <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
                                                    {topLikedItems.map((i) => {
                                                        const featuredImage =
                                                            i.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
                                                            i.MenuItemGalleryImage?.[0];
                                                        return (
                                                            <Link
                                                                key={i.id}
                                                                to={`/cardapio/${i.slug}`}
                                                                className="group relative block overflow-hidden rounded-md"
                                                            >
                                                                <div className="relative h-[160px] md:h-[200px]">
                                                                    <CardapioItemImageSingle
                                                                        src={featuredImage?.secureUrl || ""}
                                                                        placeholder={i.imagePlaceholderURL || ""}
                                                                        placeholderIcon={false}
                                                                        cnContainer="h-full w-full"
                                                                        enableOverlay={false}
                                                                    />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90" />
                                                                    <div className="absolute bottom-2 left-2 right-2">
                                                                        <span className="font-neue text-white text-xs tracking-widest uppercase font-semibold drop-shadow leading-none">
                                                                            {i.name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </section>
                                    )}
                                </>
                            );
                        }}
                    </Await>
                </Suspense>
            </div>

            {reelUrls.length > 0 ? (
                <div className="mx-4 md:mx-0 my-6">
                    <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-3">
                        Reels sugeridos
                    </h3>
                    <ReelsCarousel urls={reelUrls} />
                </div>
            ) : null}

            <Separator className="m-4" />

            {/* ===================================================== */}
            {/* LISTA PRINCIPAL DO CARDÁPIO COM FILTRO + BARRA DE GRUPOS */}
            {/* ===================================================== */}
            <Suspense fallback={<Loading />}>
                <Await resolve={Promise.all([tags, items])}>
                    {([loadedTags, loadedItems]) => {
                        const [currentItems, setCurrentItems] = useState(loadedItems);
                        const [currentFilterTag, setCurrentFilterTag] = useState<Tag | null>(null);

                        // --- NOVO: refs dos grupos para scroll
                        const groupRefs = useRef<Record<string, HTMLElement | null>>({});

                        const scrollToGroup = (groupId: string) => {
                            const el = groupRefs.current[groupId];
                            if (!el) return;
                            const OFFSET = 110; // ajusta conforme teu header/footer
                            const top = el.getBoundingClientRect().top + window.scrollY - OFFSET;
                            window.scrollTo({
                                top,
                                behavior: "smooth"
                            });
                        };

                        const isGrouped =
                            Array.isArray(currentItems) &&
                            currentItems.length > 0 &&
                            "menuItems" in (currentItems[0] as any);

                        const orderedGroups = isGrouped
                            ? (currentItems as Array<{
                                groupId: string;
                                group: string;
                                sortOrderIndex?: number;
                                menuItems: any[];
                            }>).sort((a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0))
                            : [];

                        // filtro de tag
                        const onCurrentTagSelected = (tag: Tag | null) => {
                            setCurrentFilterTag(tag);

                            // reset
                            if (!tag || tag.id === "all") {
                                setCurrentItems(loadedItems);
                                return;
                            }

                            const tagName = tag.name;
                            const hasTag = (i: any) =>
                                Boolean(
                                    i?.tags?.public?.includes?.(tagName) || i?.tags?.all?.includes?.(tagName)
                                );

                            if (isGrouped) {
                                // mantém estrutura por grupo
                                const filteredGroups = (loadedItems as GroupedItems[])
                                    .map((g) => ({
                                        ...g,
                                        menuItems: g.menuItems.filter(hasTag)
                                    }))
                                    .filter((g) => g.menuItems.length > 0);

                                setCurrentItems(filteredGroups);
                            } else {
                                const filtered = (loadedItems as MenuItem[]).filter(hasTag);
                                setCurrentItems(filtered);
                            }
                        };

                        return (
                            <div className="flex flex-col mx-4">
                                {/* linha título + filtro */}
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="font-neue text-sm md:text-lg font-semibold tracking-wider">
                                        Todos os produtos
                                    </h2>
                                    <FilterTagSelect
                                        tags={loadedTags}
                                        currentTag={currentFilterTag}
                                        onCurrentTagSelected={onCurrentTagSelected}
                                        label="Categorias"
                                    />
                                </div>

                                {/* ===== NOVO: BARRA HORIZONTAL DESLIZÁVEL ===== */}
                                {isGrouped && orderedGroups.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-2 mt-1 mb-3 no-scrollbar">
                                        {orderedGroups.map((g) => (
                                            <button
                                                key={g.groupId}
                                                onClick={() => scrollToGroup(g.groupId)}
                                                className="whitespace-nowrap px-3 py-1 rounded-full bg-zinc-100 text-xs md:text-sm font-neue hover:bg-zinc-200 transition"
                                            >
                                                {g.group}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* ===== LISTA POR GRUPO ===== */}
                                {isGrouped
                                    ? orderedGroups.map((g) => (
                                        <section
                                            key={g.groupId}
                                            ref={(el) => (groupRefs.current[g.groupId] = el)}
                                            className="mb-6 scroll-mt-28"
                                        >
                                            <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2 border-b">
                                                {g.group}
                                            </h3>
                                            <CardapioItemsGrid
                                                items={g.menuItems}
                                                interestTrackingEnabled={menuItemInterestEnabled}
                                                likesEnabled={likesEnabled}
                                                sharesEnabled={sharesEnabled}
                                            />
                                        </section>
                                    ))
                                    : (
                                        <CardapioItemsGrid
                                            items={currentItems as any[]}
                                            interestTrackingEnabled={menuItemInterestEnabled}
                                            likesEnabled={likesEnabled}
                                            sharesEnabled={sharesEnabled}
                                        />
                                    )}
                            </div>
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

    return <CardapioErrorRedirect redirectHref={saiposHref} />;
}

// ======================================================
// LIKE CELEBRATION OVERLAY
// ======================================================
type LikeCelebrationOverlayProps = {
    isOpen: boolean;
    seed: number;
    onClose: () => void;
};

type CelebrationHeart = {
    left: number;
    size: number;
    delay: number;
    duration: number;
    drift: number;
    opacity: number;
    rotate: number;
    color: string;
};

function LikeCelebrationOverlay({ isOpen, seed, onClose }: LikeCelebrationOverlayProps) {
    const hearts = React.useMemo(() => buildCelebrationHearts(seed, 38), [seed]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center"
            role="button"
            aria-label="Fechar animação de curtida"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black/60" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {hearts.map((heart, index) => (
                    <div
                        key={`${seed}-${index}`}
                        className="like-celebration-heart"
                        style={{
                            left: `${heart.left}%`,
                            fontSize: `${heart.size}px`,
                            opacity: heart.opacity,
                            animationDelay: `${heart.delay}s`,
                            animationDuration: `${heart.duration}s`,
                            "--like-drift": `${heart.drift}px`,
                            "--like-rotate": `${heart.rotate}deg`,
                            "--like-color": heart.color,
                        } as React.CSSProperties}
                    >
                        <Heart />
                    </div>
                ))}
            </div>
            <div className="relative z-10 pointer-events-none">
                <div className="like-celebration-pop px-6 py-3 font-neue text-red-600 text-6xl md:text-6xl font-semibold tracking-tighter uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                    OBRIGADO!
                </div>
            </div>
            <style>{`
                @keyframes like-fall {
                    0% {
                        transform: translate3d(0, -25vh, 0) rotate(var(--like-rotate, -8deg)) scale(0.85);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    100% {
                        transform: translate3d(var(--like-drift, 0px), 120vh, 0) rotate(calc(var(--like-rotate, -8deg) + 24deg)) scale(1.05);
                        opacity: 0;
                    }
                }
                @keyframes like-pop {
                    0% { transform: scale(0.85); opacity: 0; }
                    30% { transform: scale(1); opacity: 1; }
                    70% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.9; }
                }
                .like-celebration-heart {
                    position: absolute;
                    top: 0;
                    color: var(--like-color, rgba(220, 38, 38, 1));
                    filter:
                        drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35))
                        drop-shadow(0 0 6px rgba(220, 38, 38, 0.45));
                    animation-name: like-fall;
                    animation-timing-function: ease-in;
                    animation-iteration-count: 1;
                }
                .like-celebration-heart svg {
                    width: 1em;
                    height: 1em;
                    fill: currentColor;
                    stroke: rgba(255,255,255,0.6);
                    stroke-width: 0.4px;
                }
                .like-celebration-pop {
                    text-shadow: 0 10px 30px rgba(0,0,0,0.35);
                    animation: like-pop 1.6s ease-out;
                }
            `}</style>
        </div>
    );
}

function buildCelebrationHearts(seed: number, amount: number): CelebrationHeart[] {
    const rand = mulberry32(seed || 1);
    const palette = [
        "rgba(220, 38, 38, 1)",
        "rgba(239, 68, 68, 1)",
        "rgba(248, 113, 113, 1)",
        "rgba(185, 28, 28, 1)",
    ];
    return Array.from({ length: amount }, () => {
        const size = 18 + Math.round(rand() * 22);
        return {
            left: Math.round(rand() * 100),
            size,
            delay: parseFloat((rand() * 0.5).toFixed(2)),
            duration: parseFloat((3.2 + rand() * 1.8).toFixed(2)),
            drift: Math.round((rand() - 0.5) * 180),
            opacity: parseFloat((0.55 + rand() * 0.4).toFixed(2)),
            rotate: Math.round((rand() - 0.5) * 30),
            color: palette[Math.floor(rand() * palette.length)],
        };
    });
}

function mulberry32(seed: number) {
    let t = seed;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

// ======================================================
// CARROSSEL DE IMAGENS (já estava no teu arquivo)
// ======================================================
type ImagesCarouselProps = {
    imageUrls: string[];
    className?: string;
    autoplay?: boolean;
    intervalMs?: number;
};

function ImagesCarousel({
    imageUrls,
    className,
    autoplay = true,
    intervalMs = 3500
}: ImagesCarouselProps) {
    const plugin = React.useRef(
        Autoplay({ delay: intervalMs, stopOnInteraction: false })
    );

    return (
        <Carousel
            className={className}
            plugins={autoplay ? [plugin.current] : []}
            opts={{ loop: true, align: "start" }}
        >
            <CarouselContent>
                {imageUrls.map((src, i) => (
                    <CarouselItem key={src ?? i} className="basis-full lg:basis-1/3">
                        <div className="p-2">
                            <div className="overflow-hidden shadow">
                                <img
                                    src={src}
                                    alt={`Imagem ${i + 1}`}
                                    loading="lazy"
                                    className="h-auto w-full object-cover"
                                />
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>

            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
        </Carousel>
    );
}

// ======================================================
// LISTA COM INFINITE SCROLL (mantida)
// ======================================================
const CardapioItemList = ({
    allItems,
    likesEnabled,
    sharesEnabled
}: {
    allItems: MenuItemWithAssociations[];
    likesEnabled: boolean;
    sharesEnabled: boolean;
}) => {
    const [searchParams] = useSearchParams();
    const currentFilterTag = searchParams.get("tag");

    const [items, setItems] = useState<MenuItemWithAssociations[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }

        setIsLoading(true);

        loadingTimeoutRef.current = setTimeout(() => {
            const itemsFiltered = currentFilterTag
                ? allItems.filter((i) => i.tags?.public.some((t) => t === currentFilterTag))
                : allItems;

            setItems(itemsFiltered.slice(0, 10));
            setHasMore(itemsFiltered.length > 10);
            setIsLoading(false);
        }, 300);

        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, [currentFilterTag, allItems]);

    const observer = useRef<IntersectionObserver | null>(null);

    const lastItemRef = useCallback(
        (node: HTMLLIElement) => {
            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setItems((prevItems) => {
                        const itemsFiltered = currentFilterTag
                            ? allItems.filter((i) => i.tags?.public.some((t) => t === currentFilterTag))
                            : allItems;

                        const newItems = itemsFiltered.slice(prevItems.length, prevItems.length + 10);
                        setHasMore(newItems.length > 0);
                        return [...prevItems, ...newItems];
                    });
                }
            });

            if (node) observer.current.observe(node);
        },
        [hasMore, allItems, currentFilterTag]
    );

    if (isLoading) {
        return (
            <div className="my-8">
                <Loading />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <section>
                <ul className="flex flex-col overflow-y-auto md:overflow-y-auto snap-mandatory mt-4 md:grid md:grid-cols-2 md:gap-x-4">
                    {items.map((item, index) => {
                        const isLastItem = items.length === index + 1;
                        return (
                            <CardapioItemFullImage
                                ref={isLastItem ? lastItemRef : null}
                                key={item.id}
                                item={item}
                                likesEnabled={likesEnabled}
                                sharesEnabled={sharesEnabled}
                            />
                        );
                    })}
                </ul>
            </section>
        </div>
    );
};

// ======================================================
// GRID DE ITENS (teu componente atualizado)
// ======================================================
function CardapioItemsGrid({
    items,
    interestTrackingEnabled,
    likesEnabled,
    sharesEnabled
}: {
    items: MenuItemWithAssociations[];
    interestTrackingEnabled: boolean;
    likesEnabled: boolean;
    sharesEnabled: boolean;
}) {
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [desktopDialogId, setDesktopDialogId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);

    const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
    const trackedViewRef = useRef<Set<string>>(new Set());
    const trackedOpenDetailRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener?.("change", update);
        return () => mq.removeEventListener?.("change", update);
    }, []);

    if (!items?.length) return null;

    const trackInterest = useCallback((type: "view_list" | "open_detail", menuItemId: string) => {
        if (!interestTrackingEnabled) return;
        const clientId = getOrCreateMenuItemInterestClientId();

        fetch(INTEREST_ENDPOINT, {
            method: "post",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ type, menuItemId, clientId }),
            keepalive: true
        }).catch((error) => {
            console.warn("[cardapio] falha ao registrar interesse", error);
        });
    }, [interestTrackingEnabled]);

    const trackViewOnce = useCallback(
        (menuItemId: string) => {
            if (!interestTrackingEnabled) return;
            if (trackedViewRef.current.has(menuItemId)) return;
            trackedViewRef.current.add(menuItemId);
            trackInterest("view_list", menuItemId);
        },
        [interestTrackingEnabled, trackInterest]
    );

    const trackOpenDetailOnce = useCallback(
        (menuItemId: string) => {
            if (!interestTrackingEnabled) return;
            if (trackedOpenDetailRef.current.has(menuItemId)) return;
            trackedOpenDetailRef.current.add(menuItemId);
            trackInterest("open_detail", menuItemId);
        },
        [interestTrackingEnabled, trackInterest]
    );

    const scrollToItemTop = (id: string) => {
        const el = itemRefs.current[id];
        if (!el) return;
        const OFFSET = 120;
        const top = el.getBoundingClientRect().top + window.scrollY - OFFSET;
        window.scrollTo({ top, behavior: "smooth" });
    };

    const onCardClick = (id: string) => {
        if (isDesktop) {
            setDesktopDialogId(id);
            return;
        }

        setExpandedItemId((curr) => {
            const willExpand = curr !== id;
            const next = willExpand ? id : null;

            if (willExpand) {
                trackOpenDetailOnce(id);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => scrollToItemTop(id));
                });
            }
            return next;
        });
    };

    return (
        <>
            <ul
                className="
          mt-4 grid grid-cols-2 gap-3
          sm:grid-cols-3
          lg:grid-cols-4
          xl:grid-cols-4
        "
            >
                {items.map((item) => (
                    <CardapioGridItem
                        key={item.id}
                        item={item}
                        isExpanded={expandedItemId === item.id}
                        onClick={() => onCardClick(item.id)}
                        onOpenDetail={() => trackOpenDetailOnce(item.id)}
                        onView={() => trackViewOnce(item.id)}
                        isDesktop={isDesktop}
                        likesEnabled={likesEnabled}
                        sharesEnabled={sharesEnabled}
                        innerRef={(el) => (itemRefs.current[item.id] = el)}
                    />
                ))}
            </ul>
            {/* se tiver dialog desktop, ele entra aqui (você pode manter o seu) */}
        </>
    );
}

function CardapioGridItem({
    item,
    isExpanded,
    onClick,
    onOpenDetail,
    onView,
    isDesktop,
    innerRef,
    likesEnabled,
    sharesEnabled
}: {
    item: MenuItemWithAssociations;
    isExpanded: boolean;
    onClick: () => void;
    onOpenDetail?: () => void;
    onView?: () => void;
    isDesktop: boolean;
    innerRef?: (el: HTMLLIElement | null) => void;
    likesEnabled: boolean;
    sharesEnabled: boolean;
}) {
    const localRef = useRef<HTMLLIElement | null>(null);
    const featuredImage =
        item.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
        item.MenuItemGalleryImage?.[0];

    const setRefs = useCallback(
        (el: HTMLLIElement | null) => {
            localRef.current = el;
            innerRef?.(el);
        },
        [innerRef]
    );

    useEffect(() => {
        const element = localRef.current;
        if (!element || !onView) return;

        let tracked = false;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting || tracked) return;
                tracked = true;
                onView();
                observer.disconnect();
            },
            { threshold: 0.5 }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [onView]);

    return (
        <li
            ref={setRefs}
            className={cn(
                "flex flex-col rounded-md border border-transparent",
                "transition-all duration-300 ease-in-out",
                "scroll-mt-24 lg:scroll-mt-0",
                isExpanded ? "col-span-2 lg:col-span-1" : "col-span-1"
            )}
        >
            {isDesktop ? (
                <Link
                    to={`/cardapio/${item.slug}`}
                    className="flex flex-col cursor-pointer"
                    aria-label={`Abrir ${item.name}`}
                    onClick={onOpenDetail}
                >
                    <div className="group overflow-hidden rounded-t-md relative focus:outline-none focus:ring-2 focus:ring-black/20">
                        <div
                            className={cn(
                                "relative transition-all duration-300 ease-in-out",
                                isExpanded ? "h-[260px]" : "h-[150px]"
                            )}
                        >
                            <CardapioItemImageSingle
                                src={featuredImage?.secureUrl || ""}
                                placeholder={item.imagePlaceholderURL || ""}
                                placeholderIcon={false}
                                cnPlaceholderText={cn(
                                    "text-black font-urw text-sm tracking-tight",
                                    isExpanded && "text-lg"
                                )}
                                cnPlaceholderContainer="from-zinc-200 via-zinc-100 to-white "
                                cnContainer="w-full h-full"
                                enableOverlay={false}
                            />

                            {item.meta?.isBestSeller && (
                                <div className="absolute left-1 top-2 rounded-sm bg-black px-2 py-[2px] text-[10px] font-medium text-white backdrop-blur font-neue tracking-wide">
                                    <span>Mais vendido</span>
                                </div>
                            )}
                            {item.tags?.all?.includes("produtos-italianos") && (
                                <div className="absolute left-1 top-2 rounded-sm bg-black px-2 py-[2px] text-[10px] font-medium text-white backdrop-blur font-neue tracking-wide">
                                    <span>Com produtos italianos</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-1 pb-2 pt-1 flex flex-col bg-white rounded-b-md sm:pt-2">
                        <span
                            className={cn(
                                "font-neue line-clamp-1 font-medium text-xs tracking-wide sm:tracking-widest md:uppercase ",
                                isExpanded && "text-md"
                            )}
                        >
                            {item.name}
                        </span>

                        <span
                            className={cn(
                                "font-neue text-xs tracking-wide leading-[110%] sm:text-base md:text-sm line-clamp-2 my-1",
                                isExpanded && "text-md line-clamp-none mb-2 leading-[120%]"
                            )}
                        >
                            {item.ingredients}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            <span>Ver ingredientes</span>
                            <span aria-hidden="true">...</span>
                        </span>
                    </div>
                </Link>
            ) : (
                <div
                    className="flex flex-col cursor-pointer"
                    onClick={onClick}
                    role="button"
                    aria-label={`Abrir ${item.name}`}
                >
                    <div className="group overflow-hidden rounded-t-md relative focus:outline-none focus:ring-2 focus:ring-black/20">
                        <div
                            className={cn(
                                "relative transition-all duration-300 ease-in-out",
                                isExpanded ? "h-[260px]" : "h-[150px]"
                            )}
                        >
                            <CardapioItemImageSingle
                                src={featuredImage?.secureUrl || ""}
                                placeholder={item.imagePlaceholderURL || ""}
                                placeholderIcon={false}
                                cnPlaceholderText={cn(
                                    "text-black font-urw text-sm tracking-tight",
                                    isExpanded && "text-lg"
                                )}
                                cnPlaceholderContainer="from-zinc-200 via-zinc-100 to-white "
                                cnContainer="w-full h-full"
                                enableOverlay={false}
                            />

                            {item.meta?.isBestSeller && (
                                <div className="absolute left-1 top-2 rounded-sm bg-black px-2 py-[2px] text-[10px] font-medium text-white backdrop-blur font-neue tracking-wide">
                                    <span>Mais vendido</span>
                                </div>
                            )}
                            {item.tags?.all?.includes("produtos-italianos") && (
                                <div className="absolute left-1 top-2 rounded-sm bg-black px-2 py-[2px] text-[10px] font-medium text-white backdrop-blur font-neue tracking-wide">
                                    <span>Com produtos italianos</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-1 pb-2 pt-1 flex flex-col bg-white rounded-b-md">
                        <span
                            className={cn(
                                "font-neue line-clamp-1 font-medium text-xs tracking-wide sm:text-base",
                                isExpanded && "text-md"
                            )}
                        >
                            {item.name}
                        </span>

                        <span
                            className={cn(
                                "font-neue text-xs tracking-wide leading-[110%] sm:text-base md:text-sm line-clamp-2 my-1",
                                isExpanded && "text-md line-clamp-none mb-2 leading-[120%]"
                            )}
                        >
                            {item.ingredients}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            <span>Ver ingredientes</span>
                            <span aria-hidden="true">...</span>
                        </span>
                    </div>
                </div>
            )}

            <CardapioItemPriceSelect prices={item.MenuItemSellingPriceVariation} />

            {(sharesEnabled || likesEnabled) && (
                <div className="flex flex-col gap-y-1 shadow-sm bg-white my-2">
                    {sharesEnabled && (
                        <ShareIt
                            item={item}
                            size={isExpanded === true ? 20 : 16}
                            cnContainer={cn("px-2 py-0 h-7 border border-black")}
                        >
                            <span className="font-neue text-xs uppercase tracking-wide ">Compartilhar</span>
                        </ShareIt>
                    )}

                    {likesEnabled && (
                        <LikeIt
                            item={item}
                            size={isExpanded === true ? 20 : 16}
                            cnContainer={cn("px-2 py-0 h-7 bg-red-500 text-white")}
                            color="white"
                        >
                            <span className="font-neue text-xs uppercase tracking-wide">Gostei</span>
                        </LikeIt>
                    )}
                </div>
            )}

            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out bg-white rounded-b-md",
                    isExpanded ? "max-h-[320px] opacity-100 px-3 pb-3" : "max-h-0 opacity-0 px-0 pb-0"
                )}
            >
                <div className="mt-1 space-y-2 text-xs">{/* extra se quiser */}</div>
            </div>
        </li>
    );
}

// ======================================================
// CARD DE LISTA COMPLETA (full image)
// ======================================================
interface CardapioItemFullImageProps {
    item: MenuItemWithAssociations;
    likesEnabled: boolean;
    sharesEnabled: boolean;
}

const CardapioItemFullImage = React.forwardRef(
    ({ item, likesEnabled, sharesEnabled }: CardapioItemFullImageProps, ref: any) => {
        const { playNavigation } = useSoundEffects();
        const italyProduct = item.tags?.public.some(
            (t) => t.toLocaleLowerCase() === "produtos-italianos"
        );
        const bestMonthlySeller = item.tags?.all.some(
            (t) => t.toLocaleLowerCase() === "mais-vendido-mes"
        );
        const bestSeller = item.tags?.all.some(
            (t) => t.toLocaleLowerCase() === "mais-vendido"
        );

        const featuredImage = item.MenuItemGalleryImage.filter((img) => img.isPrimary)[0];

        return (
            <li className="snap-start border-b py-[0.15rem]" id={item.id} ref={ref}>
                <div className="relative h-[350px]">
                    <CardapioItemImageSingle
                        src={featuredImage?.secureUrl || ""}
                        placeholder={item.imagePlaceholderURL || ""}
                        placeholderIcon={false}
                        cnContainer="w-full h-full"
                    />

                    <div className="absolute inset-0">
                        <div className="grid grid-cols-8 h-full">
                            <Link
                                to={`/cardapio/${item.slug}`}
                                className="flex flex-col mb-2 px-4 text-white  justify-end items-end w-full col-span-7"
                                onClick={() => {
                                    playNavigation();
                                }}
                            >
                                <div className="flex flex-col gap-0">
                                    <div className="flex items-center gap-2">
                                        {italyProduct && <ItalyIngredientsStatement showText={false} />}
                                        <h3 className="font-urw text-xl">{item.name}</h3>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {bestSeller && <AwardBadge>A mais desejada</AwardBadge>}
                                        {bestMonthlySeller && <AwardBadge>Mais vendida do mes</AwardBadge>}
                                    </div>

                                    <div className="flex flex-col gap-0 ">
                                        <p className="font-neue leading-tight text-[15px] mt-1 mb-4 tracking-wide">
                                            {capitalize(item.ingredients)}
                                        </p>
                                        <CardapioItemPrice
                                            prices={item?.MenuItemSellingPriceVariation}
                                            cnLabel="text-white"
                                            cnValue="text-white font-semibold"
                                            showValuta={false}
                                        />
                                    </div>
                                </div>
                            </Link>
                            <CardapioItemActionBarVertical
                                item={item}
                                likesEnabled={likesEnabled}
                                sharesEnabled={sharesEnabled}
                            />
                        </div>
                    </div>
                </div>
            </li>
        );
    }
);

// ======================================================
// TIPOS / HELPERS
// ======================================================
type MenuItem = {
    id: string;
    name: string;
    slug: string;
    imagePlaceholderURL?: string;
    MenuItemGalleryImage?: { isPrimary?: boolean; secureUrl?: string }[];
    tags?: { all?: string[]; public?: string[] };
};

type GroupedItems = {
    groupId: string;
    group: string;
    sortOrderIndex?: number;
    menuItems: MenuItem[];
};

type CardapioItemListDestaqueProps = {
    title?: string;
    items: MenuItem[] | GroupedItems[];
    tagFilter?: string;
    carouselDelay?: number;
};

function isGrouped(items: MenuItem[] | GroupedItems[]): items is GroupedItems[] {
    return Array.isArray(items) && items.length > 0 && "menuItems" in (items[0] as any);
}

function getItemMarginPerc(item: MenuItemWithAssociations) {
    const variations = item.MenuItemSellingPriceVariation ?? [];
    const visibleVariations = variations.filter((v) => v.showOnCardapio);
    const source = visibleVariations.length > 0 ? visibleVariations : variations;
    if (!source.length) return 0;
    return Math.max(
        ...source.map(
            (v) => Number(v.profitActualPerc ?? v.profitExpectedPerc ?? 0)
        )
    );
}

function buildRandomGroups<T>(items: T[], size: number) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const groups: T[][] = [];
    for (let i = 0; i < shuffled.length; i += size) {
        groups.push(shuffled.slice(i, i + size));
    }
    return groups;
}

function parseReelUrls(raw?: string | null) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter((url) => typeof url === "string" && url.trim().length > 0);
        }
        if (typeof parsed === "string" && parsed.trim().length > 0) return [parsed.trim()];
    } catch {
        return raw
            .split(/\r?\n|,/g)
            .map((url) => url.trim())
            .filter(Boolean);
    }
    return [];
}

function ReelsCarousel({ urls }: { urls: string[] }) {
    if (!urls.length) return null;

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

    const openFullscreen = (index: number) => {
        const video = videoRefs.current[index];
        const container = containerRefs.current[index];
        if (!video) return;
        const anyVideo = video as any;
        video.controls = true;
        if (typeof anyVideo.webkitEnterFullscreen === "function") {
            anyVideo.webkitEnterFullscreen();
            return;
        }
        if (container && typeof container.requestFullscreen === "function") {
            container.requestFullscreen().catch(() => null);
        }
    };

    useEffect(() => {
        const refs = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
        if (!refs.length) return;

        const handleFullscreenChange = () => {
            const fullscreenEl = document.fullscreenElement as HTMLElement | null;
            const idx = fullscreenEl
                ? containerRefs.current.findIndex((el) => el === fullscreenEl)
                : -1;
            setFullscreenIndex(idx >= 0 ? idx : null);
            refs.forEach((video) => {
                if (!fullscreenEl) {
                    video.controls = false;
                }
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
                    <CarouselItem key={`${url}-${index}`} className="basis-[45%] md:basis-1/5 lg:basis-1/6">
                        <div className="px-0">
                            <div
                                ref={(el) => {
                                    containerRefs.current[index] = el;
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
                                    ref={(el) => {
                                        videoRefs.current[index] = el;
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
                                {fullscreenIndex === index && (
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
                                )}
                                <div className={
                                    cn(
                                        "pointer-events-none absolute left-3 z-10 flex items-center gap-2",
                                        fullscreenIndex === index ? "bottom-16" : "bottom-2"
                                    )
                                }>
                                    <Logo circle color="white" className={
                                        cn(
                                            fullscreenIndex === index ? "h-11 w-11 p-1.5" : "h-6 w-6 p-0.5"
                                        )
                                    } />
                                    <span className="text-sm font-semibold tracking-wide text-white drop-shadow">
                                        amodomio
                                    </span>
                                </div>
                                {fullscreenIndex === index && (
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
                                            aria-label="Voltar"
                                        >
                                            VOLTAR
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
    );
}

type ChefSuggestionsCarouselProps = {
    title?: string;
    subtitle?: string;
    groups: MenuItemWithAssociations[][];
    carouselDelay?: number;
};

function ChefSuggestionsCarousel({
    title,
    subtitle,
    groups,
    carouselDelay = 2500
}: ChefSuggestionsCarouselProps) {
    const { playNavigation } = useSoundEffects();
    const [api, setApi] = React.useState<CarouselApi | null>(null);
    const [selectedIndex, setSelectedIndex] = React.useState(0);

    React.useEffect(() => {
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

    return (
        <div className="p-2">
            {title ? (
                <div className="mb-2">
                    <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-1">
                        {title}
                    </h3>
                    {subtitle ? (
                        <p className="font-neue text-xs md:text-sm tracking-wide text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
            ) : null}

            <Carousel
                setApi={setApi}
                opts={{ loop: true, align: "start" }}
                plugins={[
                    Autoplay({
                        delay: carouselDelay,
                        stopOnInteraction: false,
                        stopOnMouseEnter: true
                    })
                ]}
                className="relative"
            >
                <CarouselContent>
                    {items.map((i) => {
                        const featuredImage =
                            i.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
                            i.MenuItemGalleryImage?.[0];

                        return (
                            <CarouselItem key={i.id} className="basis-full">
                                <Link
                                    to={`/cardapio/${i.slug}`}
                                    className="group relative block overflow-hidden rounded-md"
                                    onClick={() => playNavigation()}
                                >
                                    <div className="relative h-[220px] md:h-[280px]">
                                        <CardapioItemImageSingle
                                            src={featuredImage?.secureUrl || ""}
                                            placeholder={i.imagePlaceholderURL || ""}
                                            placeholderIcon={false}
                                            placeholderText={i.ingredients}
                                            cnContainer="h-full w-full"
                                            enableOverlay={false}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90" />
                                        <div className="absolute bottom-2 left-2 right-2">
                                            <span className="font-neue text-white text-xs tracking-widest uppercase font-semibold drop-shadow leading-tight">
                                                {i.name}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>

                <div className="absolute inset-x-0 -bottom-3 flex items-center justify-center gap-2 md:-bottom-4">
                    {groups.map((_, idx) => (
                        <button
                            key={idx}
                            aria-label={`Ir para slide ${idx + 1}`}
                            onClick={() => api?.scrollTo(idx * groupSize)}
                            className={[
                                "h-2 w-2 rounded-full transition-all",
                                selectedGroupIndex === idx ? "w-6 bg-black/80" : "bg-black/30"
                            ].join(" ")}
                        />
                    ))}
                </div>
            </Carousel>
        </div>
    );
}

// ======================================================
// DESTAQUES (mantido)
// ======================================================
function CardapioItemListDestaque({
    title,
    items,
    tagFilter,
    carouselDelay = 2000
}: CardapioItemListDestaqueProps) {
    const { playNavigation } = useSoundEffects();
    const [api, setApi] = React.useState<CarouselApi | null>(null);
    const [selectedIndex, setSelectedIndex] = React.useState(0);

    const badge =
        tagFilter?.toLowerCase() === "mais-vendido"
            ? "Mais vendido"
            : tagFilter?.toLowerCase() === "em-destaque"
                ? "Sugestão do chef"
                : undefined;

    // MODO 1: lista plana
    if (!isGrouped(items)) {
        const slides = React.useMemo(() => {
            return (items || [])
                .filter((i) => (tagFilter ? i.tags?.all?.some((t) => t === tagFilter) : true))
                .slice(0, 4);
        }, [items, tagFilter]);

        React.useEffect(() => {
            if (!api) return;
            const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
            api.on("select", onSelect);
            setSelectedIndex(api.selectedScrollSnap());
            return () => api.off("select", onSelect);
        }, [api]);

        if (!slides.length) return null;

        return (
            <div className="p-2">
                {title ? (
                    <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2">
                        {title}
                    </h3>
                ) : null}

                <Carousel
                    setApi={setApi}
                    opts={{ loop: true, align: "start" }}
                    plugins={[
                        Autoplay({
                            delay: carouselDelay,
                            stopOnInteraction: false,
                            stopOnMouseEnter: true
                        })
                    ]}
                    className="relative"
                >
                    <CarouselContent>
                        {slides.map((i) => {
                            const featuredImage =
                                i.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
                                i.MenuItemGalleryImage?.[0];

                            return (
                                <CarouselItem key={i.id}>
                                    <Link
                                        to={`/cardapio/${i.slug}`}
                                        className="block w-full"
                                        onClick={() => playNavigation()}
                                    >
                                        <div className="relative h-[320px] md:h-[380px] overflow-hidden rounded-md">
                                            <CardapioItemImageSingle
                                                src={featuredImage?.secureUrl || ""}
                                                placeholder={i.imagePlaceholderURL || ""}
                                                placeholderIcon={false}
                                                cnPlaceholderContainer="from-zinc-200 via-zinc-100 to-white "
                                                cnContainer="h-full w-full"
                                                enableOverlay={false}
                                            />
                                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                                            {badge && (
                                                <div className="absolute left-3 top-3 rounded-md bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur font-neue">
                                                    {badge}
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-3 right-3">
                                                <h4 className="font-neue text-white text-xs tracking-widest uppercase font-semibold drop-shadow">
                                                    {i.name}
                                                </h4>
                                            </div>
                                        </div>
                                    </Link>
                                </CarouselItem>
                            );
                        })}
                    </CarouselContent>

                    <div className="absolute inset-x-0 -bottom-3 flex items-center justify-center gap-2 md:-bottom-4">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                aria-label={`Ir para slide ${idx + 1}`}
                                onClick={() => api?.scrollTo(idx)}
                                className={[
                                    "h-2 w-2 rounded-full transition-all",
                                    selectedIndex === idx ? "w-6 bg-black/80" : "bg-black/30"
                                ].join(" ")}
                            />
                        ))}
                    </div>
                </Carousel>
            </div>
        );
    }

    // MODO 2: agrupado
    const groups = React.useMemo(
        () =>
            (items as GroupedItems[])
                .map((g) => ({
                    ...g,
                    slides: (g.menuItems || [])
                        .filter((i) => (tagFilter ? i.tags?.all?.some((t) => t === tagFilter) : true))
                        .slice(0, 4)
                }))
                .filter((g) => g.slides.length > 0)
                .sort((a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0)),
        [items, tagFilter]
    );

    if (!groups.length) return null;

    return (
        <div className="p-2">
            {title ? (
                <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2">
                    {title}
                </h3>
            ) : null}

            <div className="flex flex-col gap-6">
                {groups.map((group) => (
                    <section key={group.groupId}>
                        <Carousel
                            opts={{ loop: true, align: "start" }}
                            plugins={[
                                Autoplay({
                                    delay: carouselDelay,
                                    stopOnInteraction: false,
                                    stopOnMouseEnter: true
                                })
                            ]}
                            className="relative"
                        >
                            <CarouselContent>
                                {group.slides.map((i) => {
                                    const featuredImage =
                                        i.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
                                        i.MenuItemGalleryImage?.[0];

                                    return (
                                        <CarouselItem key={i.id}>
                                            <Link
                                                to={`/cardapio/${i.slug}`}
                                                className="block w-full"
                                                onClick={() => playNavigation()}
                                            >
                                                <div className="relative h-[320px] md:h-[380px] overflow-hidden rounded-md">
                                                    <CardapioItemImageSingle
                                                        src={featuredImage?.secureUrl || ""}
                                                        placeholder={i.imagePlaceholderURL || ""}
                                                        placeholderIcon={false}
                                                        cnContainer="h-full w-full"
                                                        enableOverlay={false}
                                                        cnPlaceholderContainer="from-white via-zinc-100 to-zinc-200 "
                                                        cnPlaceholderText="text-black font-urw text-xl tracking-tighter"
                                                    />
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                                                    {badge && (
                                                        <div className="absolute left-3 top-3 rounded-md bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur font-neue">
                                                            {badge}
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-3 left-3 right-3">
                                                        <h5 className="font-neue text-white text-sm tracking-widest uppercase font-semibold drop-shadow">
                                                            {i.name}
                                                        </h5>
                                                    </div>
                                                </div>
                                            </Link>
                                        </CarouselItem>
                                    );
                                })}
                            </CarouselContent>
                        </Carousel>
                    </section>
                ))}
            </div>
        </div>
    );
}
