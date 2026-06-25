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
      thumbnailUrl: null,
      variants: null,
      width: null,
      height: null,
    });
  });

  it("uses request defaults when the v2 payload omits folder or asset keys", () => {
    const result = parseMediaUploadApiPayload({
      payload: {
        url: "https://media.amodomio.com.br/images/menu-items/item-1/gallery-1.jpg",
      },
      fallbackKind: "image",
      fallbackFolderPath: "menu-items/item-1",
      fallbackAssetKey: "fallback-key",
    });

    expect(result).toEqual({
      ok: true,
      kind: "image",
      folderPath: "menu-items/item-1",
      assetKey: "fallback-key",
      url: "https://media.amodomio.com.br/images/menu-items/item-1/gallery-1.jpg",
      thumbnailUrl: null,
      variants: null,
      width: null,
      height: null,
    });
  });

  it("parses audio payloads", () => {
    const result = parseMediaUploadApiPayload({
      payload: {
        ok: true,
        kind: "audio",
        folderPath: "marketing/audios",
        assetKey: "jingle",
        url: "https://media.amodomio.com.br/audios/marketing/audios/jingle.mp3",
      },
      fallbackKind: "audio",
      fallbackFolderPath: "marketing/audios",
      fallbackAssetKey: "fallback-audio",
    });

    expect(result).toEqual({
      ok: true,
      kind: "audio",
      folderPath: "marketing/audios",
      assetKey: "jingle",
      url: "https://media.amodomio.com.br/audios/marketing/audios/jingle.mp3",
      thumbnailUrl: null,
      variants: null,
      width: null,
      height: null,
    });
  });
});
