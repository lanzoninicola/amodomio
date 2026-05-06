import { describe, expect, it } from "vitest";

import { itemHasPublicTag } from "./cardapio-index.shared";

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
