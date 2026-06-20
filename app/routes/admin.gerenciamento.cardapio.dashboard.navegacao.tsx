import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, useLoaderData, useSearchParams } from "@remix-run/react";
import { Suspense } from "react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { readCardapioNavigationReport } from "~/domain/cardapio/tracking/reports/cardapio-navigation-report.server";

export const meta: MetaFunction = () => [
  { title: "Navegação do cardápio" },
  { name: "robots", content: "noindex" },
];

type MonthRange = {
  label: string;
  start: Date;
  end: Date;
};

const resolveMonthRange = (monthParam: string | null): MonthRange => {
  const now = new Date();
  const base = monthParam ? new Date(`${monthParam}-01T00:00:00`) : now;
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

  return { label, start, end };
};

const buildMonthOptions = (base: MonthRange, total = 12) => {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return Array.from({ length: total }).map((_, index) => {
    const date = new Date(
      base.start.getFullYear(),
      base.start.getMonth() - index,
      1
    );
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`,
      label: formatter.format(date),
    };
  });
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const fallbackMonth = resolveMonthRange(null);
  const monthOptions = buildMonthOptions(fallbackMonth, 24);
  const validMonths = new Set(monthOptions.map((option) => option.value));
  const requestedFrom = url.searchParams.get("fromMonth");
  const requestedTo = url.searchParams.get("toMonth");
  const fromValue =
    requestedFrom && validMonths.has(requestedFrom)
      ? requestedFrom
      : fallbackMonth.label;
  const toValue =
    requestedTo && validMonths.has(requestedTo)
      ? requestedTo
      : fallbackMonth.label;
  const orderedValues =
    fromValue <= toValue ? [fromValue, toValue] : [toValue, fromValue];
  const currentStart = resolveMonthRange(orderedValues[0]).start;
  const currentEnd = resolveMonthRange(orderedValues[1]).end;
  const monthCount =
    (currentEnd.getFullYear() - currentStart.getFullYear()) * 12 +
    currentEnd.getMonth() -
    currentStart.getMonth();
  const previousStart = new Date(
    currentStart.getFullYear(),
    currentStart.getMonth() - monthCount,
    1
  );
  const previousEnd = currentStart;

  return defer({
    fromMonth: orderedValues[0],
    toMonth: orderedValues[1],
    monthOptions,
    periodLabel:
      orderedValues[0] === orderedValues[1]
        ? orderedValues[0]
        : `${orderedValues[0]} a ${orderedValues[1]}`,
    report: readCardapioNavigationReport({
      currentPeriod: { start: currentStart, end: currentEnd },
      previousPeriod: { start: previousStart, end: previousEnd },
    }),
  });
}

export default function CardapioNavigationDashboard() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const selectedFrom = searchParams.get("fromMonth") ?? data.fromMonth;
  const selectedTo = searchParams.get("toMonth") ?? data.toMonth;

  const pctDiff = (current?: number, previous?: number) => {
    const currentValue = Number(current ?? 0);
    const previousValue = Number(previous ?? 0);
    if (!Number.isFinite(currentValue) || previousValue === 0) {
      return { text: "--", cls: "text-muted-foreground" };
    }
    const percentage = ((currentValue - previousValue) / previousValue) * 100;
    return {
      text: `${percentage >= 0 ? "▲" : "▼"} ${Math.abs(percentage).toFixed(
        1
      )}%`,
      cls: percentage >= 0 ? "text-emerald-600" : "text-red-600",
    };
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Navegação e filtros
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Verifique se os atalhos de categoria e filtros por tag estão sendo
            usados pelos visitantes.
          </p>
        </div>

        <form className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              De
            </label>
            <Select name="fromMonth" defaultValue={selectedFrom}>
              <SelectTrigger className="w-[190px] bg-white capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.monthOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="capitalize"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Até
            </label>
            <Select name="toMonth" defaultValue={selectedTo}>
              <SelectTrigger className="w-[190px] bg-white capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.monthOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="capitalize"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Atualizar
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            Período: {data.periodLabel}. Comparação com o intervalo anterior de
            mesma duração.
          </span>
        </form>
      </header>

      <Suspense
        fallback={
          <div className="rounded-lg border border-muted bg-white p-6 text-sm text-muted-foreground">
            Carregando relatório...
          </div>
        }
      >
        <Await resolve={data.report}>
          {(report) => (
            <NavigationReportContent report={report} pctDiff={pctDiff} />
          )}
        </Await>
      </Suspense>
    </section>
  );
}

function NavigationReportContent({
  report,
  pctDiff,
}: {
  report: Awaited<ReturnType<typeof readCardapioNavigationReport>>;
  pctDiff: (
    current?: number,
    previous?: number
  ) => { text: string; cls: string };
}) {
  const { summary, ranking } = report;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Adoção"
          value={`${(summary.adoptionCurrent * 100).toFixed(1)}%`}
          helper={`${summary.usersCurrent} de ${summary.visitorsCurrent} visitantes`}
          diff={pctDiff(summary.adoptionCurrent, summary.adoptionPrevious)}
        />
        <Metric
          label="Usuários únicos"
          value={String(summary.usersCurrent)}
          helper="Usaram algum controle"
          diff={pctDiff(summary.usersCurrent, summary.usersPrevious)}
        />
        <Metric
          label="Interações"
          value={String(summary.clicksCurrent)}
          helper="Cliques registrados no período"
          diff={pctDiff(summary.clicksCurrent, summary.clicksPrevious)}
        />
        <Metric
          label="Interações por usuário"
          value={
            summary.usersCurrent > 0
              ? (summary.clicksCurrent / summary.usersCurrent).toFixed(1)
              : "0"
          }
          helper="Frequência média de uso"
        />
      </div>

      <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Controles mais usados
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranking de categorias, tags e abertura do painel por posição.
        </p>

        {ranking.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-muted px-4 py-6 text-sm text-muted-foreground">
            Ainda não há eventos de navegação no período selecionado.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-muted">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Ação</th>
                  <th className="px-3 py-2 text-left font-medium">Local</th>
                  <th className="px-3 py-2 text-right font-medium">Período</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Período anterior
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((item) => {
                  const diff = pctDiff(item.current, item.previous);
                  return (
                    <tr key={item.key} className="border-t">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <span className="block">{item.value}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {formatControl(item.control)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatPlacement(item.placement)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {item.current}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {item.previous}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-xs font-semibold ${diff.cls}`}
                      >
                        {diff.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  helper,
  diff,
}: {
  label: string;
  value: string;
  helper: string;
  diff?: { text: string; cls: string };
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <strong className="text-2xl font-semibold text-slate-900">
          {value}
        </strong>
        {diff ? (
          <span className={`text-xs font-semibold ${diff.cls}`}>
            {diff.text}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function formatControl(control: string) {
  if (control === "group") return "Atalho de categoria";
  if (control === "filter_toggle") return "Painel de filtros";
  if (control === "tag") return "Filtro por tag";
  return control;
}

function formatPlacement(placement: string) {
  if (placement === "mobile_header") return "Cabeçalho mobile";
  if (placement === "mobile_panel") return "Painel mobile";
  if (placement === "desktop_nav") return "Navegação desktop";
  if (placement === "stories") return "Stories";
  return placement;
}
