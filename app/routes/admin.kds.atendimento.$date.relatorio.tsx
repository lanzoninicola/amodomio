// app/routes/admin.kds.atendimento.$date.relatorio.tsx
import { json, MetaFunction, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { isValidYMD, ymdToDateInt, todayLocalYMD } from "@/domain/kds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeNetRevenueAmount } from "~/domain/finance/compute-net-revenue-amount";
import { getDailyAggregates, listMotoboy } from "~/domain/kds/server/repository.server";
import prisma from "~/lib/prisma/client.server";

/** ===================== META ===================== **/
export const meta: MetaFunction = () => {
  return [{ title: "KDS | Relatórios" }];
};

/** ===================== Utils ===================== **/
// util: YMD +/- days em timezone-safe (usa meio-dia para evitar shift)
function addDaysYMD(ymd: string, delta: number) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ===================== LOADER ===================== **/
export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = isValidYMD(params.date) ? params.date : todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);

  const prevDayStr = addDaysYMD(dateStr, -1);
  const prevWeekStr = addDaysYMD(dateStr, -7);

  const prevDayInt = ymdToDateInt(prevDayStr);
  const prevWeekInt = ymdToDateInt(prevWeekStr);

  const [agg, aggPrev, aggWeek, motoList, finance] = await Promise.all([
    getDailyAggregates(dateInt),
    getDailyAggregates(prevDayInt),
    getDailyAggregates(prevWeekInt),
    listMotoboy(dateInt),
    prisma.financialSummary.findFirst({
      where: { isSnapshot: false },
      select: { taxaCartaoPerc: true, impostoPerc: true, taxaMarketplacePerc: true },
    }),
  ]);

  const taxPerc = Number(finance?.impostoPerc ?? 0);
  const cardFeePerc = Number(finance?.taxaCartaoPerc ?? 0);
  const taxaMarketplacePerc = Number(finance?.taxaMarketplacePerc ?? 0);

  const netAmount = computeNetRevenueAmount({
    receitaBrutaAmount: agg.total,
    vendaCartaoAmount: agg.card ?? 0,
    taxaCartaoPerc: cardFeePerc,
    impostoPerc: taxPerc,
    vendaMarketplaceAmount: agg.marketplace ?? 0,
    taxaMarketplacePerc,
  });
  const netWeekAmount = computeNetRevenueAmount({
    receitaBrutaAmount: aggWeek.total,
    vendaCartaoAmount: aggWeek.card ?? 0,
    taxaCartaoPerc: cardFeePerc,
    impostoPerc: taxPerc,
    vendaMarketplaceAmount: aggWeek.marketplace ?? 0,
    taxaMarketplacePerc,
  });

  return json({
    dateStr,
    agg,
    aggPrev,
    aggWeek,
    netAmount,
    netWeekAmount,
    motoList,
  });
}

/** ===================== Tipos ===================== **/
type AggRow = { k: string; count: number; total: number; moto: number };

/** ===================== Página ===================== **/
export default function RelatorioKdsPage() {
  const { agg, aggPrev, aggWeek, netAmount, netWeekAmount, motoList } = useLoaderData<typeof loader>();

  const fmt = (n: number) =>
    Number(n ?? 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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
    const value =
      ref === undefined || ref === null
        ? "--"
        : money
          ? `R$ ${fmt(ref)}`
          : `${ref}`;
    return (
      <div className="px-3 py-2 rounded border text-[11px] sm:text-xs">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="opacity-70">{label}:</span>
          <span className="font-mono">{value}</span>
        </div>
        <div className={`mt-1 text-right font-medium ${diff.cls}`}>{diff.text}</div>
      </div>
    );
  };

  // Mapa auxiliar para lookup por chave (canal/status)
  const indexRows = (rows: AggRow[] = []) =>
    Object.fromEntries(rows.map((r) => [r.k, r]));

  const prevByChannel = indexRows(aggPrev?.byChannel ?? []);
  const weekByChannel = indexRows(aggWeek?.byChannel ?? []);
  const prevByStatus = indexRows(aggPrev?.byStatus ?? []);
  const weekByStatus = indexRows(aggWeek?.byStatus ?? []);

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* Cards topo com comparativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Faturamento do dia</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Líquido</div>
                <div className="text-2xl sm:text-3xl font-mono text-emerald-600">R$ {fmt(netAmount)}</div>
                {compBadge("Sem. passada", netAmount, netWeekAmount, true)}
              </div>
              <div className="">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Bruto</div>
                <div className="text-2xl sm:text-3xl font-mono">R$ {fmt(agg.total)}</div>
                {compBadge("Sem. passada", agg.total, aggWeek?.total, true)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Total Moto</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl sm:text-3xl font-mono">R$ {fmt(agg.moto)}</div>
            <div className="grid grid-cols-1 gap-2">
              {compBadge("Sem. passada", agg.moto, aggWeek?.moto, true)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Nº pedidos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl sm:text-3xl font-mono">{agg.count}</div>
            <div className="grid grid-cols-1 gap-2">
              {compBadge("Sem. passada", agg.count, aggWeek?.count, false)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com rolagem horizontal no mobile */}
      <Tabs defaultValue="financeiro" className="w-full">
        <div className="-mx-2 sm:mx-0">
          <div className="overflow-x-auto no-scrollbar">
            <TabsList className="min-w-max w-full sm:w-auto">
              <TabsTrigger value="financeiro" className="text-sm sm:text-base">Financeiro</TabsTrigger>
              <TabsTrigger value="motoboy" className="text-sm sm:text-base">Motoboy</TabsTrigger>
              <TabsTrigger value="extras" className="text-sm sm:text-base">Extras</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="financeiro" className="space-y-6">
          {/* Wrap para scroll horizontal no mobile */}
          <div className="grid grid-cols-1 gap-6">
            {/* Por canal */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Por canal</CardTitle></CardHeader>
              <CardContent className="-mx-2 sm:mx-0">
                <div className="overflow-x-auto rounded border sm:border-0">
                  <table className="w-full min-w-[560px] text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left border-b sticky top-0 bg-background">
                        <th className="py-2 px-2">Canal</th>
                        <th className="py-2 px-2 text-right">Pedidos</th>
                        <th className="py-2 px-2 text-right">Faturamento bruto (R$)</th>
                        <th className="py-2 px-2 text-right">Sem. passada</th>
                        <th className="py-2 px-2 text-right">Δ Sem.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(agg.byChannel as AggRow[]).map((r) => {
                        const p = prevByChannel[r.k];
                        const w = weekByChannel[r.k];
                        const d1 = pctDiff(r.total, p?.total);
                        const d7 = pctDiff(r.total, w?.total);
                        return (
                          <tr key={r.k} className="border-b last:border-0">
                            <td className="py-2 px-2">{r.k}</td>
                            <td className="py-2 px-2 text-right text-slate-500">{r.count}</td>
                            <td className="py-2 px-2 text-right font-mono">{fmt(r.total)}</td>
                            <td className="py-2 px-2 text-right font-mono">
                              {w?.total != null ? fmt(w.total) : "--"}
                            </td>
                            <td className={`py-2 px-2 text-right font-medium ${d7.cls}`}>{d7.text}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* (opcional) Por status — mantive comentado como no original avançado */}
            {/*
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Por status</CardTitle></CardHeader>
              <CardContent className="-mx-2 sm:mx-0">
                <div className="overflow-x-auto rounded border sm:border-0">
                  <table className="w-full min-w-[640px] text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left border-b sticky top-0 bg-background">
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 text-right">Pedidos</th>
                        <th className="py-2 px-2 text-right">Faturamento bruto (R$)</th>
                        <th className="py-2 px-2 text-right">Sem. passada</th>
                        <th className="py-2 px-2 text-right">Δ Sem.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(agg.byStatus as AggRow[]).map((r) => {
                        const w = weekByStatus[r.k];
                        const d7 = pctDiff(r.total, w?.total);
                        return (
                          <tr key={r.k} className="border-b last:border-0">
                            <td className="py-2 px-2">{r.k}</td>
                            <td className="py-2 px-2 text-right text-slate-500">{r.count}</td>
                            <td className="py-2 px-2 text-right font-mono">{fmt(r.total)}</td>
                            <td className="py-2 px-2 text-right font-mono">
                              {w?.total != null ? fmt(w.total) : "--"}
                            </td>
                            <td className={`py-2 px-2 text-right font-medium ${d7.cls}`}>{d7.text}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            */}
          </div>
        </TabsContent>

        <TabsContent value="motoboy" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Resumo Motoboy</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-2 rounded border text-xs sm:text-sm">
                Entregas: <b>{motoList.length}</b>
              </div>
              <div className="px-3 py-2 rounded border text-xs sm:text-sm">
                Moto (R$):{" "}
                <b className="font-mono">
                  R{"$ "}
                  {fmt(
                    motoList.reduce((s: number, o: any) => s + Number(o.motoValue ?? 0), 0)
                  )}
                </b>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Lista</CardTitle></CardHeader>
            <CardContent className="-mx-2 sm:mx-0">
              <div className="overflow-x-auto rounded border sm:border-0">
                <table className="w-full min-w-[520px] text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left border-b sticky top-0 bg-background">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Canal</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2 text-right">Pedido (R$)</th>
                      <th className="py-2 px-2 text-right">Moto (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motoList.map((o: any, idx: number) => (
                      <tr key={o.id} className="border-b last:border-0">
                        <td className="py-2 px-2">
                          {o.commandNumber ?? (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-5 h-5 rounded-full border border-dashed inline-flex items-center justify-center text-[10px]">
                                VL
                              </span>{" "}
                              {idx + 1}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2">{o.channel ?? "-"}</td>
                        <td className="py-2 px-2">{o.status ?? "-"}</td>
                        <td className="py-2 px-2 text-right font-mono">
                          {fmt(Number(o.orderAmount ?? 0))}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {fmt(Number(o.motoValue ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extras">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Em breve</CardTitle></CardHeader>
            <CardContent className="text-sm sm:text-base">Outros relatórios consolidados do dia.</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
