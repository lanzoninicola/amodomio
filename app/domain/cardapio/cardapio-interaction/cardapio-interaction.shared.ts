export const CARDAPIO_INTERACTION_ENDPOINT = "/api/cardapio-interaction";
export const CARDAPIO_NAVIGATION_EVENT = "cardapio_navigation_click";

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

export type CardapioNavigationControl =
  (typeof CARDAPIO_NAVIGATION_CONTROLS)[number];

export type CardapioNavigationPlacement =
  (typeof CARDAPIO_NAVIGATION_PLACEMENTS)[number];
