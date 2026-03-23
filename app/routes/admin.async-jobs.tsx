import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { authenticator } from "~/domain/auth/google.server";
import { getAsyncJobsDashboard, runAsyncJobById, runPendingAsyncJobsBatch } from "~/domain/async-jobs/async-jobs.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin | Jobs assíncronos" }];

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function formatDateTime(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function statusBadgeClass(status: string) {
  switch (String(status || "")) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "running":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "failed":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{props.value}</div>
    </div>
  );
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
    const limit = Number(str(formData.get("limit")) || "10");

    if (_action === "run-next") {
      return ok(await runPendingAsyncJobsBatch({ limit: 1, type, lockedBy }));
    }

    if (_action === "run-batch") {
      return ok(await runPendingAsyncJobsBatch({ limit, type, lockedBy }));
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
  const groups = (payload.groups || []) as any[];
  const pendingJobs = (payload.pendingJobs || []) as any[];
  const failedJobs = (payload.failedJobs || []) as any[];
  const runningJobs = (payload.runningJobs || []) as any[];
  const recentJobs = (payload.recentJobs || []) as any[];

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

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Agrupado por tipo</h2>
            <p className="text-sm text-slate-500">Use para executar pendências de um tipo específico.</p>
          </div>
          <Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="_action" value="run-batch" />
            <input type="hidden" name="limit" value="20" />
            <Button type="submit" variant="outline" className="h-9 bg-white">Executar 20 pendentes</Button>
          </Form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader className="bg-slate-50/90">
              <TableRow className="hover:bg-slate-50/90">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Pendentes</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Executando</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Falhados</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Concluídos</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length <= 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-4 py-8 text-sm text-slate-500">
                    Nenhum job registrado.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.type} className="border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="px-4 py-3 font-medium text-slate-900">{group.type}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{group.pending || 0}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{group.running || 0}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{group.failed || 0}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{group.completed || 0}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Form method="post">
                          <input type="hidden" name="_action" value="run-next" />
                          <input type="hidden" name="type" value={group.type} />
                          <Button type="submit" variant="outline" className="h-8 bg-white px-3 text-xs">
                            Executar 1
                          </Button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="_action" value="run-batch" />
                          <input type="hidden" name="type" value={group.type} />
                          <input type="hidden" name="limit" value="10" />
                          <Button type="submit" className="h-8 px-3 text-xs">
                            Executar 10
                          </Button>
                        </Form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Separator />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pendentes</h2>
            <p className="text-sm text-slate-500">Fila pronta para ser processada manualmente.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader className="bg-slate-50/90">
                <TableRow className="hover:bg-slate-50/90">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Criado</TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingJobs.length <= 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="px-4 py-8 text-sm text-slate-500">
                      Nenhum job pendente.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingJobs.map((job) => (
                    <TableRow key={job.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{job.type}</div>
                          <div className="text-xs text-slate-500">{job.dedupeKey || job.id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-slate-700">{formatDateTime(job.createdAt)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Form method="post" className="flex justify-end">
                          <input type="hidden" name="_action" value="run-job" />
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button type="submit" variant="outline" className="h-8 bg-white px-3 text-xs">
                            Executar
                          </Button>
                        </Form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Falhados</h2>
            <p className="text-sm text-slate-500">Jobs que podem ser reexecutados manualmente.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader className="bg-slate-50/90">
                <TableRow className="hover:bg-slate-50/90">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Erro</TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedJobs.length <= 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="px-4 py-8 text-sm text-slate-500">
                      Nenhum job falhado.
                    </TableCell>
                  </TableRow>
                ) : (
                  failedJobs.map((job) => (
                    <TableRow key={job.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{job.type}</div>
                          <div className="text-xs text-slate-500">{formatDateTime(job.updatedAt)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-red-700">{job.errorMessage || "-"}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Form method="post" className="flex justify-end">
                          <input type="hidden" name="_action" value="run-job" />
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button type="submit" variant="outline" className="h-8 bg-white px-3 text-xs">
                            Reexecutar
                          </Button>
                        </Form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Execução recente</h2>
          <p className="text-sm text-slate-500">Histórico curto para acompanhar o processamento manual.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader className="bg-slate-50/90">
              <TableRow className="hover:bg-slate-50/90">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Atualizado</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentJobs.length <= 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                    Nenhum job recente.
                  </TableCell>
                </TableRow>
              ) : (
                recentJobs.map((job) => (
                  <TableRow key={job.id} className="border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={statusBadgeClass(String(job.status))}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-slate-900">{job.type}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{formatDateTime(job.updatedAt)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-500">
                      {job.errorMessage || job.dedupeKey || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {runningJobs.length > 0 ? (
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {runningJobs.length} job(s) em execução no momento. Evite disparar duplicados do mesmo tipo enquanto houver processamento ativo.
          </div>
        ) : null}
      </section>
    </div>
  );
}
