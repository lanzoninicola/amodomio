import { json, MetaFunction, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ymdToDateInt, todayLocalYMD } from "@/domain/kds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDailyAggregates, listMotoboy } from "~/domain/kds/server/repository.server";

export const meta: MetaFunction = () => {
  return [
    { title: "KDS | Relatorios" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);

  const [agg, motoList] = await Promise.all([
    getDailyAggregates(dateInt),
    listMotoboy(dateInt),
  ]);

  return json({ dateStr, agg, motoList });
}

export default function RelatorioKdsPage() {
  const { agg, motoList } = useLoaderData<typeof loader>();
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle>Faturamento do dia</CardTitle></CardHeader>
          <CardContent className="text-2xl font-mono">R$ {fmt(agg.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total Moto</CardTitle></CardHeader>
          <CardContent className="text-2xl font-mono">R$ {fmt(agg.moto)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Nº pedidos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-mono">{agg.count}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financeiro" className="w-full">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="motoboy">Motoboy</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Por canal</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Canal</th>
                      <th className="py-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Faturamento (R$)</th>
                      <th className="py-2 text-right">Moto (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.byChannel.map((r: any) => (
                      <tr key={r.k} className="border-b last:border-0">
                        <td className="py-2">{r.k}</td>
                        <td className="py-2 text-right text-slate-500">{r.count}</td>
                        <td className="py-2 text-right font-mono">{fmt(r.total)}</td>
                        <td className="py-2 text-right font-mono">{fmt(r.moto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Por status</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Pedidos</th>
                      <th className="py-2 text-right">Faturamento (R$)</th>
                      <th className="py-2 text-right">Moto (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.byStatus.map((r: any) => (
                      <tr key={r.k} className="border-b last:border-0">
                        <td className="py-2">{r.k}</td>
                        <td className="py-2 text-right text-slate-500">{r.count}</td>
                        <td className="py-2 text-right font-mono">{fmt(r.total)}</td>
                        <td className="py-2 text-right font-mono">{fmt(r.moto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
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
