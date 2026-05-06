import prisma from "~/lib/prisma/client.server";
import { logCrmWhatsappSentEventByPhone } from "~/domain/crm/crm-whatsapp-events.server";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import { defaultSizeCounts, type SizeCounts } from "./types";
import { todayLocalYMD } from "./utils/date";

const ALLOWED_KEYS: (keyof SizeCounts)[] = ["F", "M", "P", "I", "FT"];
export const DOUGH_STOCK_WHATSAPP_CONTEXT = "estoque-massa";
export const DOUGH_STOCK_WHATSAPP_RECIPIENTS_SETTING = "whatsapp.recipients";
export const DOUGH_STOCK_WHATSAPP_TEMPLATE_SETTING = "whatsapp.template";
export const DEFAULT_DOUGH_STOCK_WHATSAPP_TEMPLATE = [
  "*ESTOQUE DE MASSA*",
  "Data: {data}",
  "",
  "Saldo atual salvo:",
  "Familia: {familia}",
  "Media: {media}",
  "Pequena: {pequena}",
  "Individual: {individual}",
  "Fatia: {fatia}",
].join("\n");

type DoughStockRecord = {
  dateInt: number;
  size: string | null;
};

export type DoughStockSnapshot = {
  base: SizeCounts;        // estoque informado (ex.: discos boleados)
  adjustment: SizeCounts;  // valor manual
  effective: SizeCounts;   // saldo atual que a aplicação deve usar
  adjustmentMode?: "loss" | "override";
};

function computeEffective(
  mode: DoughStockSnapshot["adjustmentMode"],
  base: SizeCounts,
  adjustment: SizeCounts
): SizeCounts {
  if (mode === "override") {
    // modo novo: ajuste é o saldo atual desejado
    return normalizeCounts(adjustment);
  }

  // modo legado: ajuste é perda (base - ajuste)
  return {
    F: Math.max(0, base.F - adjustment.F),
    M: Math.max(0, base.M - adjustment.M),
    P: Math.max(0, base.P - adjustment.P),
    I: Math.max(0, base.I - adjustment.I),
    FT: Math.max(0, base.FT - adjustment.FT),
  };
}

function parseCounts(value?: string | null): DoughStockSnapshot {
  try {
    const raw = value ? JSON.parse(String(value)) : {};
    const baseRaw = raw?.base ?? raw; // retrocompatibilidade: JSON antigo só com F/M/P/I/FT
    const adjustmentRaw = raw?.adjustment ?? defaultSizeCounts();
    const adjustmentMode: DoughStockSnapshot["adjustmentMode"] =
      raw?.adjustmentMode === "override" ? "override" : "loss";

    const base = normalizeCounts(baseRaw);
    const adjustment = normalizeCounts(adjustmentRaw);

    return {
      base,
      adjustment,
      effective: computeEffective(adjustmentMode, base, adjustment),
      adjustmentMode,
    };
  } catch (_e) {
    const empty = defaultSizeCounts();
    return { base: empty, adjustment: empty, effective: empty, adjustmentMode: "override" };
  }
}

export function normalizeCounts(counts: Partial<SizeCounts> | null | undefined): SizeCounts {
  return {
    ...defaultSizeCounts(),
    F: Math.max(0, Number(counts?.F ?? 0) || 0),
    M: Math.max(0, Number(counts?.M ?? 0) || 0),
    P: Math.max(0, Number(counts?.P ?? 0) || 0),
    I: Math.max(0, Number(counts?.I ?? 0) || 0),
    FT: Math.max(0, Number(counts?.FT ?? 0) || 0),
  };
}

export async function getDoughStock(dateInt: number): Promise<DoughStockSnapshot | null> {
  const row = await prisma.doughDailyStock.findUnique({
    where: { dateInt },
    select: { size: true },
  });

  if (!row) return null;
  return parseCounts(row.size);
}

export async function saveDoughStock(dateInt: number, date: Date, counts: SizeCounts, adjustment?: SizeCounts): Promise<DoughStockSnapshot> {
  const base = normalizeCounts(counts);
  const adjustmentSafe = normalizeCounts(adjustment);
  const adjustmentMode: DoughStockSnapshot["adjustmentMode"] = "override";

  const payload = {
    dateInt,
    date,
    size: JSON.stringify({
      base,
      adjustment: adjustmentSafe,
      adjustmentMode,
    }),
  };

  await prisma.doughDailyStock.upsert({
    where: { dateInt },
    update: payload,
    create: payload,
  });

  return {
    base,
    adjustment: adjustmentSafe,
    adjustmentMode,
    effective: computeEffective(adjustmentMode, base, adjustmentSafe),
  };
}

export type DoughSizeOption = {
  key: keyof SizeCounts;
  label: string;
  abbr: string;
};

function inferKey(name?: string | null, abbr?: string | null): keyof SizeCounts | null {
  const candidate = (abbr || name || "").trim().toUpperCase();
  if (ALLOWED_KEYS.includes(candidate as keyof SizeCounts)) return candidate as keyof SizeCounts;
  return null;
}

export async function getAvailableDoughSizes(): Promise<DoughSizeOption[]> {
  const sizes = await prisma.menuItemSize.findMany({
    where: { visible: true },
    select: { id: true, name: true, nameAbbreviated: true, sortOrderIndex: true },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
  });

  const mapped: DoughSizeOption[] = [];

  for (const s of sizes) {
    const key = inferKey(s.nameAbbreviated, s.name);
    if (!key) continue;
    if (mapped.find((m) => m.key === key)) continue; // evita duplicatas pelo mesmo key

    mapped.push({
      key,
      label: s.name || key,
      abbr: s.nameAbbreviated || key,
    });
  }

  if (mapped.length === 0) {
    return [
      { key: "F", label: "Família", abbr: "F" },
      { key: "M", label: "Média", abbr: "M" },
      { key: "P", label: "Pequena", abbr: "P" },
      { key: "I", label: "Individual", abbr: "I" },
      { key: "FT", label: "Fatia", abbr: "FT" },
    ];
  }

  return mapped;
}

export function projectCounts(counts: SizeCounts, order: DoughSizeOption[]): Array<{ option: DoughSizeOption; value: number }> {
  return order.map((opt) => ({ option: opt, value: counts[opt.key] ?? 0 }));
}

function parsePhones(value: string | null | undefined): string[] {
  if (!value) return [];
  const normalized = value
    .split(/[\n,;]+/g)
    .map((entry) => normalizePhone(entry))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(normalized));
}

function formatDateBR(dateStr: string) {
  const [year = "", month = "", day = ""] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function applyTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? "");
}

function normalizeTemplate(template: string) {
  return template
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trim();
}

function buildDoughStockWhatsappMessage(template: string, dateStr: string, snapshot: DoughStockSnapshot) {
  return applyTemplate(template, {
    data: formatDateBR(dateStr),
    familia: String(snapshot.effective.F),
    media: String(snapshot.effective.M),
    pequena: String(snapshot.effective.P),
    individual: String(snapshot.effective.I),
    fatia: String(snapshot.effective.FT),
  }).trim();
}

export async function notifyTodayDoughStockSavedByWhatsapp(input: {
  dateStr: string;
  snapshot: DoughStockSnapshot;
}) {
  if (input.dateStr !== todayLocalYMD()) {
    return {
      ok: true,
      attempted: false,
      skipped: true,
      detail: "Envio do WhatsApp habilitado apenas para a data de hoje.",
      sentCount: 0,
      totalRecipients: 0,
    };
  }

  try {
    const settings = await prisma.setting.findMany({
      where: {
        context: DOUGH_STOCK_WHATSAPP_CONTEXT,
        name: {
          in: [
            DOUGH_STOCK_WHATSAPP_RECIPIENTS_SETTING,
            DOUGH_STOCK_WHATSAPP_TEMPLATE_SETTING,
          ],
        },
      },
      select: { name: true, value: true },
      orderBy: [{ createdAt: "desc" }],
    });

    const settingsMap = settings.reduce<Record<string, string | null>>((acc, setting) => {
      if (acc[setting.name] !== undefined) return acc;
      acc[setting.name] = setting.value;
      return acc;
    }, {});

    const phones = parsePhones(settingsMap[DOUGH_STOCK_WHATSAPP_RECIPIENTS_SETTING]);
    if (!phones.length) {
      return {
        ok: true,
        attempted: false,
        skipped: true,
        detail: "Nenhum numero configurado para o envio do estoque de massa.",
        sentCount: 0,
        totalRecipients: 0,
      };
    }

    const template = normalizeTemplate(
      settingsMap[DOUGH_STOCK_WHATSAPP_TEMPLATE_SETTING] || DEFAULT_DOUGH_STOCK_WHATSAPP_TEMPLATE
    );
    const message = buildDoughStockWhatsappMessage(template, input.dateStr, input.snapshot);
    const results = await Promise.allSettled(
      phones.map(async (phone) => {
        const response = await sendTextMessage(
          { phone, message },
          { timeoutMs: 10_000 }
        );
        await logCrmWhatsappSentEventByPhone({
          phone,
          source: "dough-stock-whatsapp",
          messageText: message,
          payload: {
            channel: "dough-stock",
            date: input.dateStr,
            fromMe: true,
            wppResponse: response,
          },
        });
        return response;
      })
    );

    const sentCount = results.filter((result) => result.status === "fulfilled").length;

    return {
      ok: sentCount === results.length,
      attempted: true,
      skipped: false,
      detail:
        sentCount === results.length
          ? `Estoque enviado para ${sentCount} destinatario(s).`
          : `Estoque enviado para ${sentCount} de ${results.length} destinatario(s).`,
      sentCount,
      totalRecipients: results.length,
    };
  } catch (error) {
    console.error("[dough-stock] whatsapp notify failed", error);
    return {
      ok: false,
      attempted: true,
      skipped: false,
      detail: error instanceof Error ? error.message : "Falha ao enviar estoque de massa no WhatsApp.",
      sentCount: 0,
      totalRecipients: 0,
    };
  }
}
