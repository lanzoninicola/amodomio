import { useOutletContext } from "@remix-run/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "~/lib/utils";

import type { MonthlyReportOutletContext } from "./admin.kds.atendimento.$date.relatorio-mes";
import { Separator } from "~/components/ui/separator";

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
  const diff = diffMeta(current, previous);
  const currentValue = money ? fmtMoney(current) : `${fmtNumber(current, digits)}${suffix}`;
  const previousValue = money ? fmtMoney(previous) : `${fmtNumber(previous, digits)}${suffix}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-semibold">{currentValue}</div>
        <div className="rounded-lg border bg-slate-50/80 px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span>Período anterior</span>
            <span className="font-mono">{previousValue}</span>
          </div>
          <div className={cn("mt-1 text-right font-medium", diff.className)}>{diff.text}</div>
        </div>
      </CardContent>
    </Card>
  );
}

type NeighborhoodRow = { k: string; count: number; total: number; moto: number };
type NeighborhoodInsightRow = NeighborhoodRow & {
  avgTicket: number;
  margin: number;
  marginPerc: number;
};

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2;
  return sorted[middle];
}

function SegmentChart({
  title,
  description,
  rows,
  valueForRow,
  valueLabel,
  metaForRow,
}: {
  title: string;
  description: string;
  rows: NeighborhoodInsightRow[];
  valueForRow: (row: NeighborhoodInsightRow) => number;
  valueLabel: (row: NeighborhoodInsightRow) => string;
  metaForRow: (row: NeighborhoodInsightRow) => string;
}) {
  const maxValue = Math.max(...rows.map((row) => valueForRow(row)), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="text-sm text-muted-foreground">{description}</div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum bairro encaixou nesse perfil no período.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const currentValue = valueForRow(row);
              const barWidth = maxValue > 0 ? Math.max((currentValue / maxValue) * 100, 6) : 6;

              return (
                <div key={row.k}>
                  <div className="grid grid-cols-8 items-start">
                    <div className="truncate text-xs font-semibold uppercase tracking-[0.08em] col-span-2" title={row.k}>
                      {row.k}
                    </div>
                    <div className="flex flex-col col-span-6">
                      <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all"
                          style={{ width: `${barWidth}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex gap-x-2 items-center justify-between text-xs text-muted-foreground">
                          <span>{metaForRow(row)}</span>
                          <span>{valueLabel(row)}</span>
                        </div>
                        <div>{" - "}</div>
                        <div className="text-xs text-muted-foreground">{fmtNumber(row.count)} pedidos</div>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueByNeighborhoodTable({ rows }: { rows: NeighborhoodInsightRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturamento por bairro</CardTitle>
        <div className="text-sm text-muted-foreground">Faturamento = pedidos x ticket medio.</div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bairro</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Ticket medio</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.k}>
                <TableCell className="font-semibold">{row.k}</TableCell>
                <TableCell className="text-right">{fmtNumber(row.count)}</TableCell>
                <TableCell className="text-right font-mono">{fmtMoney(row.avgTicket)}</TableCell>
                <TableCell className="text-right font-mono">{fmtMoney(row.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GrowthLevers({
  avgTicket,
}: {
  avgTicket: number;
}) {
  const improvedTicket = avgTicket + 15;
  const ticketGainPerc = avgTicket > 0 ? ((improvedTicket - avgTicket) / avgTicket) * 100 : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>1. Aumentar frequencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Se um cliente compra 2x por mes e passa para 3x por mes, o faturamento desse cliente sobe 50%.</div>
          <div>Ferramentas: WhatsApp, cupom de retorno e campanhas semanais.</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. Aumentar ticket medio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Ticket atual: <span className="font-mono">{fmtMoney(avgTicket)}</span>
            {" -> "}
            <span className="font-mono">{fmtMoney(improvedTicket)}</span>
          </div>
          <div>Mesmo volume: +{fmtNumber(ticketGainPerc, 1)}% de faturamento.</div>
          <div>Ferramentas: bebida, sobremesa e pizza premium.</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>3. Novos clientes em bairros fortes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Concentre marketing nos bairros que ja combinam faturamento alto com densidade de pedidos.</div>
          <div>Priorize aquisicao local, CRM e campanhas com foco geográfico.</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RelatorioMotoboyEntregasPage() {
  const { report } = useOutletContext<MonthlyReportOutletContext>();
  const current = report.motoboy.curr;
  const previous = report.motoboy.prev;
  const neighborhoodRows = [...(current.byNeighborhood as NeighborhoodRow[])].map((row) => {
    const avgTicket = row.count > 0 ? row.total / row.count : 0;
    const margin = row.total - row.moto;
    const marginPerc = row.total > 0 ? (margin / row.total) * 100 : 0;

    return {
      ...row,
      avgTicket,
      margin,
      marginPerc,
    };
  });
  const revenueRows = [...neighborhoodRows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return b.count - a.count;
  });
  const ordersMedian = median(neighborhoodRows.map((row) => row.count));
  const ticketMedian = median(neighborhoodRows.map((row) => row.avgTicket));
  const marginMedian = median(neighborhoodRows.map((row) => row.marginPerc));
  const typeA = neighborhoodRows
    .filter((row) => row.count >= ordersMedian && row.avgTicket >= ticketMedian)
    .sort((a, b) => b.total - a.total);
  const typeB = neighborhoodRows
    .filter((row) => row.count < ordersMedian && row.avgTicket >= ticketMedian)
    .sort((a, b) => b.avgTicket - a.avgTicket);
  const typeCBase = neighborhoodRows
    .filter((row) => row.count >= ordersMedian && row.avgTicket < ticketMedian && row.marginPerc <= marginMedian)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.marginPerc - b.marginPerc;
    });
  const typeC = typeCBase.length > 0
    ? typeCBase
    : neighborhoodRows
      .filter((row) => row.count >= ordersMedian && row.avgTicket < ticketMedian)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.marginPerc - b.marginPerc;
      });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Entregas" current={current.deliveries} previous={previous.deliveries} money={false} />
        <MetricCard title="Receita das entregas" current={current.deliveryRevenue} previous={previous.deliveryRevenue} />
        <MetricCard title="Custo motoboy" current={current.motoCost} previous={previous.motoCost} />
        <MetricCard title="Ticket médio entrega" current={current.avgTicket} previous={previous.avgTicket} />
        <MetricCard
          title="Custo médio por entrega"
          current={current.avgMotoPerDelivery}
          previous={previous.avgMotoPerDelivery}
        />
        <MetricCard
          title="Motoboy / receita entrega"
          current={current.motoVsRevenuePerc}
          previous={previous.motoVsRevenuePerc}
          money={false}
          digits={1}
          suffix="%"
        />
        <MetricCard
          title="% pedidos com entrega"
          current={current.shareOrdersPerc}
          previous={previous.shareOrdersPerc}
          money={false}
          digits={1}
          suffix="%"
        />
        <MetricCard
          title="% receita vinda de entrega"
          current={current.shareRevenuePerc}
          previous={previous.shareRevenuePerc}
          money={false}
          digits={1}
          suffix="%"
        />
      </div>

      <RevenueByNeighborhoodTable rows={revenueRows} />

      <div className="grid gap-6 xl:grid-cols-3">
        <SegmentChart
          title="Tipo A — Alta venda"
          description="Muitos pedidos e ticket medio bom. Prioridade total."
          rows={typeA}
          valueForRow={(row) => row.total}
          valueLabel={(row) => fmtMoney(row.total)}
          metaForRow={(row) => `Ticket ${fmtMoney(row.avgTicket)}`}
        />
        <SegmentChart
          title="Tipo B — Alto ticket"
          description="Poucos pedidos e ticket alto. Oportunidade de crescimento."
          rows={typeB}
          valueForRow={(row) => row.avgTicket}
          valueLabel={(row) => fmtMoney(row.avgTicket)}
          metaForRow={(row) => `Receita ${fmtMoney(row.total)}`}
        />
        <SegmentChart
          title="Tipo C — Volume alto, ticket baixo"
          description="Muitos pedidos e margem menor. Controlar promoções."
          rows={typeC}
          valueForRow={(row) => row.count}
          valueLabel={(row) => `${fmtNumber(row.count)} pedidos`}
          metaForRow={(row) => `Margem ${fmtNumber(row.marginPerc, 1)}%`}
        />
      </div>

      <GrowthLevers avgTicket={current.avgTicket} />
    </div>
  );
}
