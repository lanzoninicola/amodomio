import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  useAsyncError,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import {
  ArrowDown,
  Eye,
  MousePointerClick,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { Suspense, type ComponentType } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { readCardapioOverviewReport } from "~/domain/cardapio/tracking/reports/cardapio-overview-report.server";

export const meta: MetaFunction = () => [
  { title: "Visão geral do cardápio" },
  { name: "robots", content: "noindex" },
];
const PERIODS = [
  { value: "7", label: "Últimos 7 dias", days: 7 },
  { value: "30", label: "Últimos 30 dias", days: 30 },
  { value: "90", label: "Últimos 90 dias", days: 90 },
] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const selected =
    PERIODS.find((item) => item.value === url.searchParams.get("period")) ??
    PERIODS[1];
  const end = new Date();
  const start = new Date(end.getTime() - selected.days * 86400000);
  const previousStart = new Date(start.getTime() - selected.days * 86400000);
  return defer({
    period: selected.value,
    dateLabel: `${start.toLocaleDateString("pt-BR")} – ${end.toLocaleDateString(
      "pt-BR"
    )}`,
    report: readCardapioOverviewReport({
      currentPeriod: { start, end },
      previousPeriod: { start: previousStart, end: start },
    }),
  });
}

export default function CardapioOverview() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Resumo do cardápio
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Do primeiro contato até a intenção de fazer um pedido.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <Select
            name="period"
            defaultValue={searchParams.get("period") ?? data.period}
          >
            <SelectTrigger className="w-[190px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">
            Atualizar
          </Button>
        </form>
      </div>
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border bg-slate-100" />
        }
      >
        <Await resolve={data.report} errorElement={<OverviewError />}>
          {(report) => (
            <OverviewContent report={report} dateLabel={data.dateLabel} />
          )}
        </Await>
      </Suspense>
    </section>
  );
}

function OverviewContent({
  report,
  dateLabel,
}: {
  report: Awaited<ReturnType<typeof readCardapioOverviewReport>>;
  dateLabel: string;
}) {
  const { current, previous, topItem, topCategory } = report;
  const rate = (value: number, base: number) => (base > 0 ? value / base : 0);
  const diff = (value: number, old: number) =>
    old > 0 ? ((value - old) / old) * 100 : null;
  const format = new Intl.NumberFormat("pt-BR");
  const stages = [
    {
      label: "Visitou o cardápio",
      helper: "Visitantes únicos",
      value: current.visitors,
      icon: Users,
      color: "bg-violet-600",
      width: "100%",
    },
    {
      label: "Abriu um produto",
      helper: `${(rate(current.detailVisitors, current.visitors) * 100).toFixed(
        1
      )}% dos visitantes`,
      value: current.detailVisitors,
      icon: Eye,
      color: "bg-sky-500",
      width: "82%",
    },
    {
      label: "Clicou em Fazer pedido",
      helper: "Intenção enviada ao canal de pedido",
      value: current.orderIntentVisitors,
      icon: ShoppingBag,
      color: "bg-amber-500",
      width: "58%",
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-md bg-slate-900 px-2.5 py-1 font-medium text-white">
          Período: {dateLabel}
        </span>
        <span>Comparação com os dias anteriores de mesma duração</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Visitantes"
          value={format.format(current.visitors)}
          change={diff(current.visitors, previous.visitors)}
          color="bg-violet-100 text-violet-700"
        />
        <Metric
          icon={Eye}
          label="Itens visualizados"
          value={format.format(current.itemViews)}
          change={diff(current.itemViews, previous.itemViews)}
          color="bg-sky-100 text-sky-700"
        />
        <Metric
          icon={MousePointerClick}
          label="Taxa de abertura"
          value={`${(
            rate(current.detailVisitors, current.visitors) * 100
          ).toFixed(1)}%`}
          change={diff(
            rate(current.detailVisitors, current.visitors),
            rate(previous.detailVisitors, previous.visitors)
          )}
          color="bg-pink-100 text-pink-700"
        />
        <Metric
          icon={Sparkles}
          label="Destaque do período"
          value={topItem?.name ?? topCategory?.name ?? "Sem dados"}
          helper={
            topItem
              ? `${format.format(topItem.openings)} aberturas`
              : topCategory
              ? `${format.format(topCategory.clicks)} cliques`
              : "Ainda sem interações"
          }
          color="bg-amber-100 text-amber-700"
        />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold text-slate-950">Funil de interesse</h3>
        <p className="mt-1 text-sm text-slate-500">
          Mede comportamento. Curtidas e compartilhamentos são sinais paralelos;
          o último passo é intenção, não venda confirmada.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(340px,1.4fr)]">
          <div className="space-y-3">
            {stages.map(({ icon: Icon, ...stage }, index) => (
              <div
                key={stage.label}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold">{stage.label}</span>
                  </div>
                  <strong>{format.format(stage.value)}</strong>
                </div>
                <p className="mt-1 text-xs text-slate-500">{stage.helper}</p>
                {index < stages.length - 1 && (
                  <ArrowDown className="mx-auto -mb-5 mt-2 h-3.5 w-3.5 text-slate-300" />
                )}
              </div>
            ))}
          </div>
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 p-4">
            {stages.map((stage) => (
              <div
                key={stage.label}
                className={`${stage.color} flex h-20 items-center justify-center rounded-xl text-white shadow-sm`}
                style={{ width: stage.width }}
              >
                <div className="text-center">
                  <strong className="text-xl">
                    {format.format(stage.value)}
                  </strong>
                  <div className="text-xs font-medium text-white/85">
                    {stage.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  change,
  helper,
  color,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change?: number | null;
  helper?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <strong className="truncate text-2xl text-slate-950" title={value}>
          {value}
        </strong>
        {change != null && (
          <span
            className={`pb-0.5 text-xs font-semibold ${
              change >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {helper ?? "Comparado ao período anterior"}
      </p>
    </div>
  );
}
function OverviewError() {
  const error = useAsyncError();
  const revalidator = useRevalidator();
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <h3 className="font-semibold text-red-900">
        Não foi possível carregar o resumo
      </h3>
      <p className="mt-1 text-sm text-red-700">
        {error instanceof Error
          ? error.message
          : "Falha inesperada ao consultar os dados."}
      </p>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => revalidator.revalidate()}
        disabled={revalidator.state !== "idle"}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Recarregar
      </Button>
    </div>
  );
}
