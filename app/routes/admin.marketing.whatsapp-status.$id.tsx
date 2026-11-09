import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { authenticator } from "~/domain/auth/google.server";
import {
  buildDokployPublishScript,
  decorateStatusPublication,
  normalizeStatusKind,
  type StatusPublicationKind,
} from "~/domain/whatsapp-status/whatsapp-status-publication.shared";
import { handleRouteError } from "~/domain/z-api/route-helpers.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.publication?.title || "Whatsapp Status"} | Marketing` },
];

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
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
  if (status === "success") return "enviada";
  if (status === "error") return "erro";
  if (status === "skipped") return "ignorada";
  return "-";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const url = new URL(request.url);
  const { getStatusPublication } = await import(
    "~/domain/whatsapp-status/whatsapp-status-publication.server"
  );
  const { getWhatsappStatusSchedulerNotificationSettings } = await import(
    "~/domain/whatsapp-status/whatsapp-status-settings.server"
  );
  const publication = decorateStatusPublication(
    await getStatusPublication(String(params.id || "")),
    url.origin
  );
  const notificationSettings =
    await getWhatsappStatusSchedulerNotificationSettings();

  return json({
    publication,
    publishEndpoint: publication.publishEndpoint,
    notificationSettings,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const id = String(params.id || "");
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  const { publishStatusPublication, updateStatusPublication } = await import(
    "~/domain/whatsapp-status/whatsapp-status-publication.server"
  );

  try {
    if (intent === "publish-now") {
      await publishStatusPublication(id);
      return json({ ok: true, message: "Status publicado." });
    }

    const publication = await updateStatusPublication(id, {
      title: String(form.get("title") || ""),
      kind: normalizeStatusKind(form.get("kind")),
      message: String(form.get("message") || ""),
      imageUrl: String(form.get("imageUrl") || ""),
      videoUrl: String(form.get("videoUrl") || ""),
      caption: String(form.get("caption") || ""),
      active: String(form.get("active") || "") === "true",
    });

    return json({
      ok: true,
      message: "Post salvo.",
      publication,
    });
  } catch (error: any) {
    const response = handleRouteError(error);
    const body = await response.json();
    return json(
      { ok: false, message: body?.error || "Erro ao salvar post." },
      { status: response.status }
    );
  }
}

export default function AdminMarketingWhatsappStatusEdit() {
  const { publication, publishEndpoint, notificationSettings } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const [kind, setKind] = useState<StatusPublicationKind>(
    normalizeStatusKind(publication.kind)
  );
  const [active, setActive] = useState(Boolean(publication.active));
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedDokployScript, setCopiedDokployScript] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const deleted = Boolean(publication.deletedAt);
  const statusWindow = publication.statusWindow;
  const windowLabel = statusWindow?.expiresAt
    ? `${statusWindow.expired ? "Expirou em" : "Expira em"} ${formatDate(
        statusWindow.expiresAt
      )}`
    : "-";
  const dokployScript = buildDokployPublishScript(publishEndpoint);

  async function copyEndpoint() {
    await navigator.clipboard.writeText(publishEndpoint);
    setCopiedEndpoint(true);
    window.setTimeout(() => setCopiedEndpoint(false), 1800);
  }

  async function copyDokployScript() {
    await navigator.clipboard.writeText(dokployScript);
    setCopiedDokployScript(true);
    window.setTimeout(() => setCopiedDokployScript(false), 1800);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {publication.title}
            </h1>
            <Badge variant={active ? "default" : "secondary"}>
              {deleted ? "Eliminado" : active ? "Habilitado" : "Desativado"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Edite o conteúdo e use o endpoint específico para agendar esta post.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/marketing/whatsapp-status">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
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

      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-medium">Endpoint para agendamento externo</div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyEndpoint}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copiedEndpoint ? "URL copiada" : "Copiar URL"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyDokployScript}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copiedDokployScript ? "Script copiado" : "Copiar script Dokploy"}
            </Button>
          </div>
        </div>
        <code className="mt-2 block break-all rounded bg-background px-2 py-1 text-xs">
          {publishEndpoint}
        </code>
        <div className="mt-2 text-xs text-muted-foreground">
          Método: <code>POST</code>. Header: <code>x-api-key</code> com{" "}
          <code>VITE_REST_API_SECRET_KEY</code>. Corpo identifica a origem como
          Dokploy.
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Notificação: telefone em <code>{notificationSettings.context}</code> /{" "}
          <code>{notificationSettings.name}</code>
          {notificationSettings.phone
            ? ` (${notificationSettings.phone})`
            : " (não configurado)"}
          .
        </div>
        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
          <code>{dokployScript}</code>
        </pre>
      </div>

      <Form method="post" className="grid gap-5 bg-white">
        <input type="hidden" name="active" value={active ? "true" : "false"} />

        <div className="grid gap-2">
          <Label htmlFor="title">Nome do post</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={publication.title}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <Label className="text-sm font-medium">Post habilitado</Label>
            <div className="text-xs text-muted-foreground">
              {deleted
                ? "Posts eliminados ficam apenas para histórico."
                : "Posts habilitados podem ser chamados pelo agendador externo."}
            </div>
          </div>
          <Switch
            checked={active}
            onCheckedChange={setActive}
            disabled={deleted}
          />
        </div>

        <div className="grid gap-2">
          <Label>Tipo de status</Label>
          <Select
            name="kind"
            value={kind}
            onValueChange={(value) => setKind(normalizeStatusKind(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "text" ? (
          <div className="grid gap-2">
            <Label htmlFor="message">Texto do status</Label>
            <Textarea
              id="message"
              name="message"
              rows={8}
              defaultValue={publication.message || ""}
            />
          </div>
        ) : kind === "image" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">URL pública da imagem</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                defaultValue={publication.imageUrl || ""}
                placeholder="https://seu-dominio.com/imagem.jpg"
              />
              <p className="text-xs text-muted-foreground">
                A Z-API aceita link público da imagem ou Base64. Prefira URL do
                servidor de mídia.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="caption">Legenda</Label>
              <Input
                id="caption"
                name="caption"
                defaultValue={publication.caption || ""}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="videoUrl">URL pública do vídeo</Label>
              <Input
                id="videoUrl"
                name="videoUrl"
                defaultValue={publication.videoUrl || ""}
                placeholder="https://seu-dominio.com/video.mp4"
              />
              <p className="text-xs text-muted-foreground">
                Use H.264 e mantenha o arquivo em até 100 MB para Status.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="caption">Legenda</Label>
              <Input
                id="caption"
                name="caption"
                defaultValue={publication.caption || ""}
              />
            </div>
          </div>
        )}

        <div className="grid gap-1 text-xs text-muted-foreground">
          <div>Último envio: {formatDate(publication.lastPublishedAt)}</div>
          <div>Janela do Status: {windowLabel}</div>
          <div>
            Resultado:{" "}
            {publication.lastPublishStatus
              ? publication.lastPublishStatus === "success"
                ? "sucesso"
                : "erro"
              : "-"}
          </div>
          {publication.lastPublishError ? (
            <div className="rounded bg-red-50 p-2 text-red-800">
              {publication.lastPublishError}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-md border bg-background p-4">
          <div>
            <h2 className="text-sm font-medium">Histórico de execuções</h2>
            <p className="text-xs text-muted-foreground">
              Registra chamadas manuais e chamadas feitas pelo Dokploy que
              chegaram nesta API.
            </p>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notificação</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publication.Executions?.length ? (
                  publication.Executions.map((execution: any) => (
                    <TableRow key={execution.id}>
                      <TableCell className="text-sm">
                        {formatDate(execution.startedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{execution.source || "api"}</div>
                        {execution.scheduleName ? (
                          <div className="text-xs text-muted-foreground">
                            {execution.scheduleName}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={executionBadgeClass(execution.status)}
                        >
                          {formatExecutionStatus(execution.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          {formatNotificationStatus(
                            execution.notificationStatus
                          )}
                        </div>
                        {execution.notificationError ? (
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {execution.notificationError}
                          </div>
                        ) : execution.notificationPhone ? (
                          <div className="text-xs text-muted-foreground">
                            {execution.notificationPhone}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {execution.durationMs != null
                          ? `${execution.durationMs} ms`
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                        {execution.error || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma execução registrada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="submit"
            name="_intent"
            value="publish-now"
            variant="outline"
            disabled={isSubmitting || !active || deleted}
          >
            <Send className="mr-2 h-4 w-4" />
            Publicar agora
          </Button>
          <Button
            type="submit"
            name="_intent"
            value="save"
            disabled={isSubmitting}
          >
            Salvar post
          </Button>
        </div>
      </Form>
    </div>
  );
}
