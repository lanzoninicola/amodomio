import { describe, expect, it } from "vitest";
import {
  CARDAPIO_FEATURED_CTA_EVENT,
  CARDAPIO_NAVIGATION_EVENT,
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
});
