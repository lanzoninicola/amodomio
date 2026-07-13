import type { Tag } from "@prisma/client";
import { Link } from "@remix-run/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, ListFilter, X } from "lucide-react";
import { LikeIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import type { ThreadSectionProfile } from "~/domain/cardapio/components/section-thread-header/section-thread-header";
import { getOrCreateMenuItemInterestClientId } from "~/domain/cardapio/menu-item-interest/menu-item-interest.client";
import { trackCardapioNavigation } from "~/domain/cardapio/tracking/cardapio-tracking.client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import formatMoneyString from "~/utils/format-money-string";
import {
  type CardapioPublicTag,
  type CardapioIndexItem,
  buildImageSrcSet,
  getCardapioInterestItemId,
  getCardapioItemHref,
  getCardapioPublicTag,
  getCardapioTagName,
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

const MOBILE_CARD_IMAGE_HEIGHTS = [
  "h-[132px]",
  "h-[104px]",
  "h-[176px]",
  "h-[122px]",
  "h-[154px]",
];

function trackFilterClick(
  control: "group" | "filter_toggle" | "tag",
  value: string,
  placement: "mobile_header" | "mobile_panel" | "desktop_nav" | "stories"
) {
  trackCardapioNavigation({
    control,
    value,
    placement,
  });
}

export function CardapioCatalogSection({
  items,
  tags,
  interestTrackingEnabled,
  likesEnabled,
  desktopFeedLayout = false,
  filterViewMode = "chip",
  worldCupBannerEnabled = true,
}: {
  items: CardapioIndexItem[] | GroupedItems[];
  tags: Tag[];
  interestTrackingEnabled: boolean;
  likesEnabled: boolean;
  desktopFeedLayout?: boolean;
  filterViewMode?: "chip" | "stories";
  worldCupBannerEnabled?: boolean;
}) {
  const [currentItems, setCurrentItems] = useState(items);
  const [currentFilterTag, setCurrentFilterTag] = useState<Tag | null>(null);
  const [showMobileTags, setShowMobileTags] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setCurrentItems(items);
    setCurrentFilterTag(null);
  }, [items]);

  const scrollToGroup = useCallback((groupId: string) => {
    const element = groupRefs.current[groupId];
    if (!element) return;

    const offset = window.matchMedia("(min-width: 768px)").matches ? 24 : 110;
    const cardapioScrollRoot = element.closest(
      '[data-element="cardapio-index"]'
    );

    if (cardapioScrollRoot instanceof HTMLElement) {
      const top =
        element.getBoundingClientRect().top -
        cardapioScrollRoot.getBoundingClientRect().top +
        cardapioScrollRoot.scrollTop -
        offset;
      cardapioScrollRoot.scrollTo({ top, behavior: "smooth" });
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const groupedItems = useMemo(
    () => (isGrouped(currentItems) ? currentItems : []),
    [currentItems]
  );
  const orderedGroups = useMemo(
    () =>
      groupedItems.length
        ? [...groupedItems].sort(
          (a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0)
        )
        : [],
    [groupedItems]
  );
  const visibleGroupChips = useMemo(
    () => orderedGroups.filter((g) => g.groupId !== "__sem_grupo__"),
    [orderedGroups]
  );
  const visibleCatalogItems = useMemo(
    () =>
      orderedGroups.length
        ? orderedGroups.flatMap((group) => getGroupedItemsList(group))
        : isGrouped(currentItems)
          ? []
          : (currentItems as CardapioIndexItem[]),
    [currentItems, orderedGroups]
  );
  const visibleActiveItemId =
    activeItemId ?? visibleCatalogItems[0]?.id ?? null;

  useEffect(() => {
    setActiveItemId(visibleCatalogItems[0]?.id ?? null);
  }, [visibleCatalogItems]);

  useEffect(() => {
    if (!visibleCatalogItems.length) return;
    const catalogElement = catalogRef.current;
    if (!catalogElement) return;

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;

    if (!isDesktop) {
      const updateActiveItemFromScroll = () => {
        const rect = catalogElement.getBoundingClientRect();
        const documentElement = document.documentElement;
        const isAtPageBottom =
          window.scrollY + window.innerHeight >= documentElement.scrollHeight - 8;

        if (isAtPageBottom) {
          setActiveItemId(visibleCatalogItems[visibleCatalogItems.length - 1].id);
          return;
        }

        const scrollableCatalogHeight = Math.max(
          1,
          rect.height - window.innerHeight + 160
        );
        const rawProgress = (-rect.top + 96) / scrollableCatalogHeight;
        const progress = Math.max(0, Math.min(1, rawProgress));
        const activeIndex = Math.round(
          progress * (visibleCatalogItems.length - 1)
        );

        setActiveItemId(visibleCatalogItems[activeIndex]?.id ?? null);
      };

      updateActiveItemFromScroll();
      window.addEventListener("scroll", updateActiveItemFromScroll, {
        passive: true,
      });
      window.addEventListener("resize", updateActiveItemFromScroll);

      return () => {
        window.removeEventListener("scroll", updateActiveItemFromScroll);
        window.removeEventListener("resize", updateActiveItemFromScroll);
      };
    }

    if (typeof IntersectionObserver === "undefined") return;

    const visibleItemIds = new Set(visibleCatalogItems.map((item) => item.id));
    const itemElements = Array.from(
      catalogElement.querySelectorAll<HTMLElement>("[data-cardapio-item-id]")
    ).filter((element) =>
      visibleItemIds.has(element.dataset.cardapioItemId ?? "")
    );
    if (!itemElements.length) return;

    const desktopScrollRoot = catalogElement.closest(
      '[data-element="cardapio-index"]'
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            const ratioDiff = b.intersectionRatio - a.intersectionRatio;
            if (ratioDiff !== 0) return ratioDiff;
            return (
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
            );
          })[0];

        const itemId = (visibleEntry?.target as HTMLElement | undefined)
          ?.dataset.cardapioItemId;
        if (itemId) {
          setActiveItemId(itemId);
        }
      },
      {
        root: desktopScrollRoot,
        rootMargin: "-12% 0px -58% 0px",
        threshold: [0, 0.25, 0.5, 0.75],
      }
    );

    itemElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [visibleCatalogItems]);

  const scrollToCatalogItem = useCallback((item: CardapioIndexItem) => {
    const catalogElement = catalogRef.current;
    const element = Array.from(
      catalogElement?.querySelectorAll<HTMLElement>(
        "[data-cardapio-item-id]"
      ) ?? []
    ).find((itemElement) => itemElement.dataset.cardapioItemId === item.id);
    if (!element) return;

    const offset = window.matchMedia("(min-width: 768px)").matches ? 24 : 112;
    const cardapioScrollRoot = element.closest(
      '[data-element="cardapio-index"]'
    );

    if (cardapioScrollRoot instanceof HTMLElement) {
      const top =
        element.getBoundingClientRect().top -
        cardapioScrollRoot.getBoundingClientRect().top +
        cardapioScrollRoot.scrollTop -
        offset;
      cardapioScrollRoot.scrollTo({ top, behavior: "smooth" });
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

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
      ref={catalogRef}
      className={cn(
        "flex flex-col m-4",
        desktopFeedLayout &&
        "md:mx-auto md:my-0 md:w-full md:max-w-[700px] md:px-6 md:py-6"
      )}
    >
      {filterViewMode === "stories" ? (
        <div className="-mx-4 mb-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0">
          <div className="flex w-max min-w-full gap-3">
            <StoryFilter
              label="Todos"
              color="#18181b"
              selected={!currentFilterTag}
              onClick={() => {
                trackFilterClick("tag", "todos", "stories");
                onCurrentTagSelected(null);
              }}
            />
            {tags.map((tag) => (
              <StoryFilter
                key={tag.id}
                label={tag.name}
                color={tag.colorHEX}
                selected={currentFilterTag?.id === tag.id}
                onClick={() => {
                  trackFilterClick("tag", tag.name, "stories");
                  onCurrentTagSelected(tag);
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          id="cardapio-tag-filters"
          className={cn(
            "fixed left-4 right-4 top-[calc(7.25rem+env(safe-area-inset-top))] z-40 mb-2 max-h-[46vh] overflow-y-auto rounded-2xl border border-black/10 bg-white/95 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.2)] backdrop-blur-xl md:static md:mx-0 md:mb-4 md:block md:max-h-none md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
            showMobileTags ? "block" : "hidden"
          )}
        >
          <h2 className="hidden font-lora text-2xl font-bold tracking-tight leading-tight mb-3 md:block">
            Sabores da casa
          </h2>
          <div className="flex flex-wrap gap-2 md:gap-x-4 md:gap-y-1">
            <button
              type="button"
              onClick={() => {
                trackFilterClick(
                  "tag",
                  "todos",
                  showMobileTags ? "mobile_panel" : "desktop_nav"
                );
                onCurrentTagSelected(null);
              }}
              className={cn(
                "rounded-full border px-4 py-2 font-neue text-[13px] font-bold uppercase leading-none tracking-wide shadow-sm transition-colors md:rounded-none md:border-0 md:px-0 md:py-0 md:text-xs md:font-semibold md:leading-normal md:tracking-widest md:shadow-none",
                !currentFilterTag
                  ? "border-zinc-950 bg-zinc-950 text-white md:bg-transparent md:text-black md:underline md:underline-offset-4"
                  : "border-black/10 bg-white text-black active:bg-zinc-100 md:border-0 md:bg-transparent md:text-zinc-400 md:hover:text-black"
              )}
            >
              Todos
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  trackFilterClick(
                    "tag",
                    tag.name,
                    showMobileTags ? "mobile_panel" : "desktop_nav"
                  );
                  onCurrentTagSelected(tag);
                }}
                className={cn(
                  "rounded-full border px-4 py-2 font-neue text-[13px] font-bold uppercase leading-none tracking-wide shadow-sm transition-colors md:rounded-none md:border-0 md:px-0 md:py-0 md:text-xs md:font-semibold md:leading-normal md:tracking-widest md:shadow-none",
                  currentFilterTag?.id === tag.id
                    ? "border-zinc-950 bg-zinc-950 text-white md:bg-transparent md:text-black md:underline md:underline-offset-4"
                    : "border-black/10 bg-white text-black active:bg-zinc-100 md:border-0 md:bg-transparent md:text-zinc-400 md:hover:text-black"
                )}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <div className="sticky bottom-0 -mb-1 mt-3 flex justify-end bg-gradient-to-t from-white/95 via-white/95 to-transparent pt-3 md:hidden">
            <button
              type="button"
              onClick={() => {
                trackFilterClick("filter_toggle", "fechar", "mobile_panel");
                setShowMobileTags(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50  px-3 py-2 font-neue text-[12px] font-bold uppercase leading-none tracking-wide text-zinc-950 shadow-sm transition active:bg-zinc-100"
            >

              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>
        </div>
      )}

      {visibleGroupChips.length > 0 ? (
        <div className="fixed left-0 right-0 top-[calc(1rem+env(safe-area-inset-top))] z-40 flex flex-col md:hidden">
          <div className="flex h-[50px] w-full items-center gap-2 px-4">
            {visibleGroupChips.map((group) => (
              <button
                key={group.groupId}
                type="button"
                onClick={() => {
                  trackFilterClick("group", group.group, "mobile_header");
                  scrollToGroup(group.groupId);
                }}
                className="min-w-0 flex-1 whitespace-nowrap rounded-full border border-black/10 bg-white px-2.5 py-1.5 font-neue text-[13px] font-bold capitalize tracking-wide text-black shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition active:bg-zinc-100"
              >
                {group.group}
              </button>
            ))}
            {filterViewMode === "chip" ? (
              <button
                type="button"
                onClick={() => {
                  trackFilterClick(
                    "filter_toggle",
                    showMobileTags ? "fechar" : "abrir",
                    "mobile_header"
                  );
                  setShowMobileTags((current) => !current);
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-black/10 bg-zinc-950 px-3 py-1.5 font-neue text-[13px] font-bold capitalize tracking-wide text-white shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition active:bg-zinc-800"
                )}
                aria-expanded={showMobileTags}
                aria-controls="cardapio-tag-filters"
              >
                <ListFilter className="h-4 w-4" />
                Filtrar
              </button>
            ) : null}
          </div>
          {worldCupBannerEnabled && (
            <a
              href="https://www.fifa.com/pt/tournaments/mens/worldcup/canadamexicousa2026/teams/brazil/fixtures"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-4 rounded-lg bg-[linear-gradient(90deg,#e1251b,#0072ce,#16a34a)] p-[1.5px] shadow-md"
            >
              <div className="flex items-center justify-between rounded-[7px] bg-white px-3 py-1.5 text-zinc-950">
                <span className="flex items-center gap-2 font-neue text-[11px] font-semibold uppercase tracking-tight leading-none">
                  <img
                    src="/images/world-cup-26/world-cup-ball.webp"
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 rounded-full object-cover"
                    loading="lazy"
                  />
                  Acompanha o Mundial de 2026
                </span>
                <div className="flex items-center gap-x-2 zinc-950 uppercase">
                  <ArrowRight size={16} />
                </div>
              </div>
            </a>
          )}
        </div>
      ) : null}

      {visibleGroupChips.length > 0 ? (
        <div className="mt-1 hidden gap-2 overflow-x-auto pb-2 md:flex">
          {visibleGroupChips.map((group) => (
            <button
              key={group.groupId}
              type="button"
              onClick={() => {
                trackFilterClick("group", group.group, "desktop_nav");
                scrollToGroup(group.groupId);
              }}
              className="whitespace-nowrap px-3 py-1 rounded-full bg-zinc-100 text-xs md:text-sm font-neue uppercase tracking-wider hover:bg-zinc-200 transition"
            >
              {group.group}
            </button>
          ))}
        </div>
      ) : null}

      {visibleCatalogItems.length > 1 ? (
        <CardapioItemPositionRail
          items={visibleCatalogItems}
          activeItemId={visibleActiveItemId}
          onSelect={scrollToCatalogItem}
        />
      ) : null}

      <Separator className="my-4" />

      {orderedGroups.length > 0 ? (
        orderedGroups.map((group) => (
          <section
            key={group.groupId}
            ref={(element) => {
              groupRefs.current[group.groupId] = element;
            }}
            data-group-id={group.groupId}
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

function StoryFilter({
  label,
  color,
  selected,
  onClick,
}: {
  label: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const normalizedLabel = label.toLocaleLowerCase("pt-BR");
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
  const symbol = /veg|salad|verde/.test(normalizedLabel)
    ? "leaf"
    : /doce|sobremesa|chocolate/.test(normalizedLabel)
      ? "sparkle"
      : /picante|apiment/.test(normalizedLabel)
        ? "flame"
        : /nov|destaque|promo/.test(normalizedLabel)
          ? "star"
          : "slice";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center"
    >
      <span
        className={cn(
          "rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px] transition-transform group-active:scale-95",
          selected && "ring-2 ring-zinc-950 ring-offset-2"
        )}
      >
        <span className="block rounded-full bg-white p-[2px]">
          <svg
            viewBox="0 0 64 64"
            role="img"
            aria-label={`Ilustração para ${label}`}
            className="h-14 w-14 rounded-full"
          >
            <rect width="64" height="64" rx="32" fill={color || "#e4e4e7"} />
            <circle cx="21" cy="18" r="13" fill="white" fillOpacity=".18" />
            <circle cx="48" cy="48" r="18" fill="black" fillOpacity=".1" />
            {symbol === "leaf" ? (
              <path
                d="M18 40c18 2 27-9 29-25-17 1-29 8-29 25Zm3-3c7-8 13-12 22-17"
                fill="none"
                stroke="white"
                strokeLinecap="round"
                strokeWidth="3"
              />
            ) : symbol === "sparkle" ? (
              <path
                d="m32 12 4.5 13.5L50 30l-13.5 4.5L32 48l-4.5-13.5L14 30l13.5-4.5L32 12Z"
                fill="white"
                fillOpacity=".9"
              />
            ) : symbol === "flame" ? (
              <path
                d="M34 11c4 11-7 12-2 21 2-5 6-7 8-12 8 12 8 28-7 32-14-2-18-17-8-27 0 8 4 10 6 11-4-12 3-15 3-25Z"
                fill="white"
                fillOpacity=".9"
              />
            ) : symbol === "star" ? (
              <path
                d="m32 11 6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2 6-13Z"
                fill="white"
                fillOpacity=".9"
              />
            ) : (
              <path
                d="M17 43c8-17 19-24 34-25-2 16-9 27-25 33l-9-8Zm5 0 5 4M29 28l3 3m8-7 3 3"
                fill="none"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            )}
            <text
              x="32"
              y="58"
              fill="white"
              fontFamily="Arial, sans-serif"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
            >
              {initials}
            </text>
          </svg>
        </span>
      </span>
      <span
        className={cn(
          "w-full truncate font-neue text-[11px] leading-tight text-zinc-700",
          selected && "font-bold text-black"
        )}
      >
        {label}
      </span>
    </button>
  );
}

function CardapioItemPositionRail({
  items,
  activeItemId,
  onSelect,
}: {
  items: CardapioIndexItem[];
  activeItemId: string | null;
  onSelect: (item: CardapioIndexItem) => void;
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeItemId)
  );
  const mobileVisibleDots = 13;
  const mobileStartIndex = Math.max(
    0,
    Math.min(
      activeIndex - Math.floor(mobileVisibleDots / 2),
      items.length - mobileVisibleDots
    )
  );
  const mobileItems = items
    .map((item, index) => ({ item, index }))
    .slice(mobileStartIndex, mobileStartIndex + mobileVisibleDots);

  const railItems = (showLabels: boolean) => (
    <ol className="flex max-h-[46dvh] flex-col items-end justify-center gap-1.5 overflow-hidden md:max-h-[58vh] md:gap-2">
      {items.map((item, index) => {
        const isActive = activeItemId === item.id;

        return (
          <li key={item.id} className="group flex items-center gap-2 md:gap-3">
            {showLabels ? (
              <span
                className={cn(
                  "pointer-events-none max-w-[12rem] translate-x-1 rounded-full bg-white/95 px-3 py-1 font-neue text-[11px] font-bold uppercase tracking-wide text-zinc-950 opacity-0 shadow-[0_8px_24px_rgba(15,23,42,0.14)] ring-1 ring-black/5 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100",
                  isActive && "text-zinc-950"
                )}
              >
                {index + 1}. {item.name}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex items-center",
                showLabels
                  ? "h-5 w-12 justify-end"
                  : "h-4 w-4 justify-center"
              )}
              aria-label={`Ir para ${item.name}`}
              aria-current={isActive ? "location" : undefined}
            >
              <span
                className={cn(
                  "block rounded-full shadow-[0_1px_5px_rgba(255,255,255,0.75)] transition-all duration-200",
                  showLabels
                    ? isActive
                      ? "h-[3px] w-12 bg-black"
                      : "h-[2px] w-6 bg-zinc-300 group-hover:w-10 group-hover:bg-zinc-600"
                    : isActive
                      ? "h-2.5 w-2.5 bg-black"
                      : "h-1.5 w-1.5 bg-zinc-300/80 group-hover:h-2 group-hover:w-2 group-hover:bg-zinc-500"
                )}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );

  const mobileRailItems = (
    <ol className="flex flex-col items-center justify-center gap-1.5">
      {mobileItems.map(({ item, index }) => {
        const isActive = index === activeIndex;

        return (
          <li key={item.id} className="flex h-4 w-4 items-center justify-center">
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex h-4 w-4 items-center justify-center"
              aria-label={`Ir para ${item.name}`}
              aria-current={isActive ? "location" : undefined}
            >
              <span
                className={cn(
                  "block rounded-full shadow-[0_1px_5px_rgba(255,255,255,0.75)] transition-all duration-200",
                  isActive
                    ? "h-2.5 w-2.5 bg-black"
                    : "h-1.5 w-1.5 bg-zinc-300/80"
                )}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <nav
        className="px-0.5 py-1  md:hidden"
        style={{
          position: "fixed",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2147483647,
        }}
        aria-label="Posição no cardápio"
      >
        {mobileRailItems}
      </nav>
      <nav
        className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:right-8"
        aria-label="Posição no cardápio"
      >
        {railItems(true)}
      </nav>
    </>
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

export function CardapioItemsGrid({
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
  const initialHash =
    typeof window !== "undefined"
      ? window.location.hash.replace("#", "")
      : null;
  const initialExpandedId = initialHash
    ? items.find((item) => item.slug === initialHash || item.id === initialHash)
      ?.id ?? null
    : null;

  const [expandedItemId, setExpandedItemId] = useState<string | null>(
    initialExpandedId
  );
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

  useEffect(() => {
    if (!initialExpandedId) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToItemTop(initialExpandedId));
    });
    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        "mt-4 columns-2 gap-4 md:grid md:grid-cols-3 md:columns-auto md:gap-3 lg:grid-cols-4 xl:grid-cols-4",
        desktopFeedLayout &&
        "md:grid-cols-2 md:gap-5 lg:grid-cols-2 xl:grid-cols-2"
      )}
    >
      {items.map((item, index) => (
        <CardapioGridItem
          key={item.id}
          item={item}
          index={index}
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
  index,
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
  index: number;
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
  const [activeTag, setActiveTag] = useState<CardapioPublicTag | null>(null);
  const featuredImage = getPrimaryCardapioMedia(item);
  const featuredMediaUrl = featuredImage?.secureUrl || "";
  const featuredMediaPlaceholder =
    featuredImage?.thumbnailUrl || item.imagePlaceholderURL || "";
  const featuredMediaKind =
    featuredImage?.kind === "video" ||
      /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(featuredMediaUrl)
      ? "video"
      : "image";
  const featuredMediaSrcSet = buildImageSrcSet(featuredImage?.variants);

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

  const visiblePrices = [...getVisiblePublicPriceVariations(item)].sort(
    (a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0)
  );
  const priceRange = getCatalogPriceRange(visiblePrices);
  const mobileImageHeight =
    MOBILE_CARD_IMAGE_HEIGHTS[index % MOBILE_CARD_IMAGE_HEIGHTS.length];
  const catalogLabel = item.tags?.public?.find(
    (tag) => getCardapioTagName(tag).toLocaleLowerCase("pt-BR") !== "novidade"
  );
  const catalogLabelName = getCardapioTagName(catalogLabel);
  const clickablePublicTags = (item.tags?.public || [])
    .map((tag) => getCardapioPublicTag(tag))
    .filter((tag): tag is CardapioPublicTag =>
      Boolean(tag?.clickable && tag.description?.trim())
    );

  const handleTagDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setActiveTag(null);
  }, []);

  const handlePublicTagClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, tag: CardapioPublicTag) => {
      event.stopPropagation();
      setActiveTag(tag);
    },
    []
  );

  return (
    <li
      ref={setRefs}
      id={item.slug ?? item.id}
      data-cardapio-item-id={item.id}
      className={cn(
        "mb-4 inline-flex w-full break-inside-avoid flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.14)] md:mb-0 md:flex md:rounded-xl md:bg-zinc-900 md:shadow-none",
        "transition-all duration-300 ease-in-out",
        "scroll-mt-24 lg:scroll-mt-0",
        isExpanded ? "md:col-span-2 lg:col-span-1" : "md:col-span-1"
      )}
    >
      <div
        className={cn(
          "relative order-2 mx-4 mb-5 overflow-hidden rounded-[1.35rem] transition-all duration-300 ease-in-out md:order-1 md:m-0 md:w-full md:rounded-none",
          isExpanded
            ? "h-[198px] md:h-[220px]"
            : `${mobileImageHeight} md:h-[160px]`,
          desktopFeedLayout && "md:h-[260px]"
        )}
      >
        <CardapioItemImageSingle
          src={featuredMediaUrl}
          srcSet={featuredMediaSrcSet}
          sizes="(max-width: 640px) calc(50vw - 16px), (max-width: 1024px) calc(33vw - 24px), 320px"
          kind={featuredMediaKind}
          placeholder={featuredMediaPlaceholder}
          placeholderIcon={false}
          cnPlaceholderText="font-lora font-bold leading-none text-white/80"
          cnPlaceholderContainer="from-zinc-900 via-zinc-800 to-zinc-700"
          cnContainer="w-full h-full rounded-[1.35rem] md:rounded-none"
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
          <div className="absolute right-2 top-2 z-10 hidden md:block md:-right-2 md:-top-2">
            <LikeIt
              item={item}
              size={18}
              cnContainer="!h-9 !w-9 rounded-full bg-white/85 !p-0 shadow-[0_8px_22px_rgba(15,23,42,0.16)] backdrop-blur-md hover:bg-white/95 md:!h-[3.5rem] md:!w-[3.5rem] md:rounded-bl-2xl md:rounded-tl-lg md:bg-white/70 md:flex-col md:mx-1"
              cnIcon="h-5 w-5"
              color="red"
              filled
              showCount
              attentionAnimation
            >
              <span className="sr-only">Adorei</span>
            </LikeIt>
          </div>
        ) : null}
      </div>

      <div
        className="order-1 flex flex-1 cursor-pointer flex-col px-4 pb-5 pt-6 md:order-2 md:px-3 md:pb-3 md:pt-2"
        onClick={isDesktop ? undefined : onClick}
        role={isDesktop ? undefined : "button"}
        aria-label={isDesktop ? undefined : `Alternar detalhes de ${item.name}`}
      >
        <div className="mb-2 flex items-center gap-2 md:mb-4">
          <div className="min-w-0 flex-1">
            {catalogLabelName ? (
              <span className="mb-1 block font-neue text-[11px] font-medium uppercase tracking-wide text-zinc-400 md:text-white/50">
                {catalogLabelName}
              </span>
            ) : null}
            <span className="block font-neue text-[17px] font-semibold leading-[1.08] text-zinc-950 md:text-lg md:uppercase md:leading-6 md:text-white">
              {item.name}
            </span>
          </div>
          {likesEnabled ? (
            <div
              className="-mr-1 shrink-0 self-center md:hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <LikeIt
                item={item}
                size={18}
                cnContainer="!h-10 !w-8 bg-transparent !p-0 shadow-none hover:bg-transparent"
                cnIcon="h-5 w-5"
                color="red"
                filled
                showCount
                attentionAnimation
              >
                <span className="sr-only">Adorei</span>
              </LikeIt>
            </div>
          ) : null}
        </div>

        {clickablePublicTags.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {clickablePublicTags.map((tag) => (
              <button
                key={tag.id || tag.name}
                type="button"
                className="inline-flex max-w-full items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-neue text-[10px] font-bold uppercase tracking-wide text-zinc-800 shadow-sm transition-colors active:bg-zinc-100 md:border-white/15 md:bg-white/10 md:text-white md:hover:bg-white/15"
                onClick={(event) => handlePublicTagClick(event, tag)}
              >
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="mb-5 flex-1 space-y-1 md:mb-6">
          {item.baseIngredients ? (
            <p
              className={cn(
                "font-neue text-[11px] leading-snug text-zinc-700 md:text-xs md:leading-tight md:text-white",
                isExpanded ? "line-clamp-none" : "line-clamp-2"
              )}
            >
              <span className="font-semibold">Base</span> ·{" "}
              {item.baseIngredients}
            </p>
          ) : null}

          {item.ingredients ? (
            <p
              className={cn(
                "font-neue text-[12px] leading-snug text-zinc-700 md:text-md md:leading-none md:text-white",
                isExpanded ? "line-clamp-none" : "line-clamp-4"
              )}
            >
              <span className="font-semibold">Recheio</span> ·{" "}
              {item.ingredients}
            </p>
          ) : null}
        </div>

        {priceRange ? (
          <div className="relative mt-auto min-w-0 pb-1">
            <span className="block pr-10 font-neue text-[11px] font-semibold leading-tight text-zinc-950 md:pr-14 md:text-base md:text-white">
              {priceRange.minimum === priceRange.maximum
                ? formatMoneyString(priceRange.minimum)
                : `De ${formatMoneyString(
                  priceRange.minimum
                )} a ${formatMoneyString(priceRange.maximum)}`}
            </span>

            {isDesktop ? (
              <Link
                to={getCardapioItemHref(item)}
                className="absolute bottom-[-0.25rem] -right-1 flex h-12 w-12 flex-shrink-0 items-center justify-center text-white sm:h-14 sm:w-14"
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
                className="absolute bottom-[-0.55rem] -right-2 flex h-11 w-11 flex-shrink-0 items-center justify-center bg-transparent text-zinc-950 sm:h-12 sm:w-12 md:bottom-[-0.25rem] md:-right-1 md:h-12 md:w-12 lg:h-14 lg:w-14"
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

        {!isDesktop && isExpanded && visiblePrices.length > 0 ? (
          <div className="mt-4 border-t border-black/10 pt-3 md:border-white/20">
            <div className="grid grid-cols-2 gap-2">
              {visiblePrices.map((variation) => (
                <div
                  key={variation.id}
                  className="flex min-h-16 flex-col justify-between gap-1 rounded-2xl border border-black/10 bg-white p-2.5 font-neue shadow-sm"
                >
                  <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-600">
                    {variation.label}
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold leading-none text-zinc-950">
                    {formatMoneyString(variation.priceAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={Boolean(activeTag)}
        onOpenChange={handleTagDialogOpenChange}
      >
        <DialogContent
          className="max-w-[calc(100vw-2rem)] rounded-2xl border-0 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:max-w-md"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="font-lora text-2xl leading-tight text-zinc-950">
              {activeTag?.name}
            </DialogTitle>
            <DialogDescription className="font-neue text-sm leading-relaxed text-zinc-700">
              {activeTag?.description}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

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
              loading="lazy"
              decoding="async"
              className="max-h-[100dvh] w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
      ) : null}
    </li>
  );
}

function getCatalogPriceRange(variations: Array<{ priceAmount: number }>) {
  if (!variations.length) return null;

  const prices = variations.map((variation) => variation.priceAmount);
  return {
    minimum: Math.min(...prices),
    maximum: Math.max(...prices),
  };
}
