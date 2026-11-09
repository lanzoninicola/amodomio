import { expect, it } from "vitest";
import { parseVoiceCommand, resolveVoiceOrder } from "./voice-command";
import type { KdsOrder } from "./types";

it.each([
  ["número 123 assando", 123, "assando"],
  [" número 123, assando. ", 123, "assando"],
  ["Número cento e vinte e três assando.", 123, "assando"],
  ["número vinte e dois em produção", 22, "emProducao"],
  ["número cinco novo pedido", 5, "novoPedido"],
  ["número 007 aguardando o forno", 7, "aguardandoForno"],
  ["número trezentos e onze pronto", 311, "finalizado"],
  ["número 42 finalizado!", 42, "finalizado"],
])("recognizes %s", (text, commandNumber, status) => {
  expect(parseVoiceCommand(text)).toEqual({ commandNumber, status });
});

it.each([
  "assando",
  "número 123",
  "número -1 assando",
  "número 0 assando",
  "número 1.23 assando",
  "número 1 23 assando",
  "número um dois assando",
  "número vinte e vinte assando",
  "número 123 excluir",
  "número 123 assando e número 124 pronto",
  "número 123 não está assando",
  "número 9007199254740992 assando",
  "número constructor assando",
])("rejects ambiguous or unsupported commands: %s", (text) => {
  expect(parseVoiceCommand(text)).toBeNull();
});

it("matches the command number rather than a database ID, refusing missing or duplicate numbers", () => {
  const command = parseVoiceCommand("número 123 assando")!;
  const target = { id: "different-id", commandNumber: 123 } as KdsOrder;
  const other = { id: "123", commandNumber: 2 } as KdsOrder;
  expect(resolveVoiceOrder([other, target], command)).toBe(target);
  expect(resolveVoiceOrder([other], command)).toBeNull();
  expect(
    resolveVoiceOrder([target, { ...target, id: "duplicate" }], command)
  ).toBeNull();
});
