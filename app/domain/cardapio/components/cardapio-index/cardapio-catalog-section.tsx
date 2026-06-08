import type { Tag } from "@prisma/client";
import { Link } from "@remix-run/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { LikeIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import type { ThreadSectionProfile } from "~/domain/cardapio/components/section-thread-header/section-thread-header";
import { getOrCreateMenuItemInterestClientId } from "~/domain/cardapio/menu-item-interest/menu-item-interest.client";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import formatMoneyString from "~/utils/format-money-string";
import {
  type CardapioIndexItem,
  getCardapioInterestItemId,
  getCardapioItemHref,
  getGroupedItemsDescription,
  getGroupedItemsList,
  getPrimaryCardapioMedia,
  getVisiblePublicPriceVariations,
  itemHasPublicTag,
  type GroupedItems,
  isGrouped,
} from "~/domain/cardapio/cardapio-index.shared";
import {
  INTEREST_ENDPOINT,
  SECTION_THREAD_PROFILE_BY_SECTION,
} from "./cardapio-index-shared";

export function CardapioCatalogSection({
  items,
  tags,
  interestTrackingEnabled,
  likesEnabled,
  desktopFeedLayout = false,
}: {
  items: CardapioIndexItem[] | GroupedItems[];
  tags: Tag[];
  interestTrackingEnabled: boolean;
  likesEnabled: boolean;
  desktopFeedLayout?: boolean;
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
    ? [...groupedItems].sort(
        (a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0)
      )
    : [];

  const onCurrentTagSelected = useCallback(
    (tag: Tag | null) => {
      setCurrentFilterTag(tag);

      if (!tag || tag.id === "all") {
        setCurrentItems(items);
        return;
      }

      const hasTag = (item: CardapioIndexItem) =>
        itemHasPublicTag(item, tag.name);

      if (isGrouped(items)) {
        const filteredGroups = items
          .map((group) => ({
            ...group,
            items: group.items.filter(hasTag),
          }))
          .filter((group) => group.items.length > 0);

        setCurrentItems(filteredGroups);
        return;
      }

      setCurrentItems(items.filter(hasTag));
    },
    [items]
  );

  return (
    <div
      className={cn(
        "flex flex-col m-4",
        desktopFeedLayout &&
          "md:mx-auto md:my-0 md:w-full md:max-w-[700px] md:px-6 md:py-6"
      )}
    >
      <div className="sticky top-[calc(50px+env(safe-area-inset-top))] z-30 -mx-4 mb-2 bg-white px-4 py-2 md:static md:mx-0 md:mb-4 md:bg-transparent md:px-0 md:py-0">
        <h2 className="hidden font-lora text-2xl font-bold tracking-tight leading-tight mb-3 md:block">
          Sabores da casa
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2 md:gap-y-1">
          <button
            type="button"
            onClick={() => onCurrentTagSelected(null)}
            className={cn(
              "font-neue text-xs font-semibold tracking-widest uppercase transition-colors",
              !currentFilterTag
                ? "text-black underline underline-offset-4"
                : "text-zinc-400 hover:text-black"
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
                currentFilterTag?.id === tag.id
                  ? "text-black underline underline-offset-4"
                  : "text-zinc-400 hover:text-black"
              )}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {orderedGroups.length > 0 ? (
        <div className="fixed left-[72px] right-0 top-[env(safe-area-inset-top)] z-40 flex h-[50px] items-center overflow-x-auto border-b border-gray-200 bg-white pr-3 md:hidden">
          <div className="flex w-max gap-2">
            {orderedGroups.map((group) => (
              <button
                key={group.groupId}
                type="button"
                onClick={() => scrollToGroup(group.groupId)}
                className="whitespace-nowrap rounded-full bg-zinc-950 px-3 py-1 font-neue text-xs uppercase tracking-wider text-white transition hover:bg-zinc-800"
              >
                {group.group}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {orderedGroups.length > 0 ? (
        <div className="mt-1 hidden gap-2 overflow-x-auto pb-2 md:flex">
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
              subtitle={getGroupedItemsDescription(group)}
              profile={SECTION_THREAD_PROFILE_BY_SECTION.chef}
              desktopFeedLayout={desktopFeedLayout}
            />
            <CardapioItemsGrid
              items={getGroupedItemsList(group)}
              interestTrackingEnabled={interestTrackingEnabled}
              likesEnabled={likesEnabled}
              desktopFeedLayout={desktopFeedLayout}
            />
          </section>
        ))
      ) : (
        <CardapioItemsGrid
          items={currentItems as CardapioIndexItem[]}
          interestTrackingEnabled={interestTrackingEnabled}
          likesEnabled={likesEnabled}
          desktopFeedLayout={desktopFeedLayout}
        />
      )}
    </div>
  );
}

function CardapioGroupHeader({
  title,
  subtitle,
  profile,
  desktopFeedLayout = false,
}: {
  title: string;
  subtitle?: string;
  profile: ThreadSectionProfile;
  desktopFeedLayout?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-3 pb-3 border-b",
        desktopFeedLayout && "md:mb-5 md:pb-4"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2",
          desktopFeedLayout && "md:hidden"
        )}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-lora text-lg font-bold tracking-tight leading-tight">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {profile.avatarImageUrl ? (
            <img
              src={profile.avatarImageUrl}
              alt={profile.username}
              className="h-7 w-7 rounded-full object-cover border border-zinc-200"
            />
          ) : null}
          <span className="font-neue text-sm font-semibold">
            {profile.username}
          </span>
        </div>
      </div>

      {subtitle ? (
        <p
          className={cn(
            "font-neue text-sm tracking-wide mt-2 text-zinc-700",
            desktopFeedLayout && "md:hidden"
          )}
        >
          {subtitle}
        </p>
      ) : null}

      <div
        className={cn(
          "hidden items-center gap-2 mt-3 md:flex",
          desktopFeedLayout && "md:hidden"
        )}
      >
        {profile.avatarImageUrl ? (
          <img
            src={profile.avatarImageUrl}
            alt={profile.username}
            className="h-7 w-7 rounded-full object-cover border border-zinc-200"
          />
        ) : null}
        <span className="font-neue text-sm font-semibold">
          {profile.username}
        </span>
      </div>

      {desktopFeedLayout ? (
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-4">
            <h3 className="min-w-0 flex-1 font-lora text-3xl font-bold leading-tight tracking-tight text-zinc-950">
              {title}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              {profile.avatarImageUrl ? (
                <img
                  src={profile.avatarImageUrl}
                  alt={profile.username}
                  className="h-8 w-8 rounded-full border border-zinc-200 object-cover"
                />
              ) : null}
              <span className="font-neue text-base font-semibold text-zinc-950">
                {profile.username}
              </span>
            </div>
          </div>

          {subtitle ? (
            <p className="mt-3 font-neue text-base leading-relaxed tracking-wide text-zinc-600">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CardapioItemsGrid({
  items,
  interestTrackingEnabled,
  likesEnabled,
  desktopFeedLayout = false,
}: {
  items: CardapioIndexItem[];
  interestTrackingEnabled: boolean;
  likesEnabled: boolean;
  desktopFeedLayout?: boolean;
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

  const trackInterest = useCallback(
    (type: "view_list" | "open_detail", item: CardapioIndexItem) => {
      const interestItemId = getCardapioInterestItemId(item);
      if (!interestTrackingEnabled || !interestItemId) return;
      const clientId = getOrCreateMenuItemInterestClientId();

      fetch(INTEREST_ENDPOINT, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          itemId: interestItemId,
          sourceType: "native",
          clientId,
        }),
        keepalive: true,
      }).catch((error) => {
        console.warn("[cardapio] falha ao registrar interesse", error);
      });
    },
    [interestTrackingEnabled]
  );

  const trackViewOnce = useCallback(
    (item: CardapioIndexItem) => {
      const interestItemId = getCardapioInterestItemId(item);
      if (!interestTrackingEnabled) return;
      if (!interestItemId || trackedViewRef.current.has(interestItemId)) return;
      trackedViewRef.current.add(interestItemId);
      trackInterest("view_list", item);
    },
    [interestTrackingEnabled, trackInterest]
  );

  const trackOpenDetailOnce = useCallback(
    (item: CardapioIndexItem) => {
      const interestItemId = getCardapioInterestItemId(item);
      if (!interestTrackingEnabled) return;
      if (!interestItemId || trackedOpenDetailRef.current.has(interestItemId))
        return;
      trackedOpenDetailRef.current.add(interestItemId);
      trackInterest("open_detail", item);
    },
    [interestTrackingEnabled, trackInterest]
  );

  const scrollToItemTop = useCallback((id: string) => {
    const element = itemRefs.current[id];
    if (!element) return;
    const offset = 120;
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const onCardClick = useCallback(
    (id: string) => {
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
    },
    [isDesktop, items, scrollToItemTop, trackOpenDetailOnce]
  );

  if (!items.length) return null;

  return (
    <ul
      className={cn(
        "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4",
        desktopFeedLayout &&
          "md:grid-cols-2 md:gap-5 lg:grid-cols-2 xl:grid-cols-2"
      )}
    >
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
          desktopFeedLayout={desktopFeedLayout}
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
  desktopFeedLayout,
}: {
  item: CardapioIndexItem;
  isExpanded: boolean;
  onClick: () => void;
  onOpenDetail?: () => void;
  onView?: () => void;
  isDesktop: boolean;
  innerRef?: (el: HTMLLIElement | null) => void;
  likesEnabled: boolean;
  desktopFeedLayout: boolean;
}) {
  const localRef = useRef<HTMLLIElement | null>(null);
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);
  const featuredImage = getPrimaryCardapioMedia(item);
  const featuredMediaUrl = featuredImage?.secureUrl || "";
  const featuredMediaPlaceholder =
    featuredImage?.thumbnailUrl || item.imagePlaceholderURL || "";
  const featuredMediaKind =
    featuredImage?.kind === "video" ||
    /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(featuredMediaUrl)
      ? "video"
      : "image";

  const setRefs = useCallback(
    (element: HTMLLIElement | null) => {
      localRef.current = element;
      innerRef?.(element);
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
  const featuredPrice = getFeaturedCatalogPrice(visiblePrices);
  const secondaryPrices = visiblePrices.filter(
    (variation) => variation.id !== featuredPrice?.id
  );

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
          isExpanded ? "h-[220px]" : "h-[160px]",
          desktopFeedLayout && "md:h-[260px]"
        )}
      >
        <CardapioItemImageSingle
          src={featuredMediaUrl}
          kind={featuredMediaKind}
          placeholder={featuredMediaPlaceholder}
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
            aria-label={
              isExpanded
                ? `Abrir mídia de ${item.name} em tela cheia`
                : `Expandir ${item.name}`
            }
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

        {featuredPrice ? (
          <div className="relative mt-auto min-w-0 pb-1">
            <div className="min-w-0">
              <div className="inline-flex max-w-full flex-col rounded-xl bg-white/[0.07] px-3 py-2.5">
                <span className="block truncate font-neue text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-zinc-300">
                  {getCatalogVariationLabel(featuredPrice.label)}
                </span>
                <span className="mt-1.5 block whitespace-nowrap font-neue text-[1.85rem] font-bold leading-none text-white sm:text-[2.15rem]">
                  {formatMoneyString(featuredPrice.priceAmount)}
                </span>
              </div>

              {secondaryPrices.length > 0 ? (
                <div className="mt-2.5 flex flex-col gap-1.5 pr-14">
                  {secondaryPrices.map((variation) => (
                    <div key={variation.id} className="min-w-0">
                      <span className="block truncate font-neue text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-zinc-500">
                        {getCatalogVariationLabel(variation.label)}
                      </span>
                      <span className="mt-0.5 block whitespace-nowrap font-neue text-base font-bold leading-none text-white/80">
                        {formatMoneyString(variation.priceAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {isDesktop ? (
              <Link
                to={getCardapioItemHref(item)}
                className="absolute bottom-[-0.25rem] right-0 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_24px_rgba(0,0,0,0.3)] sm:h-14 sm:w-14"
                aria-label={`Abrir ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDetail?.();
                }}
              >
                <ArrowRight
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  strokeWidth={2.2}
                />
              </Link>
            ) : (
              <button
                type="button"
                className="absolute bottom-[-0.25rem] right-0 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_24px_rgba(0,0,0,0.3)] sm:h-14 sm:w-14"
                aria-label={`Alternar detalhes de ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClick();
                }}
              >
                <ArrowRight
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  strokeWidth={2.2}
                />
              </button>
            )}
          </div>
        ) : null}
      </div>

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

function getFeaturedCatalogPrice(
  variations: Array<{
    id: string;
    isReference?: boolean | null;
  }>
) {
  return (
    variations.find((variation) => variation.isReference) ??
    variations[0] ??
    null
  );
}

function getCatalogVariationLabel(label: string) {
  return label.trim().replace(/^tamanho\s+/i, "");
}
