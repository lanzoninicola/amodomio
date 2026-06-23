export const CARDAPIO_TRACKING_ENDPOINT = "/api/cardapio-interaction";

export const CARDAPIO_NAVIGATION_EVENT = "cardapio_navigation_click";
export const CARDAPIO_FEATURED_IMPRESSION_EVENT =
  "cardapio_highlight_impression";
export const CARDAPIO_FEATURED_EXPAND_EVENT = "cardapio_highlight_expand";
export const CARDAPIO_FEATURED_SLIDE_EVENT = "cardapio_highlight_slide_view";
export const CARDAPIO_FEATURED_CTA_EVENT = "cardapio_highlight_cta_click";

export const CARDAPIO_NAVIGATION_CONTROLS = [
  "group",
  "filter_toggle",
  "tag",
] as const;

export const CARDAPIO_NAVIGATION_PLACEMENTS = [
  "mobile_header",
  "mobile_panel",
  "desktop_nav",
  "stories",
] as const;

export const CARDAPIO_FEATURED_CONTROLS = [
  "section",
  "image_1",
  "image_2",
  "image_3",
  "image_4",
  "image_5",
  "image_6",
  "image_7",
  "image_8",
  "image_9",
  "image_10",
] as const;

export const CARDAPIO_FEATURED_PLACEMENTS = [
  "mobile_card",
  "mobile_modal",
  "desktop_card",
  "desktop_modal",
] as const;

export const CARDAPIO_FEATURED_EVENTS = [
  CARDAPIO_FEATURED_IMPRESSION_EVENT,
  CARDAPIO_FEATURED_EXPAND_EVENT,
  CARDAPIO_FEATURED_SLIDE_EVENT,
  CARDAPIO_FEATURED_CTA_EVENT,
] as const;

export type CardapioNavigationControl =
  (typeof CARDAPIO_NAVIGATION_CONTROLS)[number];
export type CardapioNavigationPlacement =
  (typeof CARDAPIO_NAVIGATION_PLACEMENTS)[number];
export type CardapioFeaturedControl =
  (typeof CARDAPIO_FEATURED_CONTROLS)[number];
export type CardapioFeaturedPlacement =
  (typeof CARDAPIO_FEATURED_PLACEMENTS)[number];
export type CardapioFeaturedEventName =
  (typeof CARDAPIO_FEATURED_EVENTS)[number];

export type CardapioNavigationTrackingRecord = {
  eventName: typeof CARDAPIO_NAVIGATION_EVENT;
  control: CardapioNavigationControl;
  value: string;
  placement: CardapioNavigationPlacement;
};

export type CardapioFeaturedTrackingRecord = {
  eventName: CardapioFeaturedEventName;
  control: CardapioFeaturedControl;
  value: string;
  placement: CardapioFeaturedPlacement;
};

export type CardapioTrackingRecord =
  | CardapioNavigationTrackingRecord
  | CardapioFeaturedTrackingRecord;

const navigationControls = new Set<string>(CARDAPIO_NAVIGATION_CONTROLS);
const navigationPlacements = new Set<string>(CARDAPIO_NAVIGATION_PLACEMENTS);
const featuredEvents = new Set<string>(CARDAPIO_FEATURED_EVENTS);
const featuredControls = new Set<string>(CARDAPIO_FEATURED_CONTROLS);
const featuredPlacements = new Set<string>(CARDAPIO_FEATURED_PLACEMENTS);

const normalizeString = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export function parseCardapioTrackingRecord(
  payload: unknown
): CardapioTrackingRecord | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  const eventName = normalizeString(data.eventName, 64);
  const control = normalizeString(data.control, 32);
  const value = normalizeString(data.value, 120);
  const placement = normalizeString(data.placement, 32);

  if (!value) return null;

  if (
    eventName === CARDAPIO_NAVIGATION_EVENT &&
    navigationControls.has(control) &&
    navigationPlacements.has(placement)
  ) {
    return {
      eventName,
      control: control as CardapioNavigationControl,
      value,
      placement: placement as CardapioNavigationPlacement,
    };
  }

  if (
    featuredEvents.has(eventName) &&
    featuredControls.has(control) &&
    featuredPlacements.has(placement)
  ) {
    return {
      eventName: eventName as CardapioFeaturedEventName,
      control: control as CardapioFeaturedControl,
      value,
      placement: placement as CardapioFeaturedPlacement,
    };
  }

  return null;
}

// Compatibilidade com integrações que ainda importam os nomes anteriores.
export const CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT =
  CARDAPIO_FEATURED_IMPRESSION_EVENT;
export const CARDAPIO_HIGHLIGHT_EXPAND_EVENT = CARDAPIO_FEATURED_EXPAND_EVENT;
export const CARDAPIO_HIGHLIGHT_SLIDE_EVENT = CARDAPIO_FEATURED_SLIDE_EVENT;
export const CARDAPIO_HIGHLIGHT_CTA_EVENT = CARDAPIO_FEATURED_CTA_EVENT;
export const CARDAPIO_HIGHLIGHT_CONTROLS = CARDAPIO_FEATURED_CONTROLS;
export const CARDAPIO_HIGHLIGHT_PLACEMENTS = CARDAPIO_FEATURED_PLACEMENTS;
export const CARDAPIO_HIGHLIGHT_EVENTS = CARDAPIO_FEATURED_EVENTS;
export type CardapioHighlightControl = CardapioFeaturedControl;
export type CardapioHighlightPlacement = CardapioFeaturedPlacement;
export type CardapioHighlightEventName = CardapioFeaturedEventName;
export type CardapioHighlightTrackingRecord = CardapioFeaturedTrackingRecord;
