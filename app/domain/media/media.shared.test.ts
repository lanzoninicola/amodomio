import { describe, expect, it } from "vitest";
import { parseMediaUploadApiPayload } from "./media.shared";

describe("parseMediaUploadApiPayload", () => {
  it("parses v2 payload without legacy fields", () => {
    const result = parseMediaUploadApiPayload({
      payload: {
        ok: true,
        kind: "image",
        folderPath: "menu-items/item-1",
        assetKey: "cover-main",
        url: "https://media.amodomio.com.br/images/menu-items/item-1/cover-main.jpg",
      },
      fallbackKind: "image",
      fallbackFolderPath: "menu-items/item-1",
      fallbackAssetKey: "fallback",
    });

    expect(result).toEqual({
      ok: true,
      kind: "image",
      folderPath: "menu-items/item-1",
      assetKey: "cover-main",
      url: "https://media.amodomio.com.br/images/menu-items/item-1/cover-main.jpg",
    });
  });

  it("keeps compatibility with legacy payload keys", () => {
    const result = parseMediaUploadApiPayload({
      payload: {
        url: "https://media.amodomio.com.br/images/menu-items/item-1/gallery-1.jpg",
        menuItemId: "menu-items/item-1",
        slot: "gallery-1",
      },
      fallbackKind: "image",
      fallbackFolderPath: "menu-items/item-1",
      fallbackAssetKey: "fallback-key",
    });

    expect(result).toEqual({
      ok: true,
      kind: "image",
      folderPath: "menu-items/item-1",
      assetKey: "gallery-1",
      url: "https://media.amodomio.com.br/images/menu-items/item-1/gallery-1.jpg",
    });
  });
});
