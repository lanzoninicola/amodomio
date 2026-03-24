import { Form, Link, useOutletContext } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

export type AdminAsyncJobsOutletContext = {
  pendingJobs: any[];
  failedJobs: any[];
  recentJobs: any[];
  runningJobs: any[];
  groups: any[];
  batchControls?: {
    manualLimit?: number;
    presets?: number[];
    hardLimit?: number;
  };
};

export function useAdminAsyncJobsOutletContext() {
  return useOutletContext<AdminAsyncJobsOutletContext>();
}

export function formatDateTime(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export function describeSchedule(value: unknown) {
  if (!value) return "Imediato";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  const now = Date.now();
  if (date.getTime() <= now) return `Liberado desde ${date.toLocaleString("pt-BR")}`;
  return `Agendado para ${date.toLocaleString("pt-BR")}`;
}

export function statusBadgeClass(status: string) {
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

export function StatCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{props.value}</div>
    </div>
  );
}

export function AsyncJobsPendingPage() {
  const { pendingJobs, groups, batchControls } = useAdminAsyncJobsOutletContext();
  const presets = (batchControls?.presets || [1]).filter((value) => Number(value) > 0);
  const manualLimit = Number(batchControls?.manualLimit || 1);
  const pendingGroups = groups.filter((group) => Number(group.pending || 0) > 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-amber-900">Jobs pendentes</h2>
        <p className="text-sm text-slate-500">Fila pronta para ser processada manualmente.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-amber-950">Execução em lote</div>
            <p className="text-sm text-amber-900/80">
              Limite manual atual: {manualLimit} job(s) por disparo, para reduzir risco de timeout no Vercel Free.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((limit) => (
              <Form key={limit} method="post" action="/admin/async-jobs">
                <input type="hidden" name="_action" value="run-batch" />
                <input type="hidden" name="limit" value={limit} />
                <Button type="submit" variant="outline" className="h-8 border-amber-200 bg-white px-3 text-xs text-amber-900">
                  Executar {limit}
                </Button>
              </Form>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white">
        <Table>
          <TableHeader className="bg-amber-50/80">
            <TableRow className="hover:bg-amber-50/80">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-amber-800">Tipo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-amber-800">Pendentes</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-amber-800">Lote</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingGroups.length <= 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="px-4 py-6 text-sm text-slate-500">
                  Nenhum agrupamento disponível.
                </TableCell>
              </TableRow>
            ) : (
              pendingGroups.map((group) => (
                  <TableRow key={group.type} className="border-amber-100 hover:bg-amber-50/30">
                    <TableCell className="px-4 py-3 font-medium text-slate-900">{group.type}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{group.pending || 0}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {presets.map((limit) => (
                          <Form key={`${group.type}-${limit}`} method="post" action="/admin/async-jobs">
                            <input type="hidden" name="_action" value="run-batch" />
                            <input type="hidden" name="type" value={group.type} />
                            <input type="hidden" name="limit" value={Math.min(limit, Number(group.pending || 0), manualLimit)} />
                            <Button type="submit" variant="outline" className="h-8 border-amber-200 bg-white px-3 text-xs text-amber-900">
                              {Math.min(limit, Number(group.pending || 0), manualLimit)}
                            </Button>
                          </Form>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white">
        <Table>
          <TableHeader className="bg-amber-50/80">
            <TableRow className="hover:bg-amber-50/80">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-amber-800">Tipo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-amber-800">Agendamento</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-amber-800">Criado</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-amber-800">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingJobs.length <= 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum job pendente.
                </TableCell>
              </TableRow>
            ) : (
              pendingJobs.map((job) => (
                <TableRow key={job.id} className="border-amber-100 hover:bg-amber-50/30">
                  <TableCell className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">{job.type}</div>
                      <div className="text-xs text-slate-500">{job.dedupeKey || job.id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{describeSchedule(job.runAfter)}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">{formatDateTime(job.createdAt)}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Form method="post" action="/admin/async-jobs" className="flex justify-end">
                      <input type="hidden" name="_action" value="run-job" />
                      <input type="hidden" name="jobId" value={job.id} />
                      <Button type="submit" variant="outline" className="h-8 border-amber-200 bg-white px-3 text-xs text-amber-900">
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
    </section>
  );
}

export function AsyncJobsFailedPage() {
  const { failedJobs } = useAdminAsyncJobsOutletContext();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-red-900">Jobs falhados</h2>
        <p className="text-sm text-slate-500">Jobs que podem ser reexecutados manualmente.</p>
      </div>
      <div className="rounded-xl border border-red-200 bg-white">
        <Table>
          <TableHeader className="bg-red-50/80">
            <TableRow className="hover:bg-red-50/80">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-red-800">Tipo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-red-800">Erro</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-red-800">Ação</TableHead>
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
                <TableRow key={job.id} className="border-red-100 hover:bg-red-50/30">
                  <TableCell className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">{job.type}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(job.updatedAt)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-red-700">{job.errorMessage || "-"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Form method="post" action="/admin/async-jobs" className="flex justify-end">
                      <input type="hidden" name="_action" value="run-job" />
                      <input type="hidden" name="jobId" value={job.id} />
                      <Button type="submit" variant="outline" className="h-8 border-red-200 bg-white px-3 text-xs text-red-900">
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
    </section>
  );
}

export function AsyncJobsRecentPage(props: { runningJobsCount: number }) {
  const { recentJobs } = useAdminAsyncJobsOutletContext();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-emerald-900">Execução recente</h2>
        <p className="text-sm text-slate-500">Histórico curto para acompanhar o processamento manual.</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-white">
        <Table>
          <TableHeader className="bg-emerald-50/80">
            <TableRow className="hover:bg-emerald-50/80">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-800">Status</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-800">Tipo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-800">Agendamento</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-800">Atualizado</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-800">Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentJobs.length <= 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum job recente.
                </TableCell>
              </TableRow>
            ) : (
              recentJobs.map((job) => (
                <TableRow key={job.id} className="border-emerald-100 hover:bg-emerald-50/30">
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className={statusBadgeClass(String(job.status))}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-slate-900">{job.type}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">{describeSchedule(job.runAfter)}</TableCell>
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

      {props.runningJobsCount > 0 ? (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {props.runningJobsCount} job(s) em execução no momento. Evite disparar duplicados do mesmo tipo enquanto houver processamento ativo.
        </div>
      ) : null}
    </section>
  );
}

export function AsyncJobsEmptyRedirectHint() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Escolha uma aba acima ou abra <Link to="/admin/async-jobs" className="font-medium text-slate-900 underline">Jobs pendentes</Link>.
    </div>
  );
}
