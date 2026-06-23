import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, Form, Link, useLoaderData } from "@remix-run/react";
import {
  ArrowLeft,
  ExternalLink,
  MousePointerClick,
  ScanEye,
  Users,
  ZoomIn,
} from "lucide-react";
import { Suspense } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { readCardapioFeaturedReport } from "~/domain/cardapio/tracking/reports/cardapio-featured-report.server";

export const meta: MetaFunction = () => [
  { title: "Desempenho dos destaques | Marketing" },
  { name: "robots", content: "noindex" },
];

function resolveMonth(value: string | null) {
  const now = new Date();
  const parsed =
    value && /^\d{4}-\d{2}$/.test(value)
      ? new Date(`${value}-01T00:00:00`)
      : now;
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const end = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  return { start, end, key };
}

function monthOptions(total = 12) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const now = new Date();

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`,
      label: formatter.format(date),
    };
  });
}

const formatPercentage = (value: number) =>
  `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const currentMonth = resolveMonth(url.searchParams.get("month"));
  const month = currentMonth.key;
  const selectedSection = url.searchParams.get("section");
  const sectionKey =
    selectedSection && selectedSection !== "all" ? selectedSection : null;
  const previousPeriod = {
    start: new Date(
      currentMonth.start.getFullYear(),
      currentMonth.start.getMonth() - 1,
      1
    ),
    end: currentMonth.start,
  };

  return defer({
    month,
    sectionKey,
    monthOptions: monthOptions(),
    report: readCardapioFeaturedReport({
      currentPeriod: { start: currentMonth.start, end: currentMonth.end },
      previousPeriod,
      sectionKey,
    }),
  });
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
        {value}
      </div>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

const placementLabels: Record<string, string> = {
  mobile_card: "Card mobile",
  mobile_modal: "Ampliado mobile",
  desktop_card: "Card desktop",
  desktop_modal: "Ampliado desktop",
};

export default function AdminMarketingCardapioFeaturedReport() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-6 px-4 pb-10">
      <header className="space-y-4 border-b border-slate-200 pb-5">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          voltar
        </Link>
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Marketing / Relatórios
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Desempenho dos destaques
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe alcance, interesse e conversão das promoções do cardápio.
          </p>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="text-sm text-slate-500">Carregando relatório...</div>
        }
      >
        <Await resolve={data.report}>
          {(report) => (
            <>
              <Form method="get" className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Mês
                  <Select name="month" defaultValue={data.month}>
                    <SelectTrigger className="w-[220px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Destaque
                  <Select
                    name="section"
                    defaultValue={data.sectionKey ?? "all"}
                  >
                    <SelectTrigger className="w-[260px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os destaques</SelectItem>
                      {report.sections.map((section) => (
                        <SelectItem key={section.id} value={section.key}>
                          {section.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <Button type="submit">Aplicar filtros</Button>
              </Form>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Pessoas alcançadas"
                  value={report.metrics.visitors}
                  helper={`${report.metrics.previousVisitors} no mês anterior`}
                  icon={Users}
                />
                <MetricCard
                  label="Exibições"
                  value={report.metrics.impressions}
                  helper="Destaque visível em pelo menos 50% da tela"
                  icon={ScanEye}
                />
                <MetricCard
                  label="Taxa de ampliação"
                  value={formatPercentage(report.metrics.expandRate)}
                  helper={`${report.metrics.expands} ampliações`}
                  icon={ZoomIn}
                />
                <MetricCard
                  label="CTR do link"
                  value={formatPercentage(report.metrics.ctr)}
                  helper={`${
                    report.metrics.ctaClicks
                  } cliques · mês anterior ${formatPercentage(
                    report.metrics.previousCtr
                  )}`}
                  icon={MousePointerClick}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="font-semibold text-slate-950">
                      Resultado por destaque
                    </h2>
                    <p className="text-xs text-slate-500">
                      Compare alcance, intenção e clique final.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Destaque</TableHead>
                        <TableHead className="text-right">Pessoas</TableHead>
                        <TableHead className="text-right">Exibições</TableHead>
                        <TableHead className="text-right">Ampliação</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.bySection.length ? (
                        report.bySection.map((section) => (
                          <TableRow key={section.key}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {section.title}
                                </span>
                                {!section.published ? (
                                  <Badge variant="secondary">Inativo</Badge>
                                ) : null}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {section.key}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {section.visitors}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {section.impressions}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercentage(section.expandRate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercentage(section.ctr)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {section.ctaClicks}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-28 text-center text-slate-500"
                          >
                            Ainda não há eventos neste período.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="font-semibold text-slate-950">
                    Onde houve interação
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Ajuda a identificar diferenças entre mobile e desktop.
                  </p>
                  <div className="mt-4 space-y-3">
                    {report.byPlacement.length ? (
                      report.byPlacement.map((row) => (
                        <div
                          key={row.placement}
                          className="rounded-lg bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-slate-700">
                              {placementLabels[row.placement] ?? row.placement}
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-slate-950">
                              {row.total}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.clicks} cliques no link
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        Sem interações registradas.
                      </p>
                    )}
                  </div>
                  <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                    {report.metrics.impressions === 0
                      ? "Sem exibições: valide publicação, carregamento e posição do destaque."
                      : report.metrics.expandRate < 5
                      ? "Poucas ampliações: teste imagem, título ou proposta mais clara."
                      : report.metrics.ctr < 2
                      ? "Há interesse visual, mas poucos cliques: revise o texto e o destino do link."
                      : "O funil registra alcance e ação. Compare os destaques para repetir os melhores padrões."}
                  </div>
                  <Link
                    to="/admin/marketing/publicacoes"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Gerenciar publicações
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </section>
              </div>
            </>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
