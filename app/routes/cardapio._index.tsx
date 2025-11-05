// app/routes/cardapio._index.tsx

import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData, useSearchParams } from "@remix-run/react";
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
import { menuItemLikePrismaEntity } from "~/domain/cardapio/menu-item-like.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { menuItemSharePrismaEntity } from "~/domain/cardapio/menu-item-share.prisma.entity.server";
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
import { useSoundEffects } from "~/components/sound-effects/use-sound-effects";

export const headers: HeadersFunction = () => ({
    "Cache-Control": "s-maxage=1, stale-while-revalidate=59"
});

// ======================================================
// LOADER
// ======================================================
export async function loader({ request }: LoaderFunctionArgs) {
    // itens agrupados do cardápio
    // @ts-ignore
    const items = menuItemPrismaEntity.findAllGroupedByGroup(
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

    return defer({
        items,
        tags,
        postFeatured
    });
}

// ======================================================
// ACTION
// (mantive igual ao teu arquivo, só organizado)
// ======================================================
export async function action({ request }: LoaderFunctionArgs) {
    const formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // like de item do cardápio
    if (values?.action === "menu-item-like-it") {
        const itemId = values?.itemId as string;
        let amount = 0;

        amount = isNaN(Number(values?.likesAmount)) ? 1 : Number(values?.likesAmount);

        const [err, likeAmount] = await prismaIt(
            menuItemLikePrismaEntity.create({
                createdAt: new Date().toISOString(),
                amount,
                MenuItem: {
                    connect: {
                        id: itemId
                    }
                }
            })
        );

        if (err) {
            return badRequest({
                action: "menu-item-like-it",
                likeAmount
            });
        }

        return ok({
            action: "menu-item-like-it",
            likeAmount
        });
    }

    // share de item do cardápio
    if (values?.action === "menu-item-share-it") {
        const itemId = values?.itemId as string;

        const [err, shareAmount] = await prismaIt(
            menuItemSharePrismaEntity.create({
                createdAt: new Date().toISOString(),
                MenuItem: {
                    connect: {
                        id: itemId
                    }
                }
            })
        );

        if (err) {
            return badRequest({
                action: "menu-item-share-it",
                shareAmount
            });
        }

        return ok({
            action: "menu-item-share-it",
            shareAmount
        });
    }

    // like de post
    if (values?.action === "post-like-it") {
        const postId = values?.postId as string;
        let amount = 0;

        amount = isNaN(Number(values?.likesAmount)) ? 1 : Number(values?.likesAmount);

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
    const { items, tags, postFeatured } = useLoaderData<typeof loader>();

    return (
        <section className="flex flex-col mb-24" data-element="cardapio-index">
            <Separator className="my-6 md:hidden" />

            {/* TOPO: Halloween + Destaques (igual ao teu) */}
            <div className="flex flex-col mt-24 md:grid md:grid-cols-2 md:items-start">
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
                            return (
                                <section id="destaque" className="flex flex-col gap-4 mx-2 md:flex-1 ">
                                    {/* @ts-ignore */}
                                    <CardapioItemListDestaque items={items} title="Sugestões do chef" tagFilter="em-destaque" />
                                </section>
                            );
                        }}
                    </Await>
                </Suspense>
            </div>

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
                                            <CardapioItemsGrid items={g.menuItems} />
                                        </section>
                                    ))
                                    : (
                                        <CardapioItemsGrid items={currentItems as any[]} />
                                    )}
                            </div>
                        );
                    }}
                </Await>
            </Suspense>
        </section>
    );
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
const CardapioItemList = ({ allItems }: { allItems: MenuItemWithAssociations[] }) => {
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
function CardapioItemsGrid({ items }: { items: MenuItemWithAssociations[] }) {
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [desktopDialogId, setDesktopDialogId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);

    const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener?.("change", update);
        return () => mq.removeEventListener?.("change", update);
    }, []);

    if (!items?.length) return null;

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
          xl:grid-cols-5
        "
            >
                {items.map((item) => (
                    <CardapioGridItem
                        key={item.id}
                        item={item}
                        isExpanded={expandedItemId === item.id}
                        onClick={() => onCardClick(item.id)}
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
    innerRef
}: {
    item: MenuItemWithAssociations;
    isExpanded: boolean;
    onClick: () => void;
    innerRef?: (el: HTMLLIElement | null) => void;
}) {
    const featuredImage =
        item.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
        item.MenuItemGalleryImage?.[0];

    return (
        <li
            ref={innerRef}
            className={cn(
                "flex flex-col rounded-md border border-transparent",
                "transition-all duration-300 ease-in-out",
                "scroll-mt-24 lg:scroll-mt-0",
                isExpanded ? "col-span-2 lg:col-span-1" : "col-span-1"
            )}
        >
            <div className="flex flex-col" onClick={onClick}>
                <div
                    role="button"
                    aria-label={`Abrir ${item.name}`}
                    className="group overflow-hidden rounded-t-md relative focus:outline-none focus:ring-2 focus:ring-black/20"
                >
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
                            "font-neue text-xs tracking-wide leading-[110%] sm:text-base line-clamp-2 my-1",
                            isExpanded && "text-md line-clamp-none mb-2 leading-[120%]"
                        )}
                    >
                        {item.ingredients}
                    </span>
                </div>
            </div>

            <CardapioItemPriceSelect prices={item.MenuItemSellingPriceVariation} />

            <div className="flex justify-between shadow-sm bg-white">
                <ShareIt
                    item={item}
                    size={isExpanded === true ? 20 : 16}
                    cnContainer={cn("px-2 ", isExpanded && "my-2 border border-black")}
                >
                    {isExpanded && <span className="font-neue text-sm">Compartilhar</span>}
                </ShareIt>

                <LikeIt
                    item={item}
                    size={isExpanded === true ? 20 : 16}
                    cnContainer={cn("px-2 ", isExpanded && "my-2 border border-red-500")}
                >
                    {isExpanded && <span className="font-neue text-sm text-red-500 mr-2">Gostei</span>}
                </LikeIt>
            </div>

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
}

const CardapioItemFullImage = React.forwardRef(
    ({ item }: CardapioItemFullImageProps, ref: any) => {
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
                            <CardapioItemActionBarVertical item={item} />
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
                                                <h4 className="font-neue text-white text-2xl leading-tight drop-shadow">
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
                                                        <h5 className="font-neue text-white text-2xl leading-tight drop-shadow">
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
