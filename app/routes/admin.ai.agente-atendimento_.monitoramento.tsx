import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, Link, useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { Suspense, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getWhatsappAgentMonitoring } from "~/domain/whatsapp-agent/whatsapp-agent-monitoring.server";

export const meta: MetaFunction = () => [
  { title: "Monitoramento do agente AI | A Modo Mio" },
];

export function loader(_: LoaderFunctionArgs) {
  return defer({ monitoring: getWhatsappAgentMonitoring() });
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function maskPhone(phone: string) {
  if (phone.length <= 4) return phone;
  return `${"•".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  generated: "Aguardando aprovação",
  sent: "Enviado",
  failed: "Falhou",
  expired: "Expirado",
};

function statusVariant(status: string) {
  if (status === "sent" || status === "generated") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

function AutoRefresh() {
  const revalidator = useRevalidator();
  useEffect(() => {
    const timer = window.setInterval(() => revalidator.revalidate(), 15_000);
    return () => window.clearInterval(timer);
  }, [revalidator]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => revalidator.revalidate()}
      disabled={revalidator.state !== "idle"}
    >
      <RefreshCw
        className={`mr-2 h-4 w-4 ${
          revalidator.state !== "idle" ? "animate-spin" : ""
        }`}
      />
      Atualizar
    </Button>
  );
}

function MonitoringPanel({
  data,
}: {
  data: Awaited<ReturnType<typeof getWhatsappAgentMonitoring>>;
}) {
  const pending = data.statusCounts.pending ?? 0;
  const processing = data.statusCounts.processing ?? 0;
  const failed = data.statusCounts.failed ?? 0;
  const sent = data.statusCounts.sent ?? 0;
  const rateLimitErrors =
    data.errors.find((error) => error.code === "rate_limit")?.count ?? 0;

  return (
    <div className="space-y-6">
      {rateLimitErrors > 0 ? (
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Limite do provedor detectado</p>
            <p>
              {rateLimitErrors} ocorrência(s) de erro 429 nos últimos 7 dias.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Recebidos 24h", data.total24Hours, Activity],
          ["Enviados 24h", sent, Send],
          ["Pendentes", pending, Clock3],
          ["Processando", processing, Loader2],
          ["Falhas 24h", failed, AlertTriangle],
        ].map(([label, value, Icon]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{String(label)}</p>
                <p className="mt-1 text-2xl font-semibold">{String(value)}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saúde do processamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Taxa de sucesso 24h</span>
              <strong>
                {data.successRate == null
                  ? "—"
                  : `${data.successRate.toFixed(1)}%`}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Pendente mais antigo</span>
              <strong>{formatDate(data.oldestPendingAt)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Atualizado</span>
              <strong>{formatDate(data.generatedAt)}</strong>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Erros agrupados — últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.errors.length ? (
              <div className="space-y-2">
                {data.errors.map((error) => (
                  <div
                    key={error.code}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{error.label}</span>
                    <Badge variant="destructive">{error.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Nenhum erro registrado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 40 jobs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Recebido</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Mensagem</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tentativas</th>
                <th className="px-4 py-3">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.recentJobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(job.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {maskPhone(job.phone)}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-3"
                    title={job.inboundText}
                  >
                    {job.inboundText}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(job.status)}>
                      {STATUS_LABELS[job.status] ?? job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{job.attempts}</td>
                  <td className="max-w-md px-4 py-3 text-xs text-muted-foreground">
                    <span title={job.lastError ?? undefined}>
                      {job.errorCategory?.label ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WhatsappAgentMonitoringPage() {
  const { monitoring } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link to="/admin/ai/agente-atendimento">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Configuração do agente
            </Link>
          </Button>
          <h1 className="flex items-center gap-3 text-3xl font-semibold">
            <Activity className="h-8 w-8" />
            Monitoramento do agente
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acompanhamento operacional dos jobs e erros do atendimento por IA.
          </p>
        </div>
        <AutoRefresh />
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-48 items-center justify-center rounded-lg border">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <Await
          resolve={monitoring}
          errorElement={
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Não foi possível carregar o monitoramento.
            </div>
          }
        >
          {(data) => <MonitoringPanel data={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
