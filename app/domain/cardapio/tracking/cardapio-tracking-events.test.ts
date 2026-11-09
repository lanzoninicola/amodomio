import { describe, expect, it } from "vitest";

import {
  BIO_LINK_CLICK_EVENT,
  BIO_PAGE_VIEW_EVENT,
  CARDAPIO_FEATURED_CTA_EVENT,
  CARDAPIO_NAVIGATION_EVENT,
  CARDAPIO_ORDER_INTENT_EVENT,
  parseCardapioTrackingRecord,
} from "./cardapio-tracking-events";

describe("parseCardapioTrackingRecord", () => {
  it("accepts a navigation record with navigation dimensions", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: CARDAPIO_NAVIGATION_EVENT,
        control: "tag",
        value: "vegetariana",
        placement: "mobile_panel",
      })
    ).toEqual({
      eventName: CARDAPIO_NAVIGATION_EVENT,
      control: "tag",
      value: "vegetariana",
      placement: "mobile_panel",
    });
  });

  it("aceita a seleção de linha de produto", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: CARDAPIO_NAVIGATION_EVENT,
        control: "product_line",
        value: "Massa fresca",
        placement: "mobile_header",
      })
    ).toMatchObject({
      control: "product_line",
      value: "Massa fresca",
    });
  });

  it("aceita o clique em uma categoria comercial", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: CARDAPIO_NAVIGATION_EVENT,
        control: "category",
        value: "Especiais da Casa",
        placement: "mobile_header",
      })
    ).toMatchObject({
      control: "category",
      value: "Especiais da Casa",
    });
  });

  it("accepts a featured record with featured dimensions", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: CARDAPIO_FEATURED_CTA_EVENT,
        control: "image_2",
        value: "promocao-junina",
        placement: "desktop_card",
      })
    ).toEqual({
      eventName: CARDAPIO_FEATURED_CTA_EVENT,
      control: "image_2",
      value: "promocao-junina",
      placement: "desktop_card",
    });
  });

  it("accepts an order intent without claiming a completed sale", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: CARDAPIO_ORDER_INTENT_EVENT,
        control: "order_cta",
        value: "fazer_pedido",
        placement: "mobile_footer",
      })
    ).toMatchObject({ eventName: CARDAPIO_ORDER_INTENT_EVENT });
  });

  it("rejects dimensions from a different event family", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: CARDAPIO_NAVIGATION_EVENT,
        control: "image_4",
        value: "promocao-junina",
        placement: "desktop_modal",
      })
    ).toBeNull();
  });

  it("accepts bio page views and link clicks", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: BIO_PAGE_VIEW_EVENT,
        control: "page",
        value: "bio",
        placement: "bio_page",
      })
    ).toMatchObject({ eventName: BIO_PAGE_VIEW_EVENT, control: "page" });

    expect(
      parseCardapioTrackingRecord({
        eventName: BIO_LINK_CLICK_EVENT,
        control: "link",
        value: "instagram",
        placement: "bio_page",
      })
    ).toMatchObject({
      eventName: BIO_LINK_CLICK_EVENT,
      value: "instagram",
    });
  });

  it("rejects mixed bio dimensions", () => {
    expect(
      parseCardapioTrackingRecord({
        eventName: BIO_LINK_CLICK_EVENT,
        control: "tag",
        value: "instagram",
        placement: "mobile_panel",
      })
    ).toBeNull();
  });
});
