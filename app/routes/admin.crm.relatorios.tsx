import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, Form, Link, useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  MessageCircle,
  Tags,
  UserPlus,
  Users,
} from "lucide-react";
import { Suspense } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { readCrmReport, type CrmReport } from "~/domain/crm/crm-report.server";
import { dayjs } from "~/lib/dayjs";

export const meta: MetaFunction = () => [
  { title: "CRM - Relatórios" },
  { name: "robots", content: "noindex" },
];

const monthValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const resolveMonth = (value: string | null, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}-01T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const now = new Date();
  const from = resolveMonth(
    url.searchParams.get("fromMonth"),
    new Date(now.getFullYear(), now.getMonth() - 5, 1)
  );
  const to = resolveMonth(url.searchParams.get("toMonth"), now);
  const ordered = from <= to ? [from, to] : [to, from];
  const currentStart = new Date(
    ordered[0].getFullYear(),
    ordered[0].getMonth(),
    1
  );
  const currentEnd = new Date(
    ordered[1].getFullYear(),
    ordered[1].getMonth() + 1,
    1
  );
  const monthCount =
    (currentEnd.getFullYear() - currentStart.getFullYear()) * 12 +
    currentEnd.getMonth() -
    currentStart.getMonth();
  const previousEnd = currentStart;
  const previousStart = new Date(
    previousEnd.getFullYear(),
    previousEnd.getMonth() - monthCount,
    1
  );

  return defer({
    fromMonth: monthValue(ordered[0]),
    toMonth: monthValue(ordered[1]),
    report: readCrmReport({
      currentPeriod: { start: currentStart, end: currentEnd },
      previousPeriod: { start: previousStart, end: previousEnd },
    }),
  });
}

export default function AdminCrmReports() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Relatórios do CRM
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Leitura da saúde da base, relacionamento, segmentação e
            oportunidades de ação.
          </p>
        </div>
        <Form method="get" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-medium text-slate-500">
            De
            <Input
              type="month"
              name="fromMonth"
              defaultValue={data.fromMonth}
              className="w-[155px]"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500">
            Até
            <Input
              type="month"
              name="toMonth"
              defaultValue={data.toMonth}
              className="w-[155px]"
            />
          </label>
          <Button type="submit" variant="outline">
            Atualizar
          </Button>
        </Form>
      </header>

      <Suspense fallback={<ReportSkeleton />}>
        <Await resolve={data.report} errorElement={<ReportError />}>
          {(report) => <ReportContent report={report} />}
        </Await>
      </Suspense>
    </section>
  );
}

function ReportContent({ report }: { report: CrmReport }) {
  const { summary } = report;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Base total"
          value={formatNumber(summary.totalCustomers)}
          helper="Contatos disponíveis no CRM"
        />
        <Metric
          icon={UserPlus}
          label="Novos contatos"
          value={formatNumber(summary.newCustomersCurrent)}
          helper="Criados no período"
          change={change(
            summary.newCustomersCurrent,
            summary.newCustomersPrevious
          )}
        />
        <Metric
          icon={MessageCircle}
          label="Contatos ativos"
          value={formatNumber(summary.activeCustomers)}
          helper={`${formatPercent(
            summary.activeCustomers / Math.max(1, summary.totalCustomers)
          )} da base teve evento`}
          change={change(
            summary.activeCustomers,
            summary.previous.activeCustomers
          )}
        />
        <Metric
          icon={CheckCircle2}
          label="Cobertura de resposta"
          value={formatPercent(summary.responseCoverage)}
          helper={`${summary.contactedCustomers} contatados · ${summary.respondents} responderam`}
          change={change(
            summary.responseCoverage,
            summary.previous.responseCoverage
          )}
        />
      </div>

      <Interpretation report={report} />

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <Activity report={report} />
        <Quality report={report} />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <TagsReport report={report} />
        <CustomerList
          title="Clientes de maior valor"
          description="Priorize relacionamento e retenção."
          customers={report.topCustomers}
        />
      </div>

      <CustomerList
        title="Oportunidades de reativação"
        description="Clientes com receita histórica e sem pedido há mais de 60 dias."
        customers={report.customersAtRisk}
        warning
      />
    </div>
  );
}

function Interpretation({ report }: { report: CrmReport }) {
  const notes = [
    report.summary.newCustomersCurrent >= report.summary.newCustomersPrevious
      ? `A aquisição cresceu ${formatPercent(
          Math.abs(
            relativeChange(
              report.summary.newCustomersCurrent,
              report.summary.newCustomersPrevious
            )
          )
        )} contra o período anterior.`
      : `A aquisição caiu ${formatPercent(
          Math.abs(
            relativeChange(
              report.summary.newCustomersCurrent,
              report.summary.newCustomersPrevious
            )
          )
        )} contra o período anterior. Revise as fontes de entrada.`,
    report.summary.responseCoverage >= 0.5
      ? "Ao menos metade dos contatos acionados também respondeu no período."
      : "Menos da metade dos contatos acionados respondeu. Revise abordagem, oferta e horário dos envios.",
    report.quality.tags >= 0.6
      ? "A segmentação cobre a maior parte da base."
      : `Somente ${formatPercent(
          report.quality.tags
        )} da base tem tags; ampliar a classificação melhora campanhas direcionadas.`,
  ];

  return (
    <section className="border-y border-slate-200 py-5">
      <h3 className="text-sm font-semibold text-slate-900">Leitura rápida</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {notes.map((note) => (
          <p key={note} className="text-sm leading-6 text-slate-600">
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}

function Activity({ report }: { report: CrmReport }) {
  const max = Math.max(
    1,
    ...report.activity.map((day) => day.sent + day.received)
  );
  return (
    <section>
      <SectionTitle
        title="Conversas no período"
        description={`${formatNumber(
          report.summary.messagesSent
        )} enviadas · ${formatNumber(
          report.summary.messagesReceived
        )} recebidas`}
      />
      {report.activity.length ? (
        <div className="mt-5 flex h-44 items-end gap-1 border-b border-slate-200">
          {report.activity.map((day) => (
            <div
              key={day.date}
              className="group relative flex h-full min-w-1 flex-1 items-end gap-px"
              title={`${dayjs(day.date).format("DD/MM")}: ${
                day.sent
              } enviadas, ${day.received} recebidas`}
            >
              <div
                className="w-1/2 rounded-t-sm bg-slate-300"
                style={{ height: `${Math.max(2, (day.sent / max) * 100)}%` }}
              />
              <div
                className="w-1/2 rounded-t-sm bg-emerald-500"
                style={{
                  height: `${Math.max(2, (day.received / max) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Nenhuma conversa registrada no período." />
      )}
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span>■ Enviadas</span>
        <span className="text-emerald-600">■ Recebidas</span>
      </div>
    </section>
  );
}

function Quality({ report }: { report: CrmReport }) {
  const items = [
    ["Nome", report.quality.name],
    ["Cidade", report.quality.city],
    ["Bairro", report.quality.neighborhood],
    ["Histórico de compra", report.quality.purchaseHistory],
    ["Tags", report.quality.tags],
    ["Consentimento", report.quality.consent],
    ["E-mail", report.quality.email],
  ] as const;
  return (
    <section>
      <SectionTitle
        title="Qualidade da base"
        description="Percentual de contatos com cada informação preenchida."
      />
      <div className="mt-5 space-y-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[130px_1fr_48px] items-center gap-3 text-sm"
          >
            <span className="text-slate-600">{label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${value * 100}%` }}
              />
            </div>
            <span className="text-right font-mono text-xs text-slate-700">
              {formatPercent(value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TagsReport({ report }: { report: CrmReport }) {
  const max = Math.max(1, ...report.tags.map((tag) => tag.count));
  return (
    <section>
      <SectionTitle
        title="Segmentos mais usados"
        description="Distribuição das tags na base completa."
        icon={Tags}
      />
      {report.tags.length ? (
        <div className="mt-5 space-y-3">
          {report.tags.map((tag) => (
            <div
              key={tag.key}
              className="grid grid-cols-[minmax(120px,1fr)_2fr_45px] items-center gap-3 text-sm"
            >
              <span className="truncate text-slate-700" title={tag.label}>
                {tag.label}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${(tag.count / max) * 100}%` }}
                />
              </div>
              <span className="text-right font-mono text-xs">{tag.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Nenhuma tag aplicada à base." />
      )}
    </section>
  );
}

type Customer = Pick<
  CrmReport["topCustomers"][number],
  "id" | "name" | "phone_e164" | "total_revenue" | "last_order_at"
>;
function CustomerList({
  title,
  description,
  customers,
  warning = false,
}: {
  title: string;
  description: string;
  customers: Customer[];
  warning?: boolean;
}) {
  return (
    <section>
      <SectionTitle
        title={title}
        description={description}
        icon={warning ? AlertTriangle : undefined}
      />
      {customers.length ? (
        <div className="mt-4 divide-y divide-slate-100">
          {customers.map((customer, index) => (
            <Link
              key={customer.id}
              to={`/admin/crm/${customer.id}/profile`}
              className="grid grid-cols-[32px_1fr_auto] items-center gap-3 py-3 text-sm hover:bg-slate-50"
            >
              <span className="font-mono text-xs text-slate-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong className="block font-medium text-slate-900">
                  {customer.name || customer.phone_e164}
                </strong>
                <span className="text-xs text-slate-500">
                  Último pedido:{" "}
                  {customer.last_order_at
                    ? dayjs(customer.last_order_at).format("DD/MM/YYYY")
                    : "sem data"}
                </span>
              </span>
              <span className="font-mono font-medium text-slate-900">
                {formatCurrency(customer.total_revenue)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty text="Nenhum cliente nesta leitura." />
      )}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
  change: delta,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  helper: string;
  change?: ReturnType<typeof change>;
}) {
  return (
    <article className="border-l-2 border-slate-200 pl-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <strong className="font-mono text-2xl font-semibold text-slate-950">
          {value}
        </strong>
        {delta && (
          <span
            className={`inline-flex items-center text-xs font-medium ${
              delta.positive ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {delta.positive ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            {delta.label}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}

function SectionTitle({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon?: typeof Users;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        {Icon && <Icon size={16} />}
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="mt-5 border-y border-slate-100 py-6 text-sm text-slate-500">
      {text}
    </p>
  );
}
function ReportSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 rounded-md bg-slate-100" />
      ))}
    </div>
  );
}
function ReportError() {
  return (
    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      Não foi possível carregar o relatório do CRM.
    </div>
  );
}
function relativeChange(current: number, previous: number) {
  return previous === 0
    ? current > 0
      ? 1
      : 0
    : (current - previous) / previous;
}
function change(current: number, previous: number) {
  const value = relativeChange(current, previous);
  return {
    positive: value >= 0,
    label: previous === 0 ? "novo" : formatPercent(Math.abs(value)),
  };
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
