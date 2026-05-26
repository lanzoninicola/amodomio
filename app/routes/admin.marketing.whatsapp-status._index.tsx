import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { Copy, Edit, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authenticator } from "~/domain/auth/google.server";
import {
  STATUS_PUBLICATION_LIFECYCLE_DETAILS,
  buildDokployPublishScript,
  countStatusPublications,
  decorateStatusPublication,
  normalizeKindFilter,
  normalizeStatusFilter,
  type StatusPublicationLifecycle,
} from "~/domain/whatsapp-status/whatsapp-status-publication.shared";
import { handleRouteError } from "~/domain/z-api/route-helpers.server";

export const meta: MetaFunction = () => [
  { title: "Whatsapp Status | Marketing" },
];

function buildPageHref(params: { q: string; status: string; kind: string }) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }
  if (params.kind && params.kind !== "all")
    searchParams.set("kind", params.kind);
  const query = searchParams.toString();
  return `/admin/marketing/whatsapp-status${query ? `?${query}` : ""}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function statusBadgeClass(status: StatusPublicationLifecycle) {
  if (status === "published") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "deleted") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "expired") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatStatusLabel(status: StatusPublicationLifecycle) {
  return STATUS_PUBLICATION_LIFECYCLE_DETAILS[status].label;
}

function kindBadgeClass(kind: string) {
  if (kind === "video") return "border-sky-200 bg-sky-50 text-sky-700";
  if (kind === "image")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function contentPreview(row: any) {
  if (row.kind === "video") return row.videoUrl || "-";
  if (row.kind === "image") return row.imageUrl || "-";
  return row.message || "-";
}

function formatKindLabel(kind: string) {
  if (kind === "video") return "Vídeo";
  if (kind === "image") return "Imagem";
  return "Texto";
}

function formatExecutionStatus(status?: string | null) {
  if (status === "success") return "sucesso";
  if (status === "error") return "erro";
  if (status === "running") return "em execução";
  return "-";
}

function executionBadgeClass(status?: string | null) {
  if (status === "success")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "error") return "border-red-200 bg-red-50 text-red-700";
  if (status === "running") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatNotificationStatus(status?: string | null) {
  if (status === "success") return "notificação enviada";
  if (status === "error") return "notificação com erro";
  if (status === "skipped") return "sem telefone";
  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const url = new URL(request.url);
  const origin = url.origin;
  const q = String(url.searchParams.get("q") || "").trim();
  const status = normalizeStatusFilter(url.searchParams.get("status") || "all");
  const kind = normalizeKindFilter(url.searchParams.get("kind") || "all");
  const { listStatusPublications } = await import(
    "~/domain/whatsapp-status/whatsapp-status-publication.server"
  );
  const { getWhatsappStatusSchedulerNotificationSettings } = await import(
    "~/domain/whatsapp-status/whatsapp-status-settings.server"
  );

  const publications = (await listStatusPublications({ q, status, kind })).map(
    (row: any) => decorateStatusPublication(row, origin)
  );
  const counts = countStatusPublications(publications);
  const notificationSettings =
    await getWhatsappStatusSchedulerNotificationSettings();

  return json({
    publications,
    filters: { q, status, kind },
    counts,
    notificationSettings,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  const id = String(form.get("id") || "").trim();
  const {
    publishStatusPublication,
    setStatusPublicationActive,
    softDeleteStatusPublication,
  } = await import(
    "~/domain/whatsapp-status/whatsapp-status-publication.server"
  );

  try {
    if (!id) {
      return json({ ok: false, message: "Post inválido." }, { status: 400 });
    }

    if (intent === "activate") {
      await setStatusPublicationActive(id, true);
      return json({ ok: true, message: "Post habilitado." });
    }

    if (intent === "deactivate") {
      await setStatusPublicationActive(id, false);
      return json({ ok: true, message: "Post desativado." });
    }

    if (intent === "publish-now") {
      await publishStatusPublication(id);
      return json({ ok: true, message: "Status publicado." });
    }

    if (intent === "soft-delete") {
      await softDeleteStatusPublication(id);
      return json({ ok: true, message: "Post eliminado." });
    }

    return json({ ok: false, message: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    const response = handleRouteError(error);
    const body = await response.json();
    return json(
      { ok: false, message: body?.error || "Erro ao processar post." },
      { status: response.status }
    );
  }
}

export default function AdminMarketingWhatsappStatusIndex() {
  const { publications, filters, counts, notificationSettings } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const [selectedStat, setSelectedStat] =
    useState<StatusPublicationLifecycle | null>(null);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const statRows = useMemo(
    () =>
      (
        [
          "published",
          "ready",
          "expired",
          "inactive",
          "deleted",
          "error",
        ] as StatusPublicationLifecycle[]
      ).map((status) => ({
        status,
        count: counts[status] || 0,
        ...STATUS_PUBLICATION_LIFECYCLE_DETAILS[status],
      })),
    [counts]
  );
  const selectedStatInfo = selectedStat
    ? STATUS_PUBLICATION_LIFECYCLE_DETAILS[selectedStat]
    : null;

  async function copyDokployScript(row: {
    id: string;
    publishEndpoint: string;
  }) {
    await navigator.clipboard.writeText(
      buildDokployPublishScript(row.publishEndpoint)
    );
    setCopiedScriptId(row.id);
    window.setTimeout(() => setCopiedScriptId(null), 1800);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Whatsapp Status
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie textos, imagens e vídeos que podem ser publicados no Status
            via agendamento externo.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/marketing/whatsapp-status/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo post
          </Link>
        </Button>
      </div>

      {actionData?.message ? (
        <div
          className={
            actionData.ok
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {actionData.message}
        </div>
      ) : null}

      <div className="rounded-md border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        Notificação Dokploy: telefone em{" "}
        <code>{notificationSettings.context}</code> /{" "}
        <code>{notificationSettings.name}</code>
        {notificationSettings.phone
          ? ` (${notificationSettings.phone})`
          : " (não configurado)"}
        .
      </div>

      <Form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Buscar
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Nome, texto, imagem, vídeo..."
            className="h-9 w-72 rounded-md border px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <Select name="status" defaultValue={filters.status}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Habilitados</SelectItem>
              <SelectItem value="inactive">Desativados</SelectItem>
              <SelectItem value="deleted">Eliminados</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Tipo
          <Select name="kind" defaultValue={filters.kind}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{counts.total} total</span>
          {statRows.map((row) => (
            <button
              key={row.status}
              type="button"
              onClick={() => setSelectedStat(row.status)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground transition hover:border-foreground hover:text-foreground"
            >
              {row.count} {row.label.toLowerCase()}
            </button>
          ))}
        </div>
      </Form>

      <Dialog
        open={Boolean(selectedStat)}
        onOpenChange={(open) => {
          if (!open) setSelectedStat(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedStatInfo?.label || "Status"}</DialogTitle>
            <DialogDescription>
              {selectedStatInfo?.description || ""}
            </DialogDescription>
          </DialogHeader>
          {selectedStat ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              Existem {counts[selectedStat] || 0} post(s) neste estado.
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Conteúdo</TableHead>
              <TableHead>Último envio</TableHead>
              <TableHead>Última execução</TableHead>
              <TableHead>Janela 24h</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Dokploy</TableHead>
              <TableHead className="w-[230px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum post encontrado.
                </TableCell>
              </TableRow>
            ) : (
              publications.map((row: any) => {
                const status =
                  row.lifecycleStatus as StatusPublicationLifecycle;
                const statusWindow = row.statusWindow;
                const lastExecution = row.Executions?.[0];
                const windowLabel = statusWindow?.expiresAt
                  ? `${
                      statusWindow.expired ? "Expirou em" : "Expira em"
                    } ${formatDate(statusWindow.expiresAt)}`
                  : "-";
                return (
                  <TableRow
                    key={row.id}
                    className={status === "deleted" ? "opacity-70" : ""}
                  >
                    <TableCell>
                      <Link
                        to={`/admin/marketing/whatsapp-status/${row.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {row.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Atualizado em {formatDate(row.updatedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={kindBadgeClass(row.kind)}
                      >
                        {formatKindLabel(row.kind)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(status)}
                      >
                        {formatStatusLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-sm">
                      {contentPreview(row)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatDate(row.lastPublishedAt)}</div>
                      {row.lastPublishStatus ? (
                        <div className="text-xs text-muted-foreground">
                          {row.lastPublishStatus === "success"
                            ? "sucesso"
                            : "erro"}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lastExecution ? (
                        <div className="grid gap-1">
                          <Badge
                            variant="outline"
                            className={executionBadgeClass(
                              lastExecution.status
                            )}
                          >
                            {formatExecutionStatus(lastExecution.status)}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {lastExecution.source || "api"} ·{" "}
                            {formatDate(lastExecution.startedAt)}
                          </div>
                          {formatNotificationStatus(
                            lastExecution.notificationStatus
                          ) ? (
                            <div className="text-xs text-muted-foreground">
                              {formatNotificationStatus(
                                lastExecution.notificationStatus
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {windowLabel}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        POST {row.publishEndpoint}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyDokployScript(row)}
                        disabled={status === "deleted"}
                        aria-label={`Copiar script Dokploy de ${row.title}`}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedScriptId === row.id ? "Copiado" : "Script"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/admin/marketing/whatsapp-status/${row.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Form method="post">
                          <input type="hidden" name="id" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            name="_intent"
                            value={row.active ? "deactivate" : "activate"}
                            disabled={status === "deleted"}
                          >
                            {row.active ? "Desativar" : "Ativar"}
                          </Button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="id" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            name="_intent"
                            value="publish-now"
                            disabled={status === "deleted" || !row.active}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="id" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="destructive"
                            name="_intent"
                            value="soft-delete"
                            disabled={status === "deleted"}
                          >
                            Eliminar
                          </Button>
                        </Form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
