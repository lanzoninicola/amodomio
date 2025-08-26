import { json, MetaFunction, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ymdToDateInt, todayLocalYMD } from "@/domain/kds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDailyAggregates, listMotoboy } from "~/domain/kds/server/repository.server";

export const meta: MetaFunction = () => {
  return [{ title: "KDS | Relatorios" }];
};

// util: YMD +/- days em timezone-safe (usa meio-dia para evitar shift)
function addDaysYMD(ymd: string, delta: number) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);

  const prevDayStr = addDaysYMD(dateStr, -1);
  const prevWeekStr = addDaysYMD(dateStr, -7);

  const prevDayInt = ymdToDateInt(prevDayStr);
  const prevWeekInt = ymdToDateInt(prevWeekStr);

  const [agg, aggPrev, aggWeek, motoList] = await Promise.all([
    getDailyAggregates(dateInt),
    getDailyAggregates(prevDayInt),
    getDailyAggregates(prevWeekInt),
    listMotoboy(dateInt),
  ]);

  return json({
    dateStr,
    agg,
    aggPrev,
    aggWeek,
    motoList,
  });
}

type AggRow = { k: string; count: number; total: number; moto: number };

export default function RelatorioKdsPage() {
  const { agg, aggPrev, aggWeek, motoList } = useLoaderData<typeof loader>();

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
    const color =
      p > 0 ? "text-emerald-600" : p < 0 ? "text-red-600" : "text-slate-500";
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
      <div className="grid grid-cols-3 px-3 py-2 rounded border text-xs items-center">
        <span className="opacity-70">{label}:</span>
        <span className="font-mono">{value}</span>
        <span className={`ml-2 font-medium ${diff.cls}`}>{diff.text}</span>
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
    <div className="space-y-6">
      {/* Cards topo com comparativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle>Faturamento do dia</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-mono">R$ {fmt(agg.total)}</div>
            <div className="grid grid-cols-1 gap-2">
              {compBadge("Ontem", agg.total, aggPrev?.total, true)}
              {compBadge("Sem. passada", agg.total, aggWeek?.total, true)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Total Moto</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-mono">R$ {fmt(agg.moto)}</div>
            <div className="grid grid-cols-1 gap-2">
              {compBadge("Ontem", agg.moto, aggPrev?.moto, true)}
              {compBadge("Sem. passada", agg.moto, aggWeek?.moto, true)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Nº pedidos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-mono">{agg.count}</div>
            <div className="grid grid-cols-1 gap-2">
              {compBadge("Ontem", agg.count, aggPrev?.count, false)}
              {compBadge("Sem. passada", agg.count, aggWeek?.count, false)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financeiro" className="w-full">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="motoboy">Motoboy</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Por canal */}
            <Card>
              <CardHeader><CardTitle>Por canal</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Canal</th>
                      <th className="py-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Faturamento (R$)</th>
                      {/* <th className="py-2 text-right">Moto (R$)</th> */}
                      <th className="py-2 text-right">Ontem</th>
                      <th className="py-2 text-right">Δ Ontem</th>
                      <th className="py-2 text-right">Sem. passada</th>
                      <th className="py-2 text-right">Δ Sem.</th>
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
                          <td className="py-2">{r.k}</td>
                          <td className="py-2 text-right text-slate-500">{r.count}</td>
                          <td className="py-2 text-right font-mono">{fmt(r.total)}</td>
                          {/* <td className="py-2 text-right font-mono">{fmt(r.moto)}</td> */}

                          <td className="py-2 text-right font-mono">
                            {p?.total != null ? fmt(p.total) : "--"}
                          </td>
                          <td className={`py-2 text-right font-medium ${d1.cls}`}>{d1.text}</td>

                          <td className="py-2 text-right font-mono">
                            {w?.total != null ? fmt(w.total) : "--"}
                          </td>
                          <td className={`py-2 text-right font-medium ${d7.cls}`}>{d7.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Por status */}
            {/* <Card>
              <CardHeader><CardTitle>Por status</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Faturamento (R$)</th>
                      <th className="py-2 text-right">Moto (R$)</th>
                      <th className="py-2 text-right">Ontem</th>
                      <th className="py-2 text-right">Δ Ontem</th>
                      <th className="py-2 text-right">Sem. passada</th>
                      <th className="py-2 text-right">Δ Sem.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agg.byStatus as AggRow[]).map((r) => {
                      const p = prevByStatus[r.k];
                      const w = weekByStatus[r.k];
                      const d1 = pctDiff(r.total, p?.total);
                      const d7 = pctDiff(r.total, w?.total);
                      return (
                        <tr key={r.k} className="border-b last:border-0">
                          <td className="py-2">{r.k}</td>
                          <td className="py-2 text-right text-slate-500">{r.count}</td>
                          <td className="py-2 text-right font-mono">{fmt(r.total)}</td>
                          <td className="py-2 text-right font-mono">{fmt(r.moto)}</td>

                          <td className="py-2 text-right font-mono">
                            {p?.total != null ? fmt(p.total) : "--"}
                          </td>
                          <td className={`py-2 text-right font-medium ${d1.cls}`}>{d1.text}</td>

                          <td className="py-2 text-right font-mono">
                            {w?.total != null ? fmt(w.total) : "--"}
                          </td>
                          <td className={`py-2 text-right font-medium ${d7.cls}`}>{d7.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card> */}
          </div>
        </TabsContent>

        <TabsContent value="motoboy" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Resumo Motoboy</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="px-3 py-2 rounded border text-sm">
                Entregas: <b>{motoList.length}</b>
              </div>
              <div className="px-3 py-2 rounded border text-sm">
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
            <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">#</th>
                    <th className="py-2">Canal</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Pedido (R$)</th>
                    <th className="py-2 text-right">Moto (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {motoList.map((o: any, idx: number) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2">
                        {o.commandNumber ?? (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-5 h-5 rounded-full border border-dashed inline-flex items-center justify-center text-[10px]">
                              VL
                            </span>{" "}
                            {idx + 1}
                          </span>
                        )}
                      </td>
                      <td className="py-2">{o.channel ?? "-"}</td>
                      <td className="py-2">{o.status ?? "-"}</td>
                      <td className="py-2 text-right font-mono">
                        {fmt(Number(o.orderAmount ?? 0))}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {fmt(Number(o.motoValue ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extras">
          <Card>
            <CardHeader><CardTitle>Em breve</CardTitle></CardHeader>
            <CardContent>Outros relatórios consolidados do dia.</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
