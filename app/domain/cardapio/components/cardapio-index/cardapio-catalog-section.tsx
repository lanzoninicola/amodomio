import type { Tag } from "@prisma/client";
import { Link } from "@remix-run/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { LikeIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import type { ThreadSectionProfile } from "~/domain/cardapio/components/section-thread-header/section-thread-header";
import { getOrCreateMenuItemInterestClientId } from "~/domain/cardapio/menu-item-interest/menu-item-interest.client";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import formatMoneyString from "~/utils/format-money-string";
import {
    type CardapioIndexItem,
    getCardapioInterestItemId,
    getCardapioItemHref,
    getVisiblePublicPriceVariations,
    itemHasPublicTag,
    type GroupedItems,
    isGrouped,
} from "~/domain/cardapio/cardapio-index.shared";
import { INTEREST_ENDPOINT, SECTION_THREAD_PROFILE_BY_SECTION } from "./cardapio-index-shared";

export function CardapioCatalogSection({
    items,
    tags,
    interestTrackingEnabled,
    likesEnabled,
}: {
    items: CardapioIndexItem[] | GroupedItems[];
    tags: Tag[];
    interestTrackingEnabled: boolean;
    likesEnabled: boolean;
}) {
    const [currentItems, setCurrentItems] = useState(items);
    const [currentFilterTag, setCurrentFilterTag] = useState<Tag | null>(null);
    const groupRefs = useRef<Record<string, HTMLElement | null>>({});

    useEffect(() => {
        setCurrentItems(items);
        setCurrentFilterTag(null);
    }, [items]);

    const scrollToGroup = useCallback((groupId: string) => {
        const element = groupRefs.current[groupId];
        if (!element) return;
        const offset = 110;
        const top = element.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
    }, []);

    const groupedItems = isGrouped(currentItems) ? currentItems : [];
    const orderedGroups = groupedItems.length
        ? [...groupedItems].sort((a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0))
        : [];

    const onCurrentTagSelected = useCallback((tag: Tag | null) => {
        setCurrentFilterTag(tag);

        if (!tag || tag.id === "all") {
            setCurrentItems(items);
            return;
        }

        const hasTag = (item: CardapioIndexItem) => itemHasPublicTag(item, tag.name);

        if (isGrouped(items)) {
            const filteredGroups = items
                .map((group) => ({
                    ...group,
                    menuItems: group.menuItems.filter(hasTag),
                }))
                .filter((group) => group.menuItems.length > 0);

            setCurrentItems(filteredGroups);
            return;
        }

        setCurrentItems(items.filter(hasTag));
    }, [items]);

    return (
        <div className="flex flex-col m-4">
            <div className="mb-4">
                <h2 className="font-lora text-2xl font-bold tracking-tight leading-tight mb-3">
                    Sabores da casa
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <button
                        type="button"
                        onClick={() => onCurrentTagSelected(null)}
                        className={cn(
                            "font-neue text-xs font-semibold tracking-widest uppercase transition-colors",
                            !currentFilterTag ? "text-black underline underline-offset-4" : "text-zinc-400 hover:text-black"
                        )}
                    >
                        Todos
                    </button>
                    {tags.map((tag) => (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => onCurrentTagSelected(tag)}
                            className={cn(
                                "font-neue text-xs font-semibold tracking-widest uppercase transition-colors",
                                currentFilterTag?.id === tag.id ? "text-black underline underline-offset-4" : "text-zinc-400 hover:text-black"
                            )}
                        >
                            {tag.name}
                        </button>
                    ))}
                </div>
            </div>

            {orderedGroups.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-2 mt-1 no-scrollbar">
                    {orderedGroups.map((group) => (
                        <button
                            key={group.groupId}
                            type="button"
                            onClick={() => scrollToGroup(group.groupId)}
                            className="whitespace-nowrap px-3 py-1 rounded-full bg-zinc-100 text-xs md:text-sm font-neue uppercase tracking-wider hover:bg-zinc-200 transition"
                        >
                            {group.group}
                        </button>
                    ))}
                </div>
            ) : null}

            <Separator className="my-4" />

            {orderedGroups.length > 0 ? (
                orderedGroups.map((group) => (
                    <section
                        key={group.groupId}
                        ref={(element) => {
                            groupRefs.current[group.groupId] = element;
                        }}
                        className="mb-6 scroll-mt-28"
                    >
                        <CardapioGroupHeader
                            title={group.group}
                            subtitle={
                                group.description?.trim() ||
                                group.menuItems?.[0]?.MenuItemGroup?.description?.trim() ||
                                ""
                            }
                            profile={SECTION_THREAD_PROFILE_BY_SECTION.chef}
                        />
                        <CardapioItemsGrid
                            items={group.menuItems}
                            interestTrackingEnabled={interestTrackingEnabled}
                            likesEnabled={likesEnabled}
                        />
                    </section>
                ))
            ) : (
                <CardapioItemsGrid
                    items={currentItems as CardapioIndexItem[]}
                    interestTrackingEnabled={interestTrackingEnabled}
                    likesEnabled={likesEnabled}
                />
            )}
        </div>
    );
}

function CardapioGroupHeader({
    title,
    subtitle,
    profile,
}: {
    title: string;
    subtitle?: string;
    profile: ThreadSectionProfile;
}) {
    return (
        <div className="mb-3 pb-3 border-b">
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-lora text-lg font-bold tracking-tight leading-tight">{title}</h3>
                </div>
            </div>

            {subtitle ? <p className="font-neue text-sm tracking-wide mt-2 text-zinc-700">{subtitle}</p> : null}

            <div className="flex items-center gap-2 mt-3">
                {profile.avatarImageUrl ? (
                    <img
                        src={profile.avatarImageUrl}
                        alt={profile.username}
                        className="h-7 w-7 rounded-full object-cover border border-zinc-200"
                    />
                ) : null}
                <span className="font-neue text-sm font-semibold">{profile.username}</span>
            </div>
        </div>
    );
}

function CardapioItemsGrid({
    items,
    interestTrackingEnabled,
    likesEnabled,
}: {
    items: CardapioIndexItem[];
    interestTrackingEnabled: boolean;
    likesEnabled: boolean;
}) {
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
    const trackedViewRef = useRef<Set<string>>(new Set());
    const trackedOpenDetailRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 1024px)");
        const update = () => setIsDesktop(mediaQuery.matches);
        update();
        mediaQuery.addEventListener?.("change", update);
        return () => mediaQuery.removeEventListener?.("change", update);
    }, []);

    const trackInterest = useCallback((type: "view_list" | "open_detail", item: CardapioIndexItem) => {
        const interestItemId = getCardapioInterestItemId(item);
        if (!interestTrackingEnabled || !interestItemId) return;
        const clientId = getOrCreateMenuItemInterestClientId();

        fetch(INTEREST_ENDPOINT, {
            method: "post",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ type, itemId: interestItemId, sourceType: "native", clientId }),
            keepalive: true,
        }).catch((error) => {
            console.warn("[cardapio] falha ao registrar interesse", error);
        });
    }, [interestTrackingEnabled]);

    const trackViewOnce = useCallback((item: CardapioIndexItem) => {
        const interestItemId = getCardapioInterestItemId(item);
        if (!interestTrackingEnabled) return;
        if (!interestItemId || trackedViewRef.current.has(interestItemId)) return;
        trackedViewRef.current.add(interestItemId);
        trackInterest("view_list", item);
    }, [interestTrackingEnabled, trackInterest]);

    const trackOpenDetailOnce = useCallback((item: CardapioIndexItem) => {
        const interestItemId = getCardapioInterestItemId(item);
        if (!interestTrackingEnabled) return;
        if (!interestItemId || trackedOpenDetailRef.current.has(interestItemId)) return;
        trackedOpenDetailRef.current.add(interestItemId);
        trackInterest("open_detail", item);
    }, [interestTrackingEnabled, trackInterest]);

    const scrollToItemTop = useCallback((id: string) => {
        const element = itemRefs.current[id];
        if (!element) return;
        const offset = 120;
        const top = element.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
    }, []);

    const onCardClick = useCallback((id: string) => {
        if (isDesktop) return;

        setExpandedItemId((current) => {
            const willExpand = current !== id;
            const next = willExpand ? id : null;

            if (willExpand) {
                const selectedItem = items.find((item) => item.id === id);
                if (selectedItem) {
                    trackOpenDetailOnce(selectedItem);
                }
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => scrollToItemTop(id));
                });
            }

            return next;
        });
    }, [isDesktop, items, scrollToItemTop, trackOpenDetailOnce]);

    if (!items.length) return null;

    return (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {items.map((item) => (
                <CardapioGridItem
                    key={item.id}
                    item={item}
                    isExpanded={expandedItemId === item.id}
                    onClick={() => onCardClick(item.id)}
                    onOpenDetail={() => trackOpenDetailOnce(item)}
                    onView={() => trackViewOnce(item)}
                    isDesktop={isDesktop}
                    likesEnabled={likesEnabled}
                    innerRef={(element) => {
                        itemRefs.current[item.id] = element;
                    }}
                />
            ))}
        </ul>
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
}: {
    item: CardapioIndexItem;
    isExpanded: boolean;
    onClick: () => void;
    onOpenDetail?: () => void;
    onView?: () => void;
    isDesktop: boolean;
    innerRef?: (el: HTMLLIElement | null) => void;
    likesEnabled: boolean;
}) {
    const localRef = useRef<HTMLLIElement | null>(null);
    const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);
    const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
    const featuredImage =
        item.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
        item.MenuItemGalleryImage?.[0];
    const featuredMediaUrl = featuredImage?.secureUrl || "";
    const featuredMediaKind =
        featuredImage?.kind === "video" ||
            /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(featuredMediaUrl)
            ? "video"
            : "image";

    const setRefs = useCallback((element: HTMLLIElement | null) => {
        localRef.current = element;
        innerRef?.(element);
    }, [innerRef]);

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

    useEffect(() => {
        if (!isMediaFullscreen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMediaFullscreen]);

    const handleMobileMediaClick = useCallback(() => {
        if (!isExpanded) {
            onClick();
            return;
        }
        setIsMediaFullscreen(true);
    }, [isExpanded, onClick]);

    const visiblePrices = getVisiblePublicPriceVariations(item);
    const firstPrice = visiblePrices[0];
    const hasMultiplePrices = visiblePrices.length > 1;

    return (
        <li
            ref={setRefs}
            className={cn(
                "flex flex-col rounded-xl overflow-hidden bg-zinc-900",
                "transition-all duration-300 ease-in-out",
                "scroll-mt-24 lg:scroll-mt-0",
                isExpanded ? "col-span-2 lg:col-span-1" : "col-span-1"
            )}
        >
            <div
                className={cn(
                    "relative overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "h-[220px]" : "h-[160px]"
                )}
            >
                <CardapioItemImageSingle
                    src={featuredImage?.secureUrl || ""}
                    placeholder={item.imagePlaceholderURL || ""}
                    placeholderIcon={false}
                    cnPlaceholderText="font-lora font-bold leading-none text-white/80"
                    cnPlaceholderContainer="from-zinc-900 via-zinc-800 to-zinc-700"
                    cnContainer="w-full h-full"
                    enableOverlay={false}
                />

                {!isDesktop ? (
                    <div
                        className="absolute inset-0 z-0"
                        role="button"
                        aria-label={isExpanded ? `Abrir mídia de ${item.name} em tela cheia` : `Expandir ${item.name}`}
                        onClick={handleMobileMediaClick}
                    />
                ) : null}

                {likesEnabled ? (
                    <div className="absolute -top-2 -right-2 z-10">
                        <LikeIt
                            item={item}
                            size={22}
                            cnContainer="w-16 h-16 rounded-full bg-white hover:bg-white/90 flex-col items-center justify-center gap-1 p-0"
                            color="red"
                            filled
                        >
                            <span className="font-neue text-[10px] uppercase tracking-wide text-red-500 leading-tight">
                                Adorei
                            </span>
                        </LikeIt>
                    </div>
                ) : null}
            </div>

            <div
                className="flex flex-col flex-1 px-3 pt-2 pb-3 cursor-pointer"
                onClick={isDesktop ? undefined : onClick}
                role={isDesktop ? undefined : "button"}
                aria-label={isDesktop ? undefined : `Alternar detalhes de ${item.name}`}
            >
                <span className="font-neue text-md font-semibold uppercase text-white mb-4 leading-5">
                    {item.name}
                </span>

                <div className="flex-1 mb-6">
                    <span className="font-lora text-md text-white leading-none">
                        {item.ingredients}
                    </span>
                </div>

                {firstPrice ? (
                    <div className="flex items-center justify-between mt-auto">
                        {!isDesktop && hasMultiplePrices ? (
                            <button
                                type="button"
                                className="text-left"
                                aria-label={`Ver outros tamanhos de ${item.name}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setIsPriceDialogOpen(true);
                                }}
                            >
                                <span className="block font-neue text-[10px] uppercase tracking-widest text-zinc-500">
                                    {firstPrice.label}
                                </span>
                                <span className="font-neue font-bold text-xl text-white leading-tight">
                                    {formatMoneyString(firstPrice.priceAmount)}
                                </span>
                            </button>
                        ) : (
                            <div>
                                <span className="block font-neue text-[10px] uppercase tracking-widest text-zinc-500">
                                    {firstPrice.label}
                                </span>
                                <span className="font-neue font-bold text-xl text-white leading-tight">
                                    {formatMoneyString(firstPrice.priceAmount)}
                                </span>
                            </div>
                        )}

                        {isDesktop ? (
                            <Link
                                to={getCardapioItemHref(item)}
                                className="h-9 w-9 rounded-full bg-white flex items-center justify-center flex-shrink-0"
                                aria-label={`Abrir ${item.name}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onOpenDetail?.();
                                }}
                            >
                                <ChevronRight className="h-5 w-5 text-black" />
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="h-9 w-9 rounded-full bg-white flex items-center justify-center flex-shrink-0"
                                aria-label={`Alternar detalhes de ${item.name}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onClick();
                                }}
                            >
                                <ChevronRight className="h-5 w-5 text-black" />
                            </button>
                        )}
                    </div>
                ) : null}
            </div>

            {!isDesktop ? (
                <CardapioItemPriceDialog
                    item={item}
                    featuredImageUrl={featuredImage?.secureUrl || ""}
                    open={isPriceDialogOpen}
                    onOpenChange={setIsPriceDialogOpen}
                />
            ) : null}

            {!isDesktop && isMediaFullscreen ? (
                <div
                    className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95"
                    onClick={() => setIsMediaFullscreen(false)}
                    role="button"
                    aria-label={`Fechar mídia de ${item.name}`}
                >
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsMediaFullscreen(false);
                        }}
                        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white"
                        aria-label="Fechar"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {!featuredMediaUrl ? (
                        <div
                            className="flex flex-col items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950 px-6 text-center w-full h-full"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <span className="font-lora text-8xl font-bold leading-none text-white/80">
                                {item.name?.charAt(0).toUpperCase() ?? "?"}
                            </span>
                            <span className="mt-3 font-neue text-sm uppercase tracking-[0.2em] text-white/40">
                                {item.name}
                            </span>
                        </div>
                    ) : featuredMediaKind === "video" ? (
                        <video
                            src={featuredMediaUrl}
                            className="max-h-[100dvh] w-full object-contain"
                            autoPlay
                            muted
                            playsInline
                            onClick={(event) => event.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={featuredMediaUrl}
                            alt={item.name}
                            className="max-h-[100dvh] w-full object-contain"
                            onClick={(event) => event.stopPropagation()}
                        />
                    )}
                </div>
            ) : null}
        </li>
    );
}

function CardapioItemPriceDialog({
    item,
    featuredImageUrl,
    open,
    onOpenChange,
}: {
    item: CardapioIndexItem;
    featuredImageUrl: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const variations = getVisiblePublicPriceVariations(item);
    const itemInitial = item.name?.charAt(0).toUpperCase() ?? "?";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-[1.25rem] border-none bg-transparent p-0 shadow-none sm:max-w-sm [&>button]:rounded-full [&>button]:bg-black/60 [&>button]:text-white [&>button]:opacity-100 [&>button]:ring-0 [&>button]:ring-offset-0">
                <DialogTitle className="sr-only">Outros tamanhos de {item.name}</DialogTitle>

                <div className="overflow-hidden rounded-[1.25rem] bg-zinc-900 text-white">
                    <div className="relative h-[170px] overflow-hidden">
                        {featuredImageUrl ? (
                            <CardapioItemImageSingle
                                src={featuredImageUrl}
                                placeholder={item.imagePlaceholderURL || ""}
                                placeholderIcon={false}
                                cnPlaceholderText="font-lora font-semibold text-white/80"
                                cnPlaceholderContainer="from-zinc-900 via-zinc-900 to-zinc-800"
                                cnContainer="w-full h-full"
                                enableOverlay={false}
                            />
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950 px-6 text-center">
                                <span className="font-lora text-6xl font-bold leading-none text-white/80">
                                    {itemInitial}
                                </span>
                                <span className="mt-3 font-neue text-[10px] uppercase tracking-[0.2em] text-white/40">
                                    {item.name}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="px-4 pb-5 pt-4">
                        <div className="mb-4">
                            <p className="font-neue text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                                Tamanhos
                            </p>
                            <h3 className="mt-2 font-neue text-lg font-semibold uppercase leading-tight">
                                {item.name}
                            </h3>
                        </div>

                        <div className="space-y-2">
                            {variations.map((variation) => (
                                <div
                                    key={variation.id}
                                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                                >
                                    <span className="font-neue text-sm uppercase tracking-wide text-zinc-200">
                                        {variation.label}
                                    </span>
                                    <span className="font-neue text-base font-bold leading-none text-white">
                                        {formatMoneyString(variation.priceAmount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
