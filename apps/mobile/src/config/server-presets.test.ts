import { expect, it } from "vitest";
import { DEFAULT_SERVER_PRESETS, parseServerPresets } from "./server-presets";

it("preserva os servidores público e desenvolvimento e normaliza a origem", () => {
  expect(parseServerPresets(DEFAULT_SERVER_PRESETS)).toEqual(
    DEFAULT_SERVER_PRESETS
  );
  expect(
    parseServerPresets([
      { name: " Público ", url: " https://www.amodomio.com.br/ " },
    ])
  ).toEqual([{ name: "Público", url: "https://www.amodomio.com.br" }]);
});

it("rejeita listas malformadas e endereços com credenciais, caminhos ou protocolos inválidos", () => {
  for (const value of [
    null,
    {},
    [],
    [{ url: "https://example.com" }],
    Array(21).fill(DEFAULT_SERVER_PRESETS[0]),
  ]) {
    expect(() => parseServerPresets(value)).toThrow();
  }
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/admin",
    "https://example.com?token=secret",
    "https://example.com#hash",
    "invalid",
  ]) {
    expect(() => parseServerPresets([{ name: "Servidor", url }])).toThrow();
  }
  expect(() =>
    parseServerPresets([
      { name: "Um", url: "https://example.com" },
      { name: "Dois", url: "https://example.com/" },
    ])
  ).toThrow();
});
