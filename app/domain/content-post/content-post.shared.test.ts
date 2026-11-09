import { describe, expect, it } from "vitest";
import { parseCardapioFeaturedConfig } from "./content-post.shared";

describe("parseCardapioFeaturedConfig", () => {
  it("preserva o fallback legado que usa todas as mídias", () => {
    expect(parseCardapioFeaturedConfig({}).selectedMediaKeys).toBeNull();
  });

  it("normaliza a seleção de mídias do canal", () => {
    expect(
      parseCardapioFeaturedConfig({
        selectedMediaKeys: ["0", "1", "0", null, 2, ""],
      }).selectedMediaKeys
    ).toEqual(["0", "1"]);
  });

  it("preserva uma seleção vazia explícita", () => {
    expect(
      parseCardapioFeaturedConfig({ selectedMediaKeys: [] }).selectedMediaKeys
    ).toEqual([]);
  });

  it("normaliza a configuração visual de cada mídia do canal", () => {
    const config = parseCardapioFeaturedConfig({
      mediaConfigByKey: {
        "0": {
          linkUrl: " /cardapio ",
          linkPosition: "bottom",
          linkNewTab: false,
          chipAction: "none",
        },
      },
    });

    expect(config.mediaConfigByKey["0"]).toMatchObject({
      linkUrl: "/cardapio",
      linkPosition: "bottom",
      linkNewTab: false,
      chipAction: "none",
    });
  });
});
