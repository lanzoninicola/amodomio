import {
  CARDAPIO_HIGHLIGHT_CTA_EVENT,
  CARDAPIO_HIGHLIGHT_EXPAND_EVENT,
  CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT,
  CARDAPIO_HIGHLIGHT_SLIDE_EVENT,
  CARDAPIO_NAVIGATION_EVENT,
  CARDAPIO_TRACKING_ENDPOINT,
  type CardapioHighlightControl,
  type CardapioHighlightPlacement,
  type CardapioNavigationControl,
  type CardapioNavigationPlacement,
  type CardapioTrackingRecord,
} from "./cardapio-tracking-events";
import { getOrCreateCardapioVisitorId } from "./cardapio-visitor.client";

export function collectCardapioTrackingRecord(record: CardapioTrackingRecord) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...record,
    clientId: getOrCreateCardapioVisitorId(),
    path: `${window.location.pathname}${window.location.search}`,
  });

  if (typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon(
      CARDAPIO_TRACKING_ENDPOINT,
      new Blob([body], { type: "application/json" })
    );
    if (queued) return;
  }

  fetch(CARDAPIO_TRACKING_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Tracking nunca deve interferir na experiência do cardápio.
  });
}

export function trackCardapioNavigation({
  control,
  value,
  placement,
}: {
  control: CardapioNavigationControl;
  value: string;
  placement: CardapioNavigationPlacement;
}) {
  collectCardapioTrackingRecord({
    eventName: CARDAPIO_NAVIGATION_EVENT,
    control,
    value,
    placement,
  });
}

export function trackCardapioHighlight({
  action,
  sectionKey,
  imageIndex,
  placement,
}: {
  action: "impression" | "expand" | "slide_view" | "cta_click";
  sectionKey: string;
  imageIndex?: number;
  placement: CardapioHighlightPlacement;
}) {
  const eventNames = {
    impression: CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT,
    expand: CARDAPIO_HIGHLIGHT_EXPAND_EVENT,
    slide_view: CARDAPIO_HIGHLIGHT_SLIDE_EVENT,
    cta_click: CARDAPIO_HIGHLIGHT_CTA_EVENT,
  } as const;
  const safeImageIndex = Math.max(0, Math.min(imageIndex ?? -1, 9));

  collectCardapioTrackingRecord({
    eventName: eventNames[action],
    control:
      safeImageIndex >= 0
        ? (`image_${safeImageIndex + 1}` as CardapioHighlightControl)
        : "section",
    value: sectionKey,
    placement,
  });
}
