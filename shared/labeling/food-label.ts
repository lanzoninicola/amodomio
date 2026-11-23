export type LabelingItem = {
  id: string;
  name: string;
  classification: string;
  LabelingConfig: {
    shelfLifeMinutes: number;
    conservation: string | null;
    labelName: string | null;
  };
};

export type FoodLabelRecord = {
  id: string;
  itemId: string;
  itemName: string;
  conservation: string | null;
  manipulatedAt: string;
  expiresAt: string;
  copies: number;
  operatorName: string | null;
  printStatus: string;
  printError?: string | null;
};

export type LabelingSettings = {
  printerName: string;
  qzHost: string;
  columns: number;
  cutAfterPrint: boolean;
};

function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}

function center(value: string, columns: number) {
  const text = ascii(value).slice(0, columns);
  return `${" ".repeat(Math.max(0, Math.floor((columns - text.length) / 2)))}${text}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value)).replace(",", "");
}

export function buildEscPosFoodLabel(label: FoodLabelRecord, settings: LabelingSettings) {
  const columns = Math.max(20, Math.min(80, settings.columns || 42));
  const separator = "-".repeat(columns);
  const lines = [
    "\x1B\x40",
    "\x1B\x61\x01",
    "\x1B\x45\x01",
    `${center(label.itemName.toUpperCase(), columns)}\n`,
    "\x1B\x45\x00",
    "\x1B\x61\x00",
    `${separator}\n`,
    `MANIPULADO: ${formatDate(label.manipulatedAt)}\n`,
    `VALIDADE:   ${formatDate(label.expiresAt)}\n`,
  ];
  if (label.conservation) lines.push(`${ascii(label.conservation.toUpperCase()).slice(0, columns)}\n`);
  if (label.operatorName) lines.push(`RESP.: ${ascii(label.operatorName).slice(0, columns - 7)}\n`);
  lines.push(`${separator}\n`, "\n");
  if (settings.cutAfterPrint) lines.push("\x1D\x56\x00");
  return lines;
}

export function shelfLifeLabel(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440} dia${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hora${minutes === 60 ? "" : "s"}`;
  return `${minutes} minutos`;
}
