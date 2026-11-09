import { describe, expect, it } from "vitest";

import { getNoveltyItems, itemHasPublicTag } from "./cardapio-index.shared";

describe("itemHasPublicTag", () => {
  it("normaliza caixa e espacos ao comparar tags publicas", () => {
    expect(
      itemHasPublicTag(
        {
          tags: {
            public: [" Vegetariana "],
          },
        },
        "vegetariana",
      ),
    ).toBe(true);
  });

  it("tambem considera tags nao publicas do payload compat", () => {
    expect(
      itemHasPublicTag(
        {
          tags: {
            all: ["Doce"],
            public: [],
          },
        },
        " doce ",
      ),
    ).toBe(true);
  });
});

describe("getNoveltyItems", () => {
  it("considera automaticamente itens publicados nos ultimos 30 dias", () => {
    const recentItem = {
      id: "costela",
      name: "Costela",
      publishedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    };

    expect(getNoveltyItems([recentItem])).toEqual([recentItem]);
  });

  it("mantem a tag novidade como inclusao manual", () => {
    const taggedItem = {
      id: "especial",
      name: "Especial",
      publishedAt: new Date("2020-01-01"),
      tags: { public: ["novidade"] },
    };

    expect(getNoveltyItems([taggedItem])).toEqual([taggedItem]);
  });
});
