import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { authenticator } from "~/domain/auth/google.server";
import {
  clampAsyncJobBatchLimit,
  getAsyncJobsDashboard,
  getManualBatchLimit,
  runAsyncJobById,
  runPendingAsyncJobsBatch,
} from "~/domain/async-jobs/async-jobs.server";
import { StatCard } from "~/domain/async-jobs/admin-async-jobs-ui";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin | Jobs assíncronos" }];

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function tabTriggerClass(color: "amber" | "red" | "emerald" | "slate") {
  switch (color) {
    case "amber":
      return "data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900 data-[state=active]:border data-[state=active]:border-amber-200";
    case "red":
      return "data-[state=active]:bg-red-50 data-[state=active]:text-red-900 data-[state=active]:border data-[state=active]:border-red-200";
    case "emerald":
      return "data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 data-[state=active]:border data-[state=active]:border-emerald-200";
    case "slate":
      return "data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:border data-[state=active]:border-slate-300";
    default:
      return "";
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    if (!user) return badRequest("Não autenticado");
    return ok(await getAsyncJobsDashboard({ recentLimit: 50 }));
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    if (!user) return badRequest("Não autenticado");

    const lockedBy =
      (user as any)?.email || (user as any)?.displayName || (user as any)?.name || "manual:admin";

    const formData = await request.formData();
    const _action = str(formData.get("_action"));
    const type = str(formData.get("type")) || null;
    const jobId = str(formData.get("jobId"));
    const limit = clampAsyncJobBatchLimit(str(formData.get("limit")) || "1", getManualBatchLimit());

    if (_action === "run-next") {
      return ok(await runPendingAsyncJobsBatch({ limit: 1, type, lockedBy, maxLimit: getManualBatchLimit() }));
    }

    if (_action === "run-batch") {
      return ok(await runPendingAsyncJobsBatch({ limit, type, lockedBy, maxLimit: getManualBatchLimit() }));
    }

    if (_action === "run-job") {
      if (!jobId) return badRequest("Job inválido");
      return ok({ job: await runAsyncJobById({ id: jobId, lockedBy }) });
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminAsyncJobsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const payload = (loaderData as any)?.payload || {};
  const counts = payload.counts || {};
  const pendingJobs = (payload.pendingJobs || []) as any[];
  const failedJobs = (payload.failedJobs || []) as any[];
  const runningJobs = (payload.runningJobs || []) as any[];
  const recentJobs = (payload.recentJobs || []) as any[];
  const groups = (payload.groups || []) as any[];
  const batchControls = (payload.batchControls || {}) as
    | { manualLimit?: number; presets?: number[]; hardLimit?: number }
    | undefined;
  const cron = payload.cron as
    | { path?: string; schedule?: string; limit?: number; timezone?: string }
    | null
    | undefined;
  const { pathname } = useLocation();
  const tabValue = pathname.includes("/settings")
    ? "settings"
    : pathname.includes("/recent")
    ? "recent"
    : pathname.includes("/failed")
      ? "failed"
      : "pending";

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Jobs assíncronos</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Central para agrupar pendências e executar processamento pesado fora do fluxo síncrono, inclusive em janelas manuais noturnas.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Pendentes" value={Number(counts.pending || 0)} />
          <StatCard label="Executando" value={Number(counts.running || 0)} />
          <StatCard label="Falhados" value={Number(counts.failed || 0)} />
          <StatCard label="Concluídos" value={Number(counts.completed || 0)} />
          <StatCard label="Total" value={Number(counts.total || 0)} />
        </div>
      </section>

      <Separator />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">Agendamento</h2>
          <p className="text-sm text-slate-500">Configuração do disparo automático e janela prevista dos jobs pendentes.</p>
        </div>

        {cron ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cron</div>
              <div className="mt-1 font-mono text-sm text-slate-950">{cron.schedule || "-"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rota</div>
              <div className="mt-1 font-mono text-sm text-slate-950">{cron.path || "-"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Limite por execução</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{cron.limit || 0} jobs</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Timezone</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{cron.timezone || "-"}</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nenhum cron de `/api/async-jobs-cron` foi encontrado em `vercel.json`.
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Visões</h2>
          <p className="text-sm text-slate-500">Abra a fila desejada para acompanhar e agir sobre os jobs.</p>
        </div>

        <Tabs value={tabValue} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-4">
            <TabsTrigger value="pending" asChild className={tabTriggerClass("amber")}>
              <Link to="/admin/async-jobs">Pendentes</Link>
            </TabsTrigger>
            <TabsTrigger value="failed" asChild className={tabTriggerClass("red")}>
              <Link to="/admin/async-jobs/failed">Falhados</Link>
            </TabsTrigger>
            <TabsTrigger value="recent" asChild className={tabTriggerClass("emerald")}>
              <Link to="/admin/async-jobs/recent">Execução recente</Link>
            </TabsTrigger>
            <TabsTrigger value="settings" asChild className={tabTriggerClass("slate")}>
              <Link to="/admin/async-jobs/settings">Settings</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Outlet
          context={{
            pendingJobs,
            failedJobs,
            recentJobs,
            runningJobs,
            groups,
            batchControls,
          }}
        />
      </section>
    </div>
  );
}
