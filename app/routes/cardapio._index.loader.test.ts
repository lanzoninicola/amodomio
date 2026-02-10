import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findItems: vi.fn(),
  findTags: vi.fn(),
  postFindFirst: vi.fn(),
  settingFindFirst: vi.fn(),
  getEngagementSettings: vi.fn(),
  redisGetJson: vi.fn(),
  redisSetJson: vi.fn(),
  notifyContingency: vi.fn(),
}));

vi.mock("~/domain/cardapio/menu-item.prisma.entity.server", () => ({
  menuItemPrismaEntity: {
    findAllGroupedByGroupLight: mocks.findItems,
  },
}));

vi.mock("~/domain/tags/tag.prisma.entity.server", () => ({
  tagPrismaEntity: {
    findAll: mocks.findTags,
  },
}));

vi.mock("~/lib/prisma/client.server", () => ({
  default: {
    post: {
      findFirst: mocks.postFindFirst,
    },
    setting: {
      findFirst: mocks.settingFindFirst,
    },
  },
}));

vi.mock("~/domain/cardapio/engagement-settings.server", () => ({
  getEngagementSettings: mocks.getEngagementSettings,
}));

vi.mock("~/lib/cache/redis.server", () => ({
  redisGetJson: mocks.redisGetJson,
  redisSetJson: mocks.redisSetJson,
}));

vi.mock("~/domain/cardapio/cardapio-contingency-alert.server", () => ({
  notifyCardapioContingencyByWhatsapp: mocks.notifyContingency,
}));

import { loader } from "~/routes/cardapio._index";

function buildArgs(url = "http://localhost/cardapio") {
  return {
    request: new Request(url),
    context: {},
    params: {},
  } as any;
}

describe("cardapio._index loader (blocker guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findItems.mockReturnValue(Promise.resolve([{ id: "item-1" }]));
    mocks.findTags.mockReturnValue(Promise.resolve([{ id: "tag-1", name: "pizza" }]));
    mocks.postFindFirst.mockResolvedValue(null);
    mocks.getEngagementSettings.mockResolvedValue({
      likesEnabled: true,
      sharesEnabled: true,
    });
    mocks.redisGetJson.mockResolvedValue(undefined);
    mocks.redisSetJson.mockResolvedValue(undefined);
    mocks.notifyContingency.mockResolvedValue(undefined);

    mocks.settingFindFirst
      .mockResolvedValueOnce({ value: "false" }) // contingencia.simula.erro
      .mockResolvedValueOnce({ value: null }) // reel.urls
      .mockResolvedValueOnce({ value: "true" }); // menu-item-interest-enabled
  });

  it("carrega dados do cardapio quando o loader funciona", async () => {
    const result: any = await loader(buildArgs());

    expect(mocks.findItems).toHaveBeenCalledTimes(1);
    expect(result.data).toHaveProperty("items");
    expect(result.data).toHaveProperty("tags");
    expect(result.data.menuItemInterestEnabled).toBe(true);
    expect(mocks.redisSetJson).toHaveBeenCalledTimes(1);
  });

  it("retorna cache quando houver hit no Redis", async () => {
    mocks.redisGetJson.mockResolvedValueOnce({
      items: [{ id: "cached-item-1" }],
      tags: [{ id: "cached-tag-1", name: "pizza" }],
      postFeatured: null,
      reelUrls: [],
      menuItemInterestEnabled: true,
      likesEnabled: true,
      sharesEnabled: true,
    });

    const result: any = await loader(buildArgs());

    expect(mocks.findItems).not.toHaveBeenCalled();
    expect(mocks.findTags).not.toHaveBeenCalled();
    expect(result.data.items[0].id).toBe("cached-item-1");
  });

  it("falha quando a simulacao bloqueante está ativada por setting", async () => {
    mocks.settingFindFirst.mockReset();
    mocks.settingFindFirst.mockResolvedValueOnce({ value: "true" }); // contingencia.simula.erro

    await expect(loader(buildArgs())).rejects.toThrow("SIMULACAO_ERRO_CARDAPIO_INDEX");
  });

  it("falha quando a consulta principal de itens quebra", async () => {
    mocks.findItems.mockImplementation(() => {
      throw new Error("ITEMS_QUERY_FAILED");
    });

    await expect(loader(buildArgs())).rejects.toThrow("ITEMS_QUERY_FAILED");
    expect(mocks.notifyContingency).toHaveBeenCalledTimes(1);
  });
});
