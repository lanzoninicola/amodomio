import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkMediaApiHealth, uploadFileToMediaApi } from "./media.service.server";

function makeFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  return Object.assign(blob, { name: fileName }) as unknown as File;
}

describe("uploadFileToMediaApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.MEDIA_API_BASE_URL = "https://media-api.example.com";
    process.env.MEDIA_UPLOAD_API_KEY = "test-key";
  });

  it("uploads image using /v2/upload without fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          kind: "image",
          folderPath: "menu-items/item-1",
          assetKey: "cover",
          url: "https://media.example.com/images/menu-items/item-1/cover.jpg",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadFileToMediaApi({
      file: makeFile("image", "cover.jpg", "image/jpeg"),
      kind: "image",
      folderPath: "menu-items/item-1",
      assetKey: "cover",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.endpoint).toBe("v2");
    expect(result.data.url).toContain("/cover.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v2/upload");
  });

  it("uploads video using /v2/upload response without menuItemId/slot", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          kind: "video",
          folderPath: "menu-items/item-2",
          assetKey: "video-main",
          url: "https://media.example.com/videos/menu-items/item-2/video-main.mp4",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadFileToMediaApi({
      file: makeFile("video", "main.mp4", "video/mp4"),
      kind: "video",
      folderPath: "menu-items/item-2",
      assetKey: "video-main",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.endpoint).toBe("v2");
    expect(result.data.assetKey).toBe("video-main");
    expect(result.data.folderPath).toBe("menu-items/item-2");
  });

  it("falls back to legacy /upload when /v2/upload returns 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: "not_found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            url: "https://media.example.com/images/menu-items/item-3/gallery-1.jpg",
            menuItemId: "menu-items/item-3",
            slot: "gallery-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadFileToMediaApi({
      file: makeFile("image", "gallery.jpg", "image/jpeg"),
      kind: "image",
      folderPath: "menu-items/item-3",
      assetKey: "gallery-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.endpoint).toBe("legacy");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v2/upload");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/upload");
    expect(String(fetchMock.mock.calls[1][0])).toContain("folderPath=menu-items%2Fitem-3");
    expect(String(fetchMock.mock.calls[1][0])).toContain("assetKey=gallery-1");
  });
});

describe("checkMediaApiHealth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.MEDIA_API_BASE_URL = "https://media-api.example.com";
  });

  it("uses /healthcheck when available", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkMediaApiHealth();

    expect(result.ok).toBe(true);
    expect(result.endpoint).toBe("/healthcheck");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/healthcheck");
  });

  it("falls back to /health when /healthcheck fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkMediaApiHealth();

    expect(result.ok).toBe(true);
    expect(result.endpoint).toBe("/health");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/healthcheck");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/health");
  });
});
