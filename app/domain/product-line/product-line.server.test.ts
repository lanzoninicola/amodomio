import { describe, expect, it } from "vitest";

import { normalizeProductLineKey } from "./product-line.server";

describe("normalizeProductLineKey", () => {
  it("gera uma chave estável para nomes de linhas", () => {
    expect(normalizeProductLineKey("  Massa Fresca & Recheada  ")).toBe(
      "massa-fresca-recheada"
    );
  });
});
