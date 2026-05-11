import { FacebookPixelIntegrationMode } from "@prisma/client";
import { useEffect } from "react";
import { useLocation } from "@remix-run/react";

import {
  CARDAPIO_FACEBOOK_PIXEL_TRACK_EVENT,
  type CardapioFacebookPixelTrackDetail,
} from "~/domain/cardapio/facebook-pixel.client";
import type { CardapioFacebookPixelRuntimeConfig } from "~/domain/cardapio/facebook-pixel.server";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const META_STANDARD_EVENTS = new Set([
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "InitiateCheckout",
  "Lead",
  "PageView",
  "Purchase",
  "Schedule",
  "Search",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "ViewContent",
]);

type CardapioFacebookPixelProps = {
  config: CardapioFacebookPixelRuntimeConfig;
};

function injectMetaPixel(pixelId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.fbq) return;

  ((f: any, b: Document, e: string, v: string, n?: any, t?: HTMLScriptElement, s?: Element) => {
    if (f.fbq) return;
    n = f.fbq = function (...args: any[]) {
      if ((n as any).callMethod) {
        (n as any).callMethod.apply(n, args);
      } else {
        (n as any).queue.push(args);
      }
    };
    if (!f._fbq) f._fbq = n;
    (n as any).push = n;
    (n as any).loaded = true;
    (n as any).version = "2.0";
    (n as any).queue = [];
    t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s?.parentNode?.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq?.("init", pixelId);
}

function injectGoogleTagManager(containerId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  if (document.querySelector(`script[data-gtm-container-id="${containerId}"]`)) {
    return;
  }

  window.dataLayer.push({
    "gtm.start": new Date().getTime(),
    event: "gtm.js",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
  script.dataset.gtmContainerId = containerId;
  document.head.appendChild(script);
}

export default function CardapioFacebookPixel({ config }: CardapioFacebookPixelProps) {
  const location = useLocation();
  const enabledEvents = config.events.filter((event) => event.enabled);

  useEffect(() => {
    if (!config.enabled) return;

    if (config.mode === FacebookPixelIntegrationMode.direct && config.pixelId) {
      injectMetaPixel(config.pixelId);
    }

    if (config.mode === FacebookPixelIntegrationMode.gtm && config.gtmContainerId) {
      injectGoogleTagManager(config.gtmContainerId);
    }
  }, [config.enabled, config.gtmContainerId, config.mode, config.pixelId]);

  useEffect(() => {
    if (!config.enabled) return;

    const trackEvent = (trigger: string, payload?: Record<string, unknown>) => {
      const matchingEvents = enabledEvents.filter((event) => event.trigger === trigger);
      if (matchingEvents.length === 0) return;

      matchingEvents.forEach((event) => {
        const mergedPayload = {
          ...(event.payload ?? {}),
          ...(payload ?? {}),
        };

        if (config.mode === FacebookPixelIntegrationMode.direct) {
          if (!window.fbq) return;
          const method = META_STANDARD_EVENTS.has(event.eventName) ? "track" : "trackCustom";
          window.fbq(method, event.eventName, mergedPayload);
          return;
        }

        if (config.mode === FacebookPixelIntegrationMode.gtm) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: trigger,
            metaEventKey: event.eventKey,
            metaEventName: event.eventName,
            metaPayload: mergedPayload,
            locationPath: window.location.pathname,
            locationSearch: window.location.search,
          });
        }
      });
    };

    const handler = (browserEvent: Event) => {
      const customEvent = browserEvent as CustomEvent<CardapioFacebookPixelTrackDetail>;
      const detail = customEvent.detail;
      if (!detail?.trigger) return;
      trackEvent(detail.trigger, detail.payload);
    };

    window.addEventListener(CARDAPIO_FACEBOOK_PIXEL_TRACK_EVENT, handler);
    return () => window.removeEventListener(CARDAPIO_FACEBOOK_PIXEL_TRACK_EVENT, handler);
  }, [config.enabled, config.mode, enabledEvents]);

  useEffect(() => {
    if (!config.enabled) return;

    const path = `${location.pathname}${location.search}`;
    const pageViewPayload = { path };

    const matchingEvents = enabledEvents.filter((event) => event.trigger === "page_view");
    if (matchingEvents.length === 0) return;

    matchingEvents.forEach((event) => {
      const mergedPayload = {
        ...(event.payload ?? {}),
        ...pageViewPayload,
      };

      if (config.mode === FacebookPixelIntegrationMode.direct) {
        if (!window.fbq) return;
        const method = META_STANDARD_EVENTS.has(event.eventName) ? "track" : "trackCustom";
        window.fbq(method, event.eventName, mergedPayload);
        return;
      }

      if (config.mode === FacebookPixelIntegrationMode.gtm) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: event.trigger,
          metaEventKey: event.eventKey,
          metaEventName: event.eventName,
          metaPayload: mergedPayload,
          locationPath: location.pathname,
          locationSearch: location.search,
        });
      }
    });
  }, [config.enabled, config.mode, enabledEvents, location.pathname, location.search]);

  return null;
}
