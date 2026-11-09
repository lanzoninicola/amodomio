import { json, type LoaderFunctionArgs, type MetaFunction, type SerializeFrom } from "@remix-run/node";
import { Form, NavLink, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Prisma } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { CHANNELS, todayLocalYMD, ymdToDateInt } from "@/domain/kds";
import { calcWeightedCostPerc } from "~/domain/finance/calc-weighted-cost-perc";
import { computeNetRevenueAmount } from "~/domain/finance/compute-net-revenue-amount";
import prisma from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";

type AggRow = { k: string; count: number; total: number; moto: number };
type TotalsRow = {
  total: number;
  moto: number;
  count: number;
  card: number;
  marketplace: number;
  net: number;
  estimatedResult: number;
  avgTicket: number;
  revenuePerDay: number;
  ordersPerDay: number;
};

type ChannelFinanceRow = {
  channel: string;
  orders: number;
  grossRevenue: number;
  cardRevenue: number;
  taxAmount: number;
  cardFeeAmount: number;
  marketplaceFeeAmount: number;
  netRevenue: number;
  isMarketplace: boolean;
};

export type MonthlyReportData = SerializeFrom<typeof loader>;
export type MonthlyReportOutletContext = { report: MonthlyReportData };

export const meta: MetaFunction = () => {
  return [{ title: "KDS | Relatório Mensal" }];
};

function ymdParts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function ymdFmt(y: number, month: number, day: number) {
  return `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidYMD(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function firstDayOfMonth(ymd: string) {
  const { y, m } = ymdParts(ymd);
  return ymdFmt(y, m, 1);
}

function lastDayOfMonth(ymd: string) {
  const { y, m } = ymdParts(ymd);
  const last = new Date(y, m, 0);
  return ymdFmt(last.getFullYear(), last.getMonth() + 1, last.getDate());
}

function shiftMonthClamped(ymd: string, monthsDelta: number) {
  const { y, m, d } = ymdParts(ymd);
  const firstOfTarget = new Date(y, m - 1 + monthsDelta, 1);
  const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  return ymdFmt(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, Math.min(d, lastDay));
}

function diffDaysInclusive(fromYMD: string, toYMD: string) {
  const start = new Date(`${fromYMD}T12:00:00`);
  const end = new Date(`${toYMD}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function formatPeriodLabel(fromYMD: string, toYMD: string) {
  const from = new Date(`${fromYMD}T12:00:00`);
  const to = new Date(`${toYMD}T12:00:00`);
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();

  if (sameMonth) {
    return `${from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} (${fromYMD} -> ${toYMD})`;
  }

  return `${fromYMD} -> ${toYMD}`;
}

function sortRows(rows: AggRow[]) {
  return rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return b.count - a.count;
  });
}

function isMarketplaceChannel(channel: string) {
  return channel === CHANNELS[2] || channel === CHANNELS[3];
}

function reduceRows<T extends { channel: string | null; status: string | null; orderAmount: Prisma.Decimal | number; motoValue: Prisma.Decimal | number }>(
  rows: T[],
  key: "channel" | "status",
) {
  const map = new Map<string, AggRow>();

  for (const row of rows) {
    const label = (key === "channel" ? row.channel : row.status) ?? `(sem ${key === "channel" ? "canal" : "status"})`;
    const current = map.get(label) ?? { k: label, count: 0, total: 0, moto: 0 };
    current.count += 1;
    current.total += Number(row.orderAmount ?? 0);
    current.moto += Number(row.motoValue ?? 0);
    map.set(label, current);
  }

  return sortRows(Array.from(map.values()));
}

function reduceNeighborhoodRows<
  T extends {
    orderAmount: Prisma.Decimal | number;
    motoValue: Prisma.Decimal | number;
    DeliveryZone: { name: string } | null;
  },
>(rows: T[]) {
  const map = new Map<string, AggRow>();

  for (const row of rows) {
    const label = row.DeliveryZone?.name?.trim() || "(sem bairro)";
    const current = map.get(label) ?? { k: label, count: 0, total: 0, moto: 0 };
    current.count += 1;
    current.total += Number(row.orderAmount ?? 0);
    current.moto += Number(row.motoValue ?? 0);
    map.set(label, current);
  }

  return sortRows(Array.from(map.values()));
}

async function getRangeSnapshot(fromYMD: string, toYMD: string) {
  const fromInt = ymdToDateInt(fromYMD);
  const toInt = ymdToDateInt(toYMD);
  const rangeFilter = { gte: fromInt, lte: toInt };
  const completedWhere = {
    dateInt: rangeFilter,
    status: { not: "pendente" },
  } satisfies Prisma.KdsDailyOrderDetailWhereInput;
  const deliveryWhere = {
    dateInt: rangeFilter,
    status: { not: "pendente" },
    OR: [{ hasMoto: true }, { motoValue: { gt: 0 } }],
  } satisfies Prisma.KdsDailyOrderDetailWhereInput;

  const aiqfomeChannel = CHANNELS[2];
  const ifoodChannel = CHANNELS[3];

  const [totalsAgg, cardAgg, marketplaceAgg, byChannelRaw, completedRows, deliveryRows] = await Promise.all([
    prisma.kdsDailyOrderDetail.aggregate({
      where: completedWhere,
      _sum: { orderAmount: true, motoValue: true },
      _count: { _all: true },
    }),
    prisma.kdsDailyOrderDetail.aggregate({
      where: { ...completedWhere, isCreditCard: true },
      _sum: { orderAmount: true },
    }),
    prisma.kdsDailyOrderDetail.aggregate({
      where: {
        ...completedWhere,
        channel: { in: [aiqfomeChannel, ifoodChannel] },
      },
      _sum: { orderAmount: true },
    }),
    prisma.kdsDailyOrderDetail.groupBy({
      by: ["channel"],
      where: completedWhere,
      _sum: { orderAmount: true, motoValue: true },
      _count: { _all: true },
    }),
    prisma.kdsDailyOrderDetail.findMany({
      where: completedWhere,
      select: {
        channel: true,
        orderAmount: true,
        isCreditCard: true,
      },
    }),
    prisma.kdsDailyOrderDetail.findMany({
      where: deliveryWhere,
      select: {
        id: true,
        channel: true,
        status: true,
        orderAmount: true,
        motoValue: true,
        DeliveryZone: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const periodDays = diffDaysInclusive(fromYMD, toYMD);
  const grossRevenue = Number(totalsAgg._sum.orderAmount ?? 0);
  const totalMoto = Number(totalsAgg._sum.motoValue ?? 0);
  const orderCount = totalsAgg._count._all ?? 0;
  const deliveryRevenue = deliveryRows.reduce((sum, row) => sum + Number(row.orderAmount ?? 0), 0);
  const deliveryMotoCost = deliveryRows.reduce((sum, row) => sum + Number(row.motoValue ?? 0), 0);
  const deliveries = deliveryRows.length;
  const cardRevenueByChannel = completedRows.reduce((map, row) => {
    const channel = row.channel ?? "(sem canal)";
    if (!row.isCreditCard) return map;
    map.set(channel, (map.get(channel) ?? 0) + Number(row.orderAmount ?? 0));
    return map;
  }, new Map<string, number>());
  const channelFinance = sortRows(
    byChannelRaw.map((row) => {
      const grossRevenue = Number(row._sum.orderAmount ?? 0);
      const channel = row.channel ?? "(sem canal)";

      return {
        channel,
        orders: row._count._all,
        grossRevenue,
        cardRevenue: cardRevenueByChannel.get(channel) ?? 0,
        taxAmount: 0,
        cardFeeAmount: 0,
        marketplaceFeeAmount: 0,
        netRevenue: grossRevenue,
        isMarketplace: isMarketplaceChannel(channel),
      };
    }),
  );

  return {
    periodDays,
    totalsBase: {
      total: grossRevenue,
      moto: totalMoto,
      count: orderCount,
      card: Number(cardAgg._sum.orderAmount ?? 0),
      marketplace: Number(marketplaceAgg._sum.orderAmount ?? 0),
    },
    tables: {
      byChannel: sortRows(
        byChannelRaw.map((row) => ({
          k: row.channel ?? "(sem canal)",
          count: row._count._all,
          total: Number(row._sum.orderAmount ?? 0),
          moto: Number(row._sum.motoValue ?? 0),
        })),
      ),
      channelFinance,
    },
    delivery: {
      deliveries,
      motoCost: deliveryMotoCost,
      deliveryRevenue,
      avgMotoPerDelivery: deliveries > 0 ? deliveryMotoCost / deliveries : 0,
      avgTicket: deliveries > 0 ? deliveryRevenue / deliveries : 0,
      shareOrdersPerc: orderCount > 0 ? (deliveries / orderCount) * 100 : 0,
      shareRevenuePerc: grossRevenue > 0 ? (deliveryRevenue / grossRevenue) * 100 : 0,
      motoVsRevenuePerc: deliveryRevenue > 0 ? (deliveryMotoCost / deliveryRevenue) * 100 : 0,
      byChannel: reduceRows(deliveryRows, "channel"),
      byStatus: reduceRows(deliveryRows, "status"),
      byNeighborhood: reduceNeighborhoodRows(deliveryRows),
    },
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const url = new URL(request.url);
  const defaultFrom = firstDayOfMonth(dateStr);
  const defaultTo = lastDayOfMonth(dateStr);

  const requestedFrom = isValidYMD(url.searchParams.get("from")) ? String(url.searchParams.get("from")) : defaultFrom;
  const requestedTo = isValidYMD(url.searchParams.get("to")) ? String(url.searchParams.get("to")) : defaultTo;
  const [rangeFrom, rangeTo] = requestedFrom <= requestedTo ? [requestedFrom, requestedTo] : [requestedTo, requestedFrom];

  const prevRangeFrom = shiftMonthClamped(rangeFrom, -1);
  const prevRangeTo = shiftMonthClamped(rangeTo, -1);

  const { y: referenceYear, m: referenceMonth } = ymdParts(rangeTo);

  const [currentSnapshot, previousSnapshot, ratesFromMonthlyClose, closesForAverage] = await Promise.all([
    getRangeSnapshot(rangeFrom, rangeTo),
    getRangeSnapshot(prevRangeFrom, prevRangeTo),
    (async () => {
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
            referenceYear,
            referenceMonth,
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
                { referenceYear: { lt: referenceYear } },
                { referenceYear, referenceMonth: { lte: referenceMonth } },
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
    })(),
    (prisma as any).financialMonthlyClose?.findMany
      ? (prisma as any).financialMonthlyClose.findMany({
        where: {
          OR: [
            { referenceYear: { lt: referenceYear } },
            { referenceYear, referenceMonth: { lte: referenceMonth } },
          ],
        },
        orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
        take: 3,
      })
      : Promise.resolve([]),
  ]);

  const taxPerc = Number(ratesFromMonthlyClose?.impostoPerc ?? 0);
  const cardFeePerc = Number(ratesFromMonthlyClose?.taxaCartaoPerc ?? 0);
  const marketplaceFeePerc = Number(ratesFromMonthlyClose?.taxaMarketplacePerc ?? 0);

  const weightedCosts = calcWeightedCostPerc(closesForAverage ?? []);
  const totalCostPerc = weightedCosts.custoFixoPerc + weightedCosts.custoVariavelPerc;
  const marketplaceRatePerc = marketplaceFeePerc;

  const buildTotals = (base: typeof currentSnapshot.totalsBase, periodDays: number): TotalsRow => {
    const net = computeNetRevenueAmount({
      receitaBrutaAmount: base.total,
      vendaCartaoAmount: base.card,
      taxaCartaoPerc: cardFeePerc,
      impostoPerc: taxPerc,
      vendaMarketplaceAmount: base.marketplace,
      taxaMarketplacePerc: marketplaceFeePerc,
    });

    return {
      ...base,
      net,
      estimatedResult: base.total * (1 - totalCostPerc / 100),
      avgTicket: base.count > 0 ? base.total / base.count : 0,
      revenuePerDay: periodDays > 0 ? base.total / periodDays : 0,
      ordersPerDay: periodDays > 0 ? base.count / periodDays : 0,
    };
  };

  const applyChannelNet = (rows: ChannelFinanceRow[]) =>
    rows.map((row) => {
      const taxAmount = row.grossRevenue > 0 ? (row.grossRevenue * taxPerc) / 100 : 0;
      const cardFeeAmount = row.cardRevenue > 0 ? (row.cardRevenue * cardFeePerc) / 100 : 0;
      const marketplaceFeeAmount = row.isMarketplace
        ? (row.grossRevenue * marketplaceRatePerc) / 100
        : 0;

      return {
        ...row,
        taxAmount,
        cardFeeAmount,
        marketplaceFeeAmount,
        netRevenue: row.grossRevenue - taxAmount - cardFeeAmount - marketplaceFeeAmount,
      };
    });

  const summarizeChannelFinance = (rows: ChannelFinanceRow[]) => {
    const marketplaceRevenue = rows
      .filter((row) => row.isMarketplace)
      .reduce((sum, row) => sum + row.grossRevenue, 0);
    const ownRevenue = rows
      .filter((row) => !row.isMarketplace)
      .reduce((sum, row) => sum + row.grossRevenue, 0);
    const marketplaceFeeAmount = rows.reduce((sum, row) => sum + row.marketplaceFeeAmount, 0);
    const marketplaceNetRevenue = rows
      .filter((row) => row.isMarketplace)
      .reduce((sum, row) => sum + row.netRevenue, 0);
    const ownNetRevenue = rows
      .filter((row) => !row.isMarketplace)
      .reduce((sum, row) => sum + row.netRevenue, 0);
    const ownOrders = rows
      .filter((row) => !row.isMarketplace)
      .reduce((sum, row) => sum + row.orders, 0);
    const marketplaceOrders = rows
      .filter((row) => row.isMarketplace)
      .reduce((sum, row) => sum + row.orders, 0);
    const grossRevenue = rows.reduce((sum, row) => sum + row.grossRevenue, 0);

    return {
      ownRevenue,
      ownNetRevenue,
      marketplaceRevenue,
      marketplaceFeeAmount,
      marketplaceNetRevenue,
      ownOrders,
      marketplaceOrders,
      marketplaceSharePerc: grossRevenue > 0 ? (marketplaceRevenue / grossRevenue) * 100 : 0,
      feeOverMarketplacePerc: marketplaceRevenue > 0 ? (marketplaceFeeAmount / marketplaceRevenue) * 100 : 0,
    };
  };

  const currentChannelFinance = applyChannelNet(currentSnapshot.tables.channelFinance);
  const previousChannelFinance = applyChannelNet(previousSnapshot.tables.channelFinance);

  return json({
    dateStr,
    period: {
      current: {
        from: rangeFrom,
        to: rangeTo,
        days: currentSnapshot.periodDays,
        label: formatPeriodLabel(rangeFrom, rangeTo),
      },
      previous: {
        from: prevRangeFrom,
        to: prevRangeTo,
        days: previousSnapshot.periodDays,
        label: formatPeriodLabel(prevRangeFrom, prevRangeTo),
      },
    },
    totals: {
      curr: buildTotals(currentSnapshot.totalsBase, currentSnapshot.periodDays),
      prev: buildTotals(previousSnapshot.totalsBase, previousSnapshot.periodDays),
    },
    tables: {
      byChannel: currentSnapshot.tables.byChannel,
      byChannelPrev: previousSnapshot.tables.byChannel,
      channelFinance: currentChannelFinance,
      channelFinancePrev: previousChannelFinance,
    },
    motoboy: {
      curr: currentSnapshot.delivery,
      prev: previousSnapshot.delivery,
    },
    marketplaceRatePerc,
    channelDashboard: {
      curr: summarizeChannelFinance(currentChannelFinance),
      prev: summarizeChannelFinance(previousChannelFinance),
    },
  });
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function fmtNumber(value: number, digits = 0) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function diffMeta(curr?: number, prev?: number) {
  const current = Number(curr ?? 0);
  const previous = Number(prev ?? 0);

  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return { text: "--", className: "text-muted-foreground" };
  }

  const diff = ((current - previous) / previous) * 100;
  if (diff === 0) return { text: "0,0%", className: "text-slate-500" };

  return {
    text: `${diff > 0 ? "▲" : "▼"} ${fmtNumber(Math.abs(diff), 1)}%`,
    className: diff > 0 ? "text-emerald-600" : "text-red-600",
  };
}

function DeltaPill({
  current,
  previous,
  previousLabel = "Período anterior",
  money = true,
  digits = 0,
  suffix = "",
}: {
  current?: number;
  previous?: number;
  previousLabel?: string;
  money?: boolean;
  digits?: number;
  suffix?: string;
}) {
  const diff = diffMeta(current, previous);
  const previousValue = previous == null ? "--" : money ? fmtMoney(previous) : `${fmtNumber(previous, digits)}${suffix}`;

  return (
    <div className="rounded-lg border bg-slate-50/80 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span>{previousLabel}</span>
        <span className="font-mono">{previousValue}</span>
      </div>
      <div className={cn("mt-1 text-right font-medium", diff.className)}>{diff.text}</div>
    </div>
  );
}

function MetricCard({
  title,
  current,
  previous,
  money = true,
  digits = 0,
  suffix = "",
}: {
  title: string;
  current: number;
  previous: number;
  money?: boolean;
  digits?: number;
  suffix?: string;
}) {
  const currentValue = money ? fmtMoney(current) : `${fmtNumber(current, digits)}${suffix}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-semibold">{currentValue}</div>
        <DeltaPill current={current} previous={previous} money={money} digits={digits} suffix={suffix} />
      </CardContent>
    </Card>
  );
}

type ChannelVisualRow = {
  label: string;
  orders: number;
  grossRevenue: number;
  marketplaceFeeAmount: number;
  netRevenue: number;
  previousGrossRevenue: number;
  previousNetRevenue: number;
  previousMarketplaceFeeAmount: number;
  isMarketplace: boolean;
};

function RichBarRow({

  barWidth,
  netSegmentWidth,
  feeSegmentWidth = "0%",
  barTone = "current",
  metrics,
  footer,
  overlayContent,
}: {

  barWidth: string;
  netSegmentWidth: string;
  feeSegmentWidth?: string;
  barTone?: "current" | "muted";
  metrics: React.ReactNode;
  footer?: React.ReactNode;
  overlayContent?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className={cn("h-8 overflow-hidden rounded-full", barTone === "current" ? "bg-slate-100" : "bg-slate-200")}>
        <div className="relative flex h-full" style={{ width: barWidth }}>
          <div className={cn("h-full", barTone === "current" ? "bg-slate-900" : "bg-slate-500")} style={{ width: netSegmentWidth }} />
          {feeSegmentWidth !== "0%" ? (
            <div className={cn("h-full", barTone === "current" ? "bg-red-400" : "bg-rose-300")} style={{ width: feeSegmentWidth }} />
          ) : null}
          {overlayContent ? (
            <div className="absolute inset-0 flex items-center px-2 text-sm font-medium text-white">
              {overlayContent}
            </div>
          ) : null}
        </div>
      </div>

      {footer ? <div className="text-xs text-slate-500">{footer}</div> : null}

      {metrics}
    </div>
  );
}

function RevenueBarComparison({
  rows,
  title,
}: {
  rows: ChannelVisualRow[];
  title: string;
}) {
  const totalCurrentGross = Math.max(
    1,
    rows.reduce((sum, row) => sum + row.grossRevenue, 0),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-slate-900" />
            <span>Receita após taxa marketplace</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-red-400" />
            <span>Taxa marketplace consumida</span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),minmax(520px,1fr)]">
          <div className="space-y-6">
          {rows.map((row) => {
            const grossWidth = `${(row.grossRevenue / totalCurrentGross) * 100}%`;
            const feeWidth = row.grossRevenue > 0 ? `${(row.marketplaceFeeAmount / row.grossRevenue) * 100}%` : "0%";
            const netWidth = row.grossRevenue > 0 ? `${(row.netRevenue / row.grossRevenue) * 100}%` : "0%";

            return (
              <div key={row.label} className="space-y-2.5">
                <RichBarRow
                  barWidth={grossWidth}
                  netSegmentWidth={netWidth}
                  feeSegmentWidth={row.isMarketplace ? feeWidth : "0%"}
                  footer={`${((row.grossRevenue / totalCurrentGross) * 100).toFixed(1).replace(".", ",")}% da receita no periodo · ${fmtNumber(row.orders, 0)} pedidos`}
                  overlayContent={
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold">{row.label}</span>
                    </div>
                  }
                  metrics={null}
                />

                {row !== rows[rows.length - 1] ? (
                  <div className="border-b border-slate-200 pt-1" />
                ) : null}
              </div>
            );
          })}
          </div>

          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Liquida</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const previousGrossDiff = diffMeta(row.grossRevenue, row.previousGrossRevenue);
                  const previousNetDiff = diffMeta(row.netRevenue, row.previousNetRevenue);
                  const previousFeeDiff = diffMeta(row.marketplaceFeeAmount, row.previousMarketplaceFeeAmount);

                  return (
                    <TableRow key={`${row.label}-table`}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <div className="font-mono">{fmtMoney(row.grossRevenue)}</div>
                          <div className={cn("text-xs font-medium", previousGrossDiff.className)}>{previousGrossDiff.text}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <div className="font-mono">{fmtMoney(row.netRevenue)}</div>
                          <div className={cn("text-xs font-medium", previousNetDiff.className)}>{previousNetDiff.text}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <div className={cn("font-mono", row.isMarketplace ? "text-red-700" : "text-slate-400")}>
                            {row.isMarketplace ? fmtMoney(row.marketplaceFeeAmount) : "--"}
                          </div>
                          <div className={cn("text-xs font-medium", row.isMarketplace ? previousFeeDiff.className : "text-slate-400")}>
                            {row.isMarketplace ? previousFeeDiff.text : "--"}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionFocusedChannelComparison({ report }: { report: MonthlyReportData }) {
  const marketplace = {
    label: "Marketplace",
    gross: report.channelDashboard.curr.marketplaceRevenue,
    net: report.channelDashboard.curr.marketplaceNetRevenue,
    fee: report.channelDashboard.curr.marketplaceFeeAmount,
    orders: report.channelDashboard.curr.marketplaceOrders,
    previousGross: report.channelDashboard.prev.marketplaceRevenue,
    previousNet: report.channelDashboard.prev.marketplaceNetRevenue,
    previousFee: report.channelDashboard.prev.marketplaceFeeAmount,
    previousOrders: report.channelDashboard.prev.marketplaceOrders,
  };
  const otherChannels = {
    label: "Outros canais",
    gross: report.channelDashboard.curr.ownRevenue,
    net: report.channelDashboard.curr.ownNetRevenue,
    fee: 0,
    orders: report.channelDashboard.curr.ownOrders,
    previousGross: report.channelDashboard.prev.ownRevenue,
    previousNet: report.channelDashboard.prev.ownNetRevenue,
    previousFee: 0,
    previousOrders: report.channelDashboard.prev.ownOrders,
  };

  const totalCombinedGross = Math.max(1, marketplace.gross + otherChannels.gross);
  const totalCombinedPrevGross = Math.max(1, marketplace.previousGross + otherChannels.previousGross);
  const marketplaceGrossWidth = `${(marketplace.gross / totalCombinedGross) * 100}%`;
  const marketplaceNetWidth = marketplace.gross > 0 ? `${(marketplace.net / marketplace.gross) * 100}%` : "0%";
  const marketplaceFeeWidth = marketplace.gross > 0 ? `${(marketplace.fee / marketplace.gross) * 100}%` : "0%";
  const otherGrossWidth = `${(otherChannels.gross / totalCombinedGross) * 100}%`;

  const marketplaceGrossDiff = diffMeta(marketplace.gross, marketplace.previousGross);
  const marketplaceNetDiff = diffMeta(marketplace.net, marketplace.previousNet);
  const marketplaceFeeDiff = diffMeta(marketplace.fee, marketplace.previousFee);
  const otherGrossDiff = diffMeta(otherChannels.gross, otherChannels.previousGross);
  const otherNetDiff = diffMeta(otherChannels.net, otherChannels.previousNet);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">
          Marketplace vs outros canais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-slate-900" />
            <span>Receita atual</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-red-400" />
            <span>Taxa marketplace consumida</span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),minmax(460px,1fr)]">
          <div className="space-y-5">
            <RichBarRow
              barWidth={marketplaceGrossWidth}
              netSegmentWidth={marketplaceNetWidth}
              feeSegmentWidth={marketplaceFeeWidth}
              footer={
                <div className="flex flex-col gap-0.5">
                  <span>{((marketplace.gross / totalCombinedGross) * 100).toFixed(1).replace(".", ",")}% da receita no periodo · {fmtNumber(marketplace.orders, 0)} pedidos</span>
                  <span className="text-slate-400">Mês ant.: {((marketplace.previousGross / totalCombinedPrevGross) * 100).toFixed(1).replace(".", ",")}% da receita · {fmtNumber(marketplace.previousOrders, 0)} pedidos</span>
                </div>
              }
              overlayContent={
                <div className="flex min-w-0 items-center gap-4">
                  <span className="truncate font-semibold">{marketplace.label}</span>
                </div>
              }
              metrics={null}
            />

            <RichBarRow
              barWidth={otherGrossWidth}
              netSegmentWidth="100%"
              feeSegmentWidth="0%"
              footer={
                <div className="flex flex-col gap-0.5">
                  <span>{((otherChannels.gross / totalCombinedGross) * 100).toFixed(1).replace(".", ",")}% da receita no periodo · {fmtNumber(otherChannels.orders, 0)} pedidos</span>
                  <span className="text-slate-400">Mês ant.: {((otherChannels.previousGross / totalCombinedPrevGross) * 100).toFixed(1).replace(".", ",")}% da receita · {fmtNumber(otherChannels.previousOrders, 0)} pedidos</span>
                </div>
              }
              overlayContent={
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold">{otherChannels.label}</span>
                </div>
              }
              metrics={null}
            />
          </div>


          <div>
          <Table>
            <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Liquida</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Marketplace</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <div className="font-mono">{fmtMoney(marketplace.gross)}</div>
                    <div className={cn("text-xs font-medium", marketplaceGrossDiff.className)}>{marketplaceGrossDiff.text}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <div className="font-mono">{fmtMoney(marketplace.net)}</div>
                    <div className={cn("text-xs font-medium", marketplaceNetDiff.className)}>{marketplaceNetDiff.text}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-red-700">
                  <div className="flex flex-col items-end">
                    <div>{fmtMoney(marketplace.fee)}</div>
                    <div className={cn("text-xs font-medium", marketplaceFeeDiff.className)}>{marketplaceFeeDiff.text}</div>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Outros canais</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <div className="font-mono">{fmtMoney(otherChannels.gross)}</div>
                    <div className={cn("text-xs font-medium", otherGrossDiff.className)}>{otherGrossDiff.text}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <div className="font-mono">{fmtMoney(otherChannels.net)}</div>
                    <div className={cn("text-xs font-medium", otherNetDiff.className)}>{otherNetDiff.text}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-slate-400">--</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          </div>
        </div>



      </CardContent>
    </Card>
  );
}

function DetailedChannelChart({
  rows,
  previousRows,
}: {
  rows: ChannelFinanceRow[];
  previousRows: ChannelFinanceRow[];
}) {
  const previousIndex = Object.fromEntries(previousRows.map((row) => [row.channel, row]));
  const visualRows: ChannelVisualRow[] = rows.map((row) => {
    const previous = previousIndex[row.channel];

    return {
      label: row.channel,
      orders: row.orders,
      grossRevenue: row.grossRevenue,
      marketplaceFeeAmount: row.marketplaceFeeAmount,
      netRevenue: row.netRevenue,
      previousGrossRevenue: previous?.grossRevenue ?? 0,
      previousNetRevenue: previous?.netRevenue ?? 0,
      previousMarketplaceFeeAmount: previous?.marketplaceFeeAmount ?? 0,
      isMarketplace: row.isMarketplace,
    };
  });

  return <RevenueBarComparison title="Receita detalhada por canal" rows={visualRows} />;
}

function ChannelMixDashboard({ report }: { report: MonthlyReportData }) {
  return (
    <div className="space-y-6">
      <DecisionFocusedChannelComparison report={report} />

      <DetailedChannelChart rows={report.tables.channelFinance} previousRows={report.tables.channelFinancePrev} />
    </div>
  );
}

function OperativoFinanceiroSection({ report }: { report: MonthlyReportData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Receita bruta" current={report.totals.curr.total} previous={report.totals.prev.total} />
        <MetricCard title="Receita líquida" current={report.totals.curr.net} previous={report.totals.prev.net} />
        <MetricCard
          title="Resultado estimado"
          current={report.totals.curr.estimatedResult}
          previous={report.totals.prev.estimatedResult}
        />
        <MetricCard
          title="Pedidos"
          current={report.totals.curr.count}
          previous={report.totals.prev.count}
          money={false}
        />
        <MetricCard
          title="Ticket médio"
          current={report.totals.curr.avgTicket}
          previous={report.totals.prev.avgTicket}
        />
        <MetricCard
          title="Receita por dia"
          current={report.totals.curr.revenuePerDay}
          previous={report.totals.prev.revenuePerDay}
        />
        <MetricCard
          title="Pedidos por dia"
          current={report.totals.curr.ordersPerDay}
          previous={report.totals.prev.ordersPerDay}
          money={false}
          digits={1}
        />
        <MetricCard
          title="Receita marketplace"
          current={report.totals.curr.marketplace}
          previous={report.totals.prev.marketplace}
        />
      </div>

      <ChannelMixDashboard report={report} />
    </div>
  );
}

export default function RelatorioMensalKdsPage() {
  const report = useLoaderData<typeof loader>();
  const location = useLocation();
  const isMotoboyPage = location.pathname.endsWith("/motoboy-entregas");
  const search = location.search;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Relatórios do período</h1>
            <p className="text-sm text-muted-foreground">
              Atual: {report.period.current.label}
            </p>
            <p className="text-sm text-muted-foreground">
              Comparativo: {report.period.previous.label}
            </p>
          </div>

          <Form method="get" className="grid gap-3 rounded-xl border bg-slate-50/70 p-3 md:grid-cols-[180px,180px,auto,auto] md:items-end">
            <div className="space-y-1">
              <label htmlFor="from" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                De
              </label>
              <Input id="from" name="from" type="date" defaultValue={report.period.current.from} />
            </div>
            <div className="space-y-1">
              <label htmlFor="to" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Até
              </label>
              <Input id="to" name="to" type="date" defaultValue={report.period.current.to} />
            </div>
            <Button type="submit">Aplicar período</Button>
            <Button asChild type="button" variant="outline">
              <NavLink to={location.pathname}>Limpar filtro</NavLink>
            </Button>
          </Form>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard title="Receita bruta" current={report.totals.curr.total} previous={report.totals.prev.total} />
          <MetricCard title="Pedidos" current={report.totals.curr.count} previous={report.totals.prev.count} money={false} />
          <MetricCard
            title="Entregas com motoboy"
            current={report.motoboy.curr.deliveries}
            previous={report.motoboy.prev.deliveries}
            money={false}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <NavLink
            to={{ pathname: ".", search }}
            end
            className={({ isActive }) =>
              cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )
            }
          >
            Operativo / Financeiro
          </NavLink>
          <NavLink
            to={{ pathname: "motoboy-entregas", search }}
            className={({ isActive }) =>
              cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )
            }
          >
            Motoboy / Entregas
          </NavLink>
        </div>
      </div>

      {isMotoboyPage ? <Outlet context={{ report }} /> : <OperativoFinanceiroSection report={report} />}
    </div>
  );
}
