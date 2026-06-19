import { getOrCreateMenuItemInterestClientId } from "~/domain/cardapio/menu-item-interest/menu-item-interest.client";
import {
  CARDAPIO_INTERACTION_ENDPOINT,
  CARDAPIO_NAVIGATION_EVENT,
  type CardapioNavigationControl,
  type CardapioNavigationPlacement,
} from "./cardapio-interaction.shared";

export function trackCardapioNavigation({
  control,
  value,
  placement,
}: {
  control: CardapioNavigationControl;
  value: string;
  placement: CardapioNavigationPlacement;
}) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    eventName: CARDAPIO_NAVIGATION_EVENT,
    control,
    value,
    placement,
    clientId: getOrCreateMenuItemInterestClientId(),
    path: `${window.location.pathname}${window.location.search}`,
  });

  if (typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon(
      CARDAPIO_INTERACTION_ENDPOINT,
      new Blob([body], { type: "application/json" })
    );
    if (queued) return;
  }

  fetch(CARDAPIO_INTERACTION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Telemetria nunca deve interferir na navegação do cardápio.
  });
}
