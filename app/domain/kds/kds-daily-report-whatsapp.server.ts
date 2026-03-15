import { computeNetRevenueAmount } from "~/domain/finance/compute-net-revenue-amount";
import { getDailyAggregates, listMotoboy } from "~/domain/kds/server/repository.server";
import { CHANNELS } from "~/domain/kds/constants";
import { normalizePhone, sendTextMessage } from "~/domain/z-api/zapi.service";
import prisma from "~/lib/prisma/client.server";

export const KDS_DAILY_REPORT_WHATSAPP_CONTEXT = "kds-daily-report-whatsapp";
export const KDS_DAILY_REPORT_WHATSAPP_PHONES_SETTING = "phones";
export const KDS_DAILY_REPORT_WHATSAPP_TEMPLATE_SETTING = "messageTemplate";

export const DEFAULT_KDS_DAILY_REPORT_WHATSAPP_TEMPLATE = [
  "*Relatorio final do dia {data}*",
  "{dia_semana}",
  "",
  "*Resumo vs semana anterior ({data_semana_anterior})*",
  "Pedidos: {total_pedidos}",
  "Bruto: {faturamento_bruto_brl}",
  "Liquido: {faturamento_liquido_brl}",
  "Ticket medio: {ticket_medio_brl}",
  "",
  "*Pizzas*",
  "Total: {total_pizzas}",
  "{resumo_pizzas_por_tamanho}",
  "",
  "*Por canal*",
  "{resumo_canais}",
].join("\n");

export const KDS_DAILY_REPORT_WHATSAPP_VARIABLES = [
  "data",
  "dia_semana",
  "data_semana_anterior",
  "total_pedidos",
  "total_pizzas",
  "resumo_pizzas_por_tamanho",
  "faturamento_bruto",
  "faturamento_bruto_brl",
  "faturamento_liquido",
  "faturamento_liquido_brl",
  "ticket_medio",
  "ticket_medio_brl",
  "total_moto",
  "total_moto_brl",
  "faturamento_cartao",
  "faturamento_cartao_brl",
  "faturamento_marketplace",
  "faturamento_marketplace_brl",
  "taxa_cartao_perc",
  "imposto_perc",
  "taxa_marketplace_perc",
  "resumo_canais",
  "resumo_status",
  "total_entregas_moto",
  "resumo_motoboy",
] as const;

type DailyReportVariables = Record<(typeof KDS_DAILY_REPORT_WHATSAPP_VARIABLES)[number], string>;

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyBRL(value: number) {
  return `R$ ${formatMoney(value)}`;
}

function formatDateBR(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatWeekday(dateStr: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${dateStr}T12:00:00`));
}

function subtractDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsePhones(value: string | null | undefined) {
  if (!value) return [];
  const phones = value
    .split(/[\n,;]+/g)
    .map((entry) => normalizePhone(entry))
    .filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(phones));
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

function summarizeChannels(rows: Array<{ k: string; count: number; total: number }>) {
  if (!rows.length) return "-";
  const buckets = rows.reduce(
    (acc, row) => {
      if (isMarketplaceChannel(row.k)) {
        acc.marketplace.count += row.count;
        acc.marketplace.total += row.total;
      } else {
        acc.other.count += row.count;
        acc.other.total += row.total;
      }
      return acc;
    },
    {
      marketplace: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    }
  );

  return [
    `Marketplace: ${buckets.marketplace.count} pedidos / ${formatMoneyBRL(buckets.marketplace.total)}`,
    `Outros canais: ${buckets.other.count} pedidos / ${formatMoneyBRL(buckets.other.total)}`,
  ].join("\n");
}

function summarizeStatuses(rows: Array<{ k: string; count: number; total: number }>) {
  if (!rows.length) return "-";
  return rows
    .map((row) => `${row.k}: ${row.count} pedidos / ${formatMoneyBRL(row.total)}`)
    .join("\n");
}

function summarizeMotoboy(
  rows: Array<{
    commandNumber: number | null;
    isVendaLivre: boolean;
    motoValue: any;
  }>
) {
  if (!rows.length) return "-";
  return rows
    .map((row) => {
      const label = row.isVendaLivre
        ? "VL"
        : row.commandNumber != null
          ? `#${row.commandNumber}`
          : "Sem comanda";
      return `${label}: ${formatMoneyBRL(Number(row.motoValue ?? 0))}`;
    })
    .join("\n");
}

function isMarketplaceChannel(channel: string) {
  return channel === CHANNELS[2] || channel === CHANNELS[3];
}

function parsePizzaCount(size: string | null | undefined) {
  if (!size) return 0;

  try {
    const parsed = JSON.parse(size) as Record<string, unknown>;
    return ["F", "M", "P", "I", "FT"].reduce((sum, key) => {
      const value = Number(parsed[key] ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  } catch {
    return 0;
  }
}

function parsePizzaSizes(size: string | null | undefined) {
  const empty = { F: 0, M: 0, P: 0, I: 0, FT: 0 };
  if (!size) return empty;

  try {
    const parsed = JSON.parse(size) as Record<string, unknown>;
    return {
      F: Number(parsed.F ?? 0) || 0,
      M: Number(parsed.M ?? 0) || 0,
      P: Number(parsed.P ?? 0) || 0,
      I: Number(parsed.I ?? 0) || 0,
      FT: Number(parsed.FT ?? 0) || 0,
    };
  } catch {
    return empty;
  }
}

function summarizePizzaSizes(sizeTotals: { F: number; M: number; P: number; I: number; FT: number }) {
  return [
    `F: ${sizeTotals.F}`,
    `M: ${sizeTotals.M}`,
    `P: ${sizeTotals.P}`,
    `I: ${sizeTotals.I}`,
    `FT: ${sizeTotals.FT}`,
  ].join("\n");
}

type DailyReportMetrics = {
  totalPedidos: number;
  totalPizzas: number;
  pizzasPorTamanho: { F: number; M: number; P: number; I: number; FT: number };
  faturamentoBruto: number;
  faturamentoLiquido: number;
  ticketMedio: number;
  faturamentoCartao: number;
  faturamentoMarketplace: number;
  resumoCanais: string;
};

function withPreviousWeek(current: string, previous: string) {
  return `${current} (${previous})`;
}

async function getDailyReportMetrics(dateInt: number, dateStr: string): Promise<DailyReportMetrics> {
  const [agg, rates, sizeRows] = await Promise.all([
    getDailyAggregates(dateInt),
    getRatesForDate(dateStr),
    prisma.kdsDailyOrderDetail.findMany({
      where: { dateInt, status: { not: "pendente" } },
      select: { size: true },
    }),
  ]);

  const taxaCartaoPerc = Number(rates?.taxaCartaoPerc ?? 0);
  const impostoPerc = Number(rates?.impostoPerc ?? 0);
  const taxaMarketplacePerc = Number(rates?.taxaMarketplacePerc ?? 0);
  const pizzasPorTamanho = sizeRows.reduce(
    (acc, row) => {
      const parsed = parsePizzaSizes(row.size);
      acc.F += parsed.F;
      acc.M += parsed.M;
      acc.P += parsed.P;
      acc.I += parsed.I;
      acc.FT += parsed.FT;
      return acc;
    },
    { F: 0, M: 0, P: 0, I: 0, FT: 0 }
  );
  const totalPizzas = sizeRows.reduce((sum, row) => sum + parsePizzaCount(row.size), 0);
  const ticketMedio = agg.count > 0 ? agg.total / agg.count : 0;
  const faturamentoLiquido = computeNetRevenueAmount({
    receitaBrutaAmount: agg.total,
    vendaCartaoAmount: agg.card ?? 0,
    taxaCartaoPerc,
    impostoPerc,
    vendaMarketplaceAmount: agg.marketplace ?? 0,
    taxaMarketplacePerc,
  });

  return {
    totalPedidos: agg.count ?? 0,
    totalPizzas,
    pizzasPorTamanho,
    faturamentoBruto: agg.total,
    faturamentoLiquido,
    ticketMedio,
    faturamentoCartao: agg.card,
    faturamentoMarketplace: agg.marketplace,
    resumoCanais: summarizeChannels(agg.byChannel),
  };
}

export async function getKdsDailyReportWhatsappSettings() {
  const normalizedDefaultTemplate = normalizeTemplate(
    DEFAULT_KDS_DAILY_REPORT_WHATSAPP_TEMPLATE
  );

  const existingTemplate = await prisma.setting.findFirst({
    where: {
      context: KDS_DAILY_REPORT_WHATSAPP_CONTEXT,
      name: KDS_DAILY_REPORT_WHATSAPP_TEMPLATE_SETTING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingTemplate?.id) {
    const normalizedExistingTemplate = normalizeTemplate(existingTemplate.value);
    if (existingTemplate.value !== normalizedExistingTemplate) {
      await prisma.setting.update({
        where: { id: existingTemplate.id },
        data: {
          type: "string",
          value: normalizedExistingTemplate,
        },
      });
    }
  } else {
    await prisma.setting.create({
      data: {
        context: KDS_DAILY_REPORT_WHATSAPP_CONTEXT,
        name: KDS_DAILY_REPORT_WHATSAPP_TEMPLATE_SETTING,
        type: "string",
        value: normalizedDefaultTemplate,
        createdAt: new Date(),
      },
    });
  }

  const settings = await prisma.setting.findMany({
    where: { context: KDS_DAILY_REPORT_WHATSAPP_CONTEXT },
    select: { name: true, value: true },
    orderBy: [{ createdAt: "desc" }],
  });
  const byName = settings.reduce<Map<string, string | null>>((acc, setting) => {
    if (acc.has(setting.name)) return acc;
    acc.set(setting.name, setting.value);
    return acc;
  }, new Map());

  return {
    phonesRaw: byName.get(KDS_DAILY_REPORT_WHATSAPP_PHONES_SETTING) || "",
    template: normalizeTemplate(
      byName.get(KDS_DAILY_REPORT_WHATSAPP_TEMPLATE_SETTING) || normalizedDefaultTemplate
    ),
  };
}

async function getRatesForDate(dateStr: string) {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));

  const hasConfiguredRates = (close: {
    taxaCartaoPerc: number;
    impostoPerc: number;
    taxaMarketplacePerc: number;
  } | null) =>
    Number(close?.taxaCartaoPerc ?? 0) > 0 ||
    Number(close?.impostoPerc ?? 0) > 0 ||
    Number(close?.taxaMarketplacePerc ?? 0) > 0;

  const monthlyCloseRates = await prisma.financialMonthlyClose.findUnique({
    where: {
      referenceYear_referenceMonth: {
        referenceYear: year,
        referenceMonth: month,
      },
    },
    select: { taxaCartaoPerc: true, impostoPerc: true, taxaMarketplacePerc: true },
  });
  if (hasConfiguredRates(monthlyCloseRates)) return monthlyCloseRates;

  return prisma.financialMonthlyClose.findFirst({
    where: {
      AND: [
        {
          OR: [
            { referenceYear: { lt: year } },
            { referenceYear: year, referenceMonth: { lte: month } },
          ],
        },
        {
          OR: [
            { taxaCartaoPerc: { gt: 0 } },
            { impostoPerc: { gt: 0 } },
            { taxaMarketplacePerc: { gt: 0 } },
          ],
        },
      ],
    },
    orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
    select: { taxaCartaoPerc: true, impostoPerc: true, taxaMarketplacePerc: true },
  });
}

export async function buildKdsDailyReportWhatsappPayload(dateInt: number, dateStr: string) {
  const previousDateStr = subtractDays(dateStr, 7);
  const previousDateInt = Number(previousDateStr.replaceAll("-", ""));

  const [metrics, previousMetrics, motoList, rates, settings] = await Promise.all([
    getDailyReportMetrics(dateInt, dateStr),
    getDailyReportMetrics(previousDateInt, previousDateStr),
    listMotoboy(dateInt),
    getRatesForDate(dateStr),
    getKdsDailyReportWhatsappSettings(),
  ]);

  const taxaCartaoPerc = Number(rates?.taxaCartaoPerc ?? 0);
  const impostoPerc = Number(rates?.impostoPerc ?? 0);
  const taxaMarketplacePerc = Number(rates?.taxaMarketplacePerc ?? 0);

  const variables: DailyReportVariables = {
    data: formatDateBR(dateStr),
    dia_semana: formatWeekday(dateStr),
    data_semana_anterior: formatDateBR(previousDateStr),
    total_pedidos: withPreviousWeek(
      String(metrics.totalPedidos),
      String(previousMetrics.totalPedidos)
    ),
    total_pizzas: withPreviousWeek(
      String(metrics.totalPizzas),
      String(previousMetrics.totalPizzas)
    ),
    resumo_pizzas_por_tamanho: summarizePizzaSizes(metrics.pizzasPorTamanho),
    faturamento_bruto: formatMoney(metrics.faturamentoBruto),
    faturamento_bruto_brl: withPreviousWeek(
      formatMoneyBRL(metrics.faturamentoBruto),
      formatMoneyBRL(previousMetrics.faturamentoBruto)
    ),
    faturamento_liquido: formatMoney(metrics.faturamentoLiquido),
    faturamento_liquido_brl: withPreviousWeek(
      formatMoneyBRL(metrics.faturamentoLiquido),
      formatMoneyBRL(previousMetrics.faturamentoLiquido)
    ),
    ticket_medio: formatMoney(metrics.ticketMedio),
    ticket_medio_brl: withPreviousWeek(
      formatMoneyBRL(metrics.ticketMedio),
      formatMoneyBRL(previousMetrics.ticketMedio)
    ),
    total_moto: "0,00",
    total_moto_brl: "R$ 0,00",
    faturamento_cartao: formatMoney(metrics.faturamentoCartao),
    faturamento_cartao_brl: formatMoneyBRL(metrics.faturamentoCartao),
    faturamento_marketplace: formatMoney(metrics.faturamentoMarketplace),
    faturamento_marketplace_brl: formatMoneyBRL(metrics.faturamentoMarketplace),
    taxa_cartao_perc: formatMoney(taxaCartaoPerc),
    imposto_perc: formatMoney(impostoPerc),
    taxa_marketplace_perc: formatMoney(taxaMarketplacePerc),
    resumo_canais: metrics.resumoCanais,
    resumo_status: "-",
    total_entregas_moto: String(motoList.length),
    resumo_motoboy: summarizeMotoboy(motoList),
  };

  const phones = parsePhones(settings.phonesRaw);
  const message = applyTemplate(settings.template, variables).trim();

  return {
    phones,
    template: settings.template,
    message,
    variables,
  };
}

export async function sendKdsDailyReportWhatsapp(dateInt: number, dateStr: string) {
  const payload = await buildKdsDailyReportWhatsappPayload(dateInt, dateStr);

  if (!payload.phones.length) {
    return {
      ok: true,
      attempted: false,
      skipped: true,
      detail: "Nenhum numero configurado para o relatorio do WhatsApp.",
      sentCount: 0,
      totalRecipients: 0,
    };
  }

  if (!payload.message) {
    return {
      ok: true,
      attempted: false,
      skipped: true,
      detail: "Template do relatorio vazio.",
      sentCount: 0,
      totalRecipients: payload.phones.length,
    };
  }

  const results = await Promise.allSettled(
    payload.phones.map((phone) =>
      sendTextMessage({ phone, message: payload.message }, { timeoutMs: 10_000 })
    )
  );

  const sentCount = results.filter((result) => result.status === "fulfilled").length;
  const failedCount = results.length - sentCount;

  return {
    ok: failedCount === 0,
    attempted: true,
    skipped: false,
    detail:
      failedCount === 0
        ? `Relatorio enviado para ${sentCount} destinatario(s).`
        : `Relatorio enviado para ${sentCount} de ${results.length} destinatario(s).`,
    sentCount,
    totalRecipients: results.length,
  };
}
