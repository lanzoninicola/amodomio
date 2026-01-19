// app/routes/admin.kds.atendimento.$date.relatorio-mes.tsx
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { todayLocalYMD, ymdToDateInt } from "@/domain/kds";
import { computeNetRevenueAmount } from "~/domain/finance/compute-net-revenue-amount";
import { getDailyAggregates, listMotoboy } from "~/domain/kds/server/repository.server";
import prisma from "~/lib/prisma/client.server";

/* =========================
 * Meta
 * ========================= */
export const meta: MetaFunction = () => {
  return [{ title: "KDS | Relatório Mensal" }];
};

/* =========================
 * Helpers de data (timezone-safe)
 * ========================= */
function ymdParts(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  const yNum = Number.isFinite(y) ? y : new Date().getFullYear();
  const mIdx = Number.isFinite(m) ? m - 1 : 0; // 0-11
  return { y: yNum, mIdx };
}
function ymdFmt(y: number, mIdx: number, d: number) {
  const yy = String(y).padStart(4, "0");
  const mm = String(mIdx + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function firstDayOfMonth(ymd: string) {
  const { y, mIdx } = ymdParts(ymd);
  return ymdFmt(y, mIdx, 1);
}
function lastDayOfMonth(ymd: string) {
  const { y, mIdx } = ymdParts(ymd);
  const last = new Date(y, mIdx + 1, 0); // último dia do mês
  return ymdFmt(last.getFullYear(), last.getMonth(), last.getDate());
}
function firstDayOfPrevMonth(ymd: string) {
  const { y, mIdx } = ymdParts(ymd);
  const pm = mIdx === 0 ? 11 : mIdx - 1;
  const py = mIdx === 0 ? y - 1 : y;
  return ymdFmt(py, pm, 1);
}
function lastDayOfPrevMonth(ymd: string) {
  const firstPrev = firstDayOfPrevMonth(ymd);
  // seguro contra timezone: usa year/mês numérico
  const { y, mIdx } = ymdParts(firstPrev);
  const last = new Date(y, mIdx + 1, 0);
  return ymdFmt(last.getFullYear(), last.getMonth(), last.getDate());
}
function* iterateYMD(fromYMD: string, toYMD: string) {
  // usa T12:00 para evitar rollback de dia por timezone
  const start = new Date(`${fromYMD}T12:00:00`);
  const end = new Date(`${toYMD}T12:00:00`);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    yield `${yy}-${mm}-${dd}`;
  }
}

/* =========================
 * Tipos locais
 * ========================= */
type AggRow = { k: string; count: number; total: number; moto: number };
type DailyAgg = {
  total: number;
  moto: number;
  count: number;
  card: number;
  marketplace: number;
  byChannel: AggRow[];
  byStatus: AggRow[];
};

/* =========================
 * Loader
 * ========================= */
export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();

  // mês atual (com base no :date)
  const monthStart = firstDayOfMonth(dateStr);
  const monthEnd = lastDayOfMonth(dateStr);

  // mês anterior ao :date
  const prevMonthStart = firstDayOfPrevMonth(dateStr);
  const prevMonthEnd = lastDayOfPrevMonth(dateStr);

  const ymdsCurr = Array.from(iterateYMD(monthStart, monthEnd));
  const ymdsPrev = Array.from(iterateYMD(prevMonthStart, prevMonthEnd));

  const dateIntsCurr = ymdsCurr.map(ymdToDateInt);
  const dateIntsPrev = ymdsPrev.map(ymdToDateInt);

  // Carrega agregados diários (financeiro) e listas de motoboy para os dois meses
  const [aggsCurr, motoCurr, aggsPrev, motoPrev, finance] = await Promise.all([
    Promise.all(dateIntsCurr.map((di) => getDailyAggregates(di))) as Promise<DailyAgg[]>,
    Promise.all(dateIntsCurr.map((di) => listMotoboy(di))) as Promise<any[][]>,
    Promise.all(dateIntsPrev.map((di) => getDailyAggregates(di))) as Promise<DailyAgg[]>,
    Promise.all(dateIntsPrev.map((di) => listMotoboy(di))) as Promise<any[][]>,
    prisma.financialSummary.findFirst({
      where: { isSnapshot: false },
      select: { taxaCartaoPerc: true, impostoPerc: true, taxaMarketplacePerc: true },
    }),
  ]);

  // Redução mensal (totais simples)
  const reduceTotals = (aggs: DailyAgg[]) => ({
    total: aggs.reduce((s, a) => s + Number(a?.total ?? 0), 0),
    moto: aggs.reduce((s, a) => s + Number(a?.moto ?? 0), 0),
    count: aggs.reduce((s, a) => s + Number(a?.count ?? 0), 0),
    card: aggs.reduce((s, a) => s + Number(a?.card ?? 0), 0),
    marketplace: aggs.reduce((s, a) => s + Number(a?.marketplace ?? 0), 0),
  });
  const totalsCurr = reduceTotals(aggsCurr);
  const totalsPrev = reduceTotals(aggsPrev);

  const taxPerc = Number(finance?.impostoPerc ?? 0);
  const cardFeePerc = Number(finance?.taxaCartaoPerc ?? 0);
  const taxaMarketplacePerc = Number(finance?.taxaMarketplacePerc ?? 0);

  const netCurr = computeNetRevenueAmount({
    receitaBrutaAmount: totalsCurr.total,
    vendaCartaoAmount: totalsCurr.card,
    taxaCartaoPerc: cardFeePerc,
    impostoPerc: taxPerc,
    vendaMarketplaceAmount: totalsCurr.marketplace,
    taxaMarketplacePerc,
  });
  const netPrev = computeNetRevenueAmount({
    receitaBrutaAmount: totalsPrev.total,
    vendaCartaoAmount: totalsPrev.card,
    taxaCartaoPerc: cardFeePerc,
    impostoPerc: taxPerc,
    vendaMarketplaceAmount: totalsPrev.marketplace,
    taxaMarketplacePerc,
  });

  // Redução mensal (por canal / por status)
  const sumMap = (rows: AggRow[] = [], map = new Map<string, AggRow>()) => {
    for (const r of rows) {
      const cur = map.get(r.k) ?? { k: r.k, count: 0, total: 0, moto: 0 };
      cur.count += Number(r.count ?? 0);
      cur.total += Number(r.total ?? 0);
      cur.moto += Number(r.moto ?? 0);
      map.set(r.k, cur);
    }
    return map;
  };

  const byChannelMapCurr = aggsCurr.reduce((map, a) => sumMap(a?.byChannel ?? [], map), new Map<string, AggRow>());
  const byStatusMapCurr = aggsCurr.reduce((map, a) => sumMap(a?.byStatus ?? [], map), new Map<string, AggRow>());
  const byChannelCurr = Array.from(byChannelMapCurr.values()).sort((a, b) => b.total - a.total);
  const byStatusCurr = Array.from(byStatusMapCurr.values()).sort((a, b) => b.total - a.total);

  const byChannelMapPrev = aggsPrev.reduce((map, a) => sumMap(a?.byChannel ?? [], map), new Map<string, AggRow>());
  const byStatusMapPrev = aggsPrev.reduce((map, a) => sumMap(a?.byStatus ?? [], map), new Map<string, AggRow>());
  const byChannelPrev = Array.from(byChannelMapPrev.values()).sort((a, b) => b.total - a.total);
  const byStatusPrev = Array.from(byStatusMapPrev.values()).sort((a, b) => b.total - a.total);

  // Motoboy mensal (contagem + soma do motoValue das listas)
  const reduceMoto = (lists: any[][]) => ({
    deliveries: lists.reduce((s, list) => s + list.length, 0),
    motoFromLists: lists.reduce(
      (s, list) => s + list.reduce((ss: number, o: any) => ss + Number(o?.motoValue ?? 0), 0),
      0
    ),
  });
  const motoMonthCurr = reduceMoto(motoCurr);
  const motoMonthPrev = reduceMoto(motoPrev);

  return json({
    dateStr,
    // labels e intervalos
    monthStart,
    monthEnd,
    monthLabel: new Date(`${monthStart}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    prevMonthStart,
    prevMonthEnd,
    prevMonthLabel: new Date(`${prevMonthStart}T12:00:00`).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),

    // totais
    totals: {
      curr: { ...totalsCurr, net: netCurr },
      prev: { ...totalsPrev, net: netPrev },
    },

    // tabelas
    tables: {
      byChannel: { curr: byChannelCurr, prev: byChannelPrev },
      byStatus: { curr: byStatusCurr, prev: byStatusPrev },
    },

    // motoboy
    motoboy: {
      curr: { ...motoMonthCurr, motoFromAgg: totalsCurr.moto },
      prev: { ...motoMonthPrev, motoFromAgg: totalsPrev.moto },
    },
  });
}

/* =========================
 * Página
 * ========================= */
export default function RelatorioMensalKdsPage() {
  const data = useLoaderData<typeof loader>();
  const fmt = (n: number) =>
    Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pctDiff = (curr?: number, ref?: number) => {
    const c = Number(curr ?? 0);
    const r = Number(ref ?? 0);
    if (!isFinite(c) || !isFinite(r) || r === 0) return { text: "--", cls: "text-muted-foreground" };
    const p = ((c - r) / r) * 100;
    const sign = p > 0 ? "▲" : p < 0 ? "▼" : "▲";
    const color = p > 0 ? "text-emerald-600" : p < 0 ? "text-red-600" : "text-slate-500";
    return { text: `${sign} ${Math.abs(p).toFixed(1)}%`, cls: color };
  };

  const compBadge = (label: string, curr?: number, ref?: number, money = true) => {
    const diff = pctDiff(curr, ref);
    const value = ref == null ? "--" : money ? `R$ ${fmt(ref)}` : `${ref}`;
    return (
      <div className="px-3 py-2 rounded border text-xs">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="opacity-70">{label}:</span>
          <span className="font-mono">{value}</span>
        </div>
        <div className={`mt-1 text-right font-medium ${diff.cls}`}>{diff.text}</div>
      </div>
    );
  };

  // index para lookup por chave (canal/status) do mês anterior
  type Row = { k: string; count: number; total: number; moto: number };
  const indexRows = (rows: Row[] = []) => Object.fromEntries(rows.map((r) => [r.k, r]));
  const prevByChannel = indexRows(data.tables.byChannel.prev);
  const prevByStatus = indexRows(data.tables.byStatus.prev);

  return (
    <div className="space-y-6">
      {/* Header Mês */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Relatório do mês</h1>
          <div className="text-sm text-muted-foreground">
            {data.monthLabel} · {data.monthStart} → {data.monthEnd}
          </div>
          <div className="text-xs text-muted-foreground">
            Comparado a {data.prevMonthLabel} · {data.prevMonthStart} → {data.prevMonthEnd}
          </div>
        </div>
      </div>

      {/* Cards topo com comparativo mês anterior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Líquido</div>
                <div className="text-2xl font-mono text-emerald-600">R$ {fmt(data.totals.curr.net)}</div>
                {compBadge("Mês anterior", data.totals.curr.net, data.totals.prev.net, true)}
              </div>
              <div className="">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Bruto</div>
                <div className="text-2xl font-mono">R$ {fmt(data.totals.curr.total)}</div>
                {compBadge("Mês anterior", data.totals.curr.total, data.totals.prev.total, true)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Moto (mês)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-mono">R$ {fmt(data.totals.curr.moto)}</div>
            {compBadge("Mês anterior", data.totals.curr.moto, data.totals.prev.moto, true)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nº pedidos (mês)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-mono">{data.totals.curr.count}</div>
            {compBadge("Mês anterior", data.totals.curr.count, data.totals.prev.count, false)}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financeiro" className="w-full">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="motoboy">Motoboy</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
        </TabsList>

        {/* ====== Financeiro ====== */}
        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Por canal */}
            <Card>
              <CardHeader>
                <CardTitle>Por canal (mês)</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Canal</th>
                      <th className="py-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Faturamento bruto (R$)</th>
                      <th className="py-2 text-right">Mês anterior (R$)</th>
                      <th className="py-2 text-right">Δ mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tables.byChannel.curr.map((r) => {
                      const p = prevByChannel[r.k];
                      const d = pctDiff(r.total, p?.total);
                      return (
                        <tr key={r.k} className="border-b last:border-0">
                          <td className="py-2">{r.k}</td>
                          <td className="py-2 text-right text-slate-500">{r.count}</td>
                          <td className="py-2 text-right font-mono">{fmt(r.total)}</td>
                          <td className="py-2 text-right font-mono">{p?.total != null ? fmt(p.total) : "--"}</td>
                          <td className={`py-2 text-right font-medium ${d.cls}`}>{d.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Por status */}
            <Card>
              <CardHeader>
                <CardTitle>Por status (mês)</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Faturamento bruto (R$)</th>
                      <th className="py-2 text-right">Mês anterior (R$)</th>
                      <th className="py-2 text-right">Δ mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tables.byStatus.curr.map((r) => {
                      const p = prevByStatus[r.k];
                      const d = pctDiff(r.total, p?.total);
                      return (
                        <tr key={r.k} className="border-b last:border-0">
                          <td className="py-2">{r.k}</td>
                          <td className="py-2 text-right text-slate-500">{r.count}</td>
                          <td className="py-2 text-right font-mono">{fmt(r.total)}</td>
                          <td className="py-2 text-right font-mono">{p?.total != null ? fmt(p.total) : "--"}</td>
                          <td className={`py-2 text-right font-medium ${d.cls}`}>{d.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====== Motoboy ====== */}
        <TabsContent value="motoboy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo Motoboy (mês)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 text-sm">
              <div className="px-3 py-2 rounded border">
                Entregas: <b>{data.motoboy.curr.deliveries}</b>
              </div>
              <div className="px-3 py-2 rounded border">
                Moto (listas): <b className="font-mono">R$ {fmt(data.motoboy.curr.motoFromLists)}</b>
              </div>
              <div className="px-3 py-2 rounded border">
                Moto (agregados): <b className="font-mono">R$ {fmt(data.motoboy.curr.motoFromAgg)}</b>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparativo mês anterior (Motoboy)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md-grid-cols-3 md:grid-cols-3 gap-3 text-sm">
              <div className="px-3 py-2 rounded border">
                <div className="opacity-70">Entregas (mês anterior)</div>
                <div className="font-mono">{data.motoboy.prev.deliveries}</div>
                <div
                  className={`mt-1 text-xs font-medium ${pctDiff(
                    data.motoboy.curr.deliveries,
                    data.motoboy.prev.deliveries
                  ).cls}`}
                >
                  {pctDiff(data.motoboy.curr.deliveries, data.motoboy.prev.deliveries).text}
                </div>
              </div>
              <div className="px-3 py-2 rounded border">
                <div className="opacity-70">Moto listas (mês anterior)</div>
                <div className="font-mono">R$ {fmt(data.motoboy.prev.motoFromLists)}</div>
                <div
                  className={`mt-1 text-xs font-medium ${pctDiff(
                    data.motoboy.curr.motoFromLists,
                    data.motoboy.prev.motoFromLists
                  ).cls}`}
                >
                  {pctDiff(data.motoboy.curr.motoFromLists, data.motoboy.prev.motoFromLists).text}
                </div>
              </div>
              <div className="px-3 py-2 rounded border">
                <div className="opacity-70">Moto agregados (mês anterior)</div>
                <div className="font-mono">R$ {fmt(data.motoboy.prev.motoFromAgg)}</div>
                <div
                  className={`mt-1 text-xs font-medium ${pctDiff(
                    data.motoboy.curr.motoFromAgg,
                    data.motoboy.prev.motoFromAgg
                  ).cls}`}
                >
                  {pctDiff(data.motoboy.curr.motoFromAgg, data.motoboy.prev.motoFromAgg).text}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== Extras ====== */}
        <TabsContent value="extras">
          <Card>
            <CardHeader>
              <CardTitle>Em breve</CardTitle>
            </CardHeader>
            <CardContent>Outros relatórios consolidados do mês.</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
