export const CARDAPIO_FACEBOOK_PIXEL_TRACK_EVENT = "cardapio-facebook-pixel-track";

export type CardapioFacebookPixelTrackDetail = {
  trigger: string;
  payload?: Record<string, unknown>;
};

export function trackCardapioFacebookPixelTrigger(
  trigger: string,
  payload?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CardapioFacebookPixelTrackDetail>(CARDAPIO_FACEBOOK_PIXEL_TRACK_EVENT, {
      detail: { trigger, payload },
    })
  );
}
