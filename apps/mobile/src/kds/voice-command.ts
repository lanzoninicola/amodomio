import type { KdsOrder, KdsStatus } from "./types";

export type VoiceCommand = { commandNumber: number; status: KdsStatus };

const smallNumbers: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};
const tens: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};
const hundreds: Record<string, number> = {
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};
const statuses: Record<string, KdsStatus> = {
  "novo pedido": "novoPedido",
  "em producao": "emProducao",
  producao: "emProducao",
  "aguardando forno": "aguardandoForno",
  "aguardando o forno": "aguardandoForno",
  assando: "assando",
  finalizado: "finalizado",
  pronto: "finalizado",
};

function spokenNumber(text: string): number | null {
  if (/^\d+$/.test(text)) {
    const value = Number(text);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (text in smallNumbers) return smallNumbers[text];
  if (text in tens) return tens[text];
  if (text === "cem") return 100;
  if (text in hundreds) return hundreds[text];
  const match = text.match(/^(\S+) e (.+)$/);
  if (!match) return null;
  const [, first, rest] = match;
  if (
    first in tens &&
    rest in smallNumbers &&
    smallNumbers[rest] > 0 &&
    smallNumbers[rest] < 10
  )
    return tens[first] + smallNumbers[rest];
  const base = first === "cento" ? 100 : hundreds[first];
  const remainder = spokenNumber(rest);
  if (base && remainder !== null && remainder > 0 && remainder < 100)
    return base + remainder;
  return null;
}

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = transcript
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");
  const match = normalized.match(
    /^numero (.+?)[,:.]? (novo pedido|em producao|producao|aguardando (?:o )?forno|assando|finalizado|pronto)$/
  );
  if (!match) return null;
  const commandNumber = spokenNumber(match[1]);
  if (
    !Number.isSafeInteger(commandNumber) ||
    commandNumber === null ||
    commandNumber < 1
  )
    return null;
  return { commandNumber, status: statuses[match[2]] };
}

export function resolveVoiceOrder(orders: KdsOrder[], command: VoiceCommand) {
  const matches = orders.filter(
    (order) => order.commandNumber === command.commandNumber
  );
  // Never guess when a number is duplicated in the current day.
  return matches.length === 1 ? matches[0] : null;
}
