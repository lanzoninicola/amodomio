import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dnaEmpresaSettingsFindFirst: vi.fn(),
}));

vi.mock("~/lib/prisma/client.server", () => ({
  default: {
    dnaEmpresaSettings: {
      findFirst: mocks.dnaEmpresaSettingsFindFirst,
    },
  },
}));

import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";

describe("menuItemSellingPriceUtilityEntity.getSellingPriceConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("usa a configuracao atual do DNA e ignora snapshots", async () => {
    mocks.dnaEmpresaSettingsFindFirst.mockResolvedValue({
      dnaPerc: 57.79,
      wastePerc: 2,
      isSnapshot: false,
    });

    const config = await menuItemSellingPriceUtilityEntity.getSellingPriceConfig();

    expect(mocks.dnaEmpresaSettingsFindFirst).toHaveBeenCalledWith({
      where: { isSnapshot: false },
      orderBy: { createdAt: "desc" },
    });
    expect(config).toEqual({
      dnaPercentage: 57.79,
      wastePercentage: 2,
    });
  });

  it("retorna zero quando nao existe configuracao atual", async () => {
    mocks.dnaEmpresaSettingsFindFirst.mockResolvedValue(null);

    await expect(
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig()
    ).resolves.toEqual({
      dnaPercentage: 0,
      wastePercentage: 0,
    });
  });
});
