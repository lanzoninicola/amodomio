import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigation, Form } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import prismaClient from "~/lib/prisma/client.server";
import { clearWebhookLogs, getWebhookLogs } from "~/domain/z-api/webhook-log.server";

type LoaderData = {
  event: "received" | "disconnected" | "traffic" | "all";
  logs: Array<{
    id: string;
    event: string | null;
    correlationId: string;
    timestamp: number;
    headers?: Record<string, string> | null;
    payloadPreview: string | null;
    source: "memory" | "stored";
    phone?: string | null;
    messageText?: string | null;
    sent?: boolean;
    reason?: string | null;
  }>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const event = (url.searchParams.get("event") as LoaderData["event"]) || "all";

  const memoryLogs =
    event === "all"
      ? getWebhookLogs()
      : getWebhookLogs(event as "received" | "disconnected" | "traffic");

  const storedLogs = await prismaClient.metaAdsLog.findMany({
    where: event === "all" ? undefined : { event },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const normalizedMemoryLogs = memoryLogs.map((log) => ({
    id: log.id,
    event: log.event,
    correlationId: log.correlationId,
    timestamp: log.timestamp,
    headers: log.headers,
    payloadPreview: log.payloadPreview,
    source: "memory" as const,
  }));

  const normalizedStoredLogs = storedLogs.map((log) => ({
    id: log.id,
    event: log.event,
    correlationId: log.correlationId ?? "-",
    timestamp: log.createdAt.getTime(),
    headers: null,
    payloadPreview: log.payloadPreview,
    source: "stored" as const,
    phone: log.phone,
    messageText: log.messageText,
    sent: log.sent,
    reason: log.reason,
  }));

  const logs = [...normalizedStoredLogs, ...normalizedMemoryLogs].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  return json<LoaderData>({ event, logs });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");

  if (intent === "clear") {
    clearWebhookLogs();
    const event = form.get("event");
    const params = new URLSearchParams();
    if (event) params.set("event", String(event));
    return redirect(`/admin/zapi/logs${params.toString() ? `?${params.toString()}` : ""}`);
  }

  if (intent === "clear-stored") {
    await prismaClient.metaAdsLog.deleteMany();
    const event = form.get("event");
    const params = new URLSearchParams();
    if (event) params.set("event", String(event));
    return redirect(`/admin/zapi/logs${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return redirect("/admin/zapi/logs");
}

export default function AdminZapiLogsPage() {
  const { event, logs } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [formattedById, setFormattedById] = useState<Record<string, boolean>>({});
  const [hideSelfReceived, setHideSelfReceived] = useState(true);

  const formattedPayloadById = useMemo(() => {
    const formatJson = (value: string | null | undefined) => {
      if (!value) return "";
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    };

    return logs.reduce<Record<string, string>>((acc, log) => {
      acc[`${log.source}-${log.id}`] = formatJson(log.payloadPreview ?? "");
      return acc;
    }, {});
  }, [logs]);

  const handleCopy = async (value: string) => {
    if (!value) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  const shouldHideLog = (payloadPreview: string | null | undefined) => {
    if (!hideSelfReceived) return false;
    if (!payloadPreview) return false;
    const normalized = payloadPreview.toLowerCase();
    return normalized.includes("receivedcallback") && normalized.includes("\"fromme\":true");
  };

  return (
    <div className="flex max-w-6xl flex-col gap-6 px-4 py-8 font-neue">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs de Webhooks Z-API</h1>
          <p className="text-sm text-muted-foreground">
            Visualize logs em memória e logs armazenados (META_ADS).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Form method="get" className="flex items-center gap-3">
            <Select
              name="event"
              defaultValue={event}
              onValueChange={(value) => {
                const form = document.createElement("form");
                form.method = "get";
                form.innerHTML = `<input name="event" value="${value}" />`;
                form.submit();
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="traffic">Traffic</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="submit"
              variant="outline"
              disabled={isLoading}
            >
              {isLoading ? "Atualizando..." : "Atualizar"}
            </Button>
          </Form>

          <Form method="post">
            <input type="hidden" name="_intent" value="clear" />
            <input type="hidden" name="event" value={event} />
            <Button type="submit" variant="destructive" disabled={isLoading}>
              Limpar in-memory
            </Button>
          </Form>

          <Form method="post">
            <input type="hidden" name="_intent" value="clear-stored" />
            <input type="hidden" name="event" value={event} />
            <Button type="submit" variant="destructive" disabled={isLoading}>
              Limpar armazenados
            </Button>
          </Form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos</CardTitle>
          <CardDescription>
            Mostrando {logs.length} registro(s) • filtro: {event}
          </CardDescription>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              id="hide-self-received"
              checked={hideSelfReceived}
              onCheckedChange={setHideSelfReceived}
            />
            <Label htmlFor="hide-self-received">
              Ignorar ReceivedCallback + fromMe=true
            </Label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {logs.length === 0 && (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Nenhum webhook registrado ainda. Aguarde chamadas para visualizar aqui.
            </div>
          )}

          {logs
            .filter((log) => !shouldHideLog(log.payloadPreview))
            .map((log) => (
            <div key={`${log.source}-${log.id}`} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2 py-1 text-primary font-semibold text-[11px]">
                  {log.event || "unknown"}
                </span>
                <span
                  className={
                    log.source === "stored"
                      ? "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                      : "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
                  }
                >
                  {log.source === "stored" ? "armazenado" : "in-memory"}
                </span>
                <span>Correlation: {log.correlationId}</span>
                <span>{new Date(log.timestamp).toLocaleString("pt-BR")}</span>
                {log.source === "stored" && log.phone ? <span>Telefone: {log.phone}</span> : null}
                {log.source === "stored" ? (
                  <span>Resposta: {log.sent ? "enviada" : "falhou"}</span>
                ) : null}
                {log.source === "stored" && log.reason ? <span>Motivo: {log.reason}</span> : null}
              </div>
              {log.source === "memory" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Headers:</span>
                  <code className="rounded bg-black/5 px-1 py-0.5">{JSON.stringify(log.headers)}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => handleCopy(JSON.stringify(log.headers ?? {}))}
                  >
                    Copiar headers
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => handleCopy(JSON.stringify(log.headers ?? {}, null, 2))}
                  >
                    Copiar headers formatado
                  </Button>
                </div>
              ) : null}
              {log.source === "stored" && log.messageText ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-semibold">Mensagem:</span> {log.messageText.slice(0, 180)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() =>
                    setFormattedById((current) => ({
                      ...current,
                      [`${log.source}-${log.id}`]: !current[`${log.source}-${log.id}`],
                    }))
                  }
                >
                  {formattedById[`${log.source}-${log.id}`] ? "JSON compacto" : "Formatar JSON"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => handleCopy(log.payloadPreview ?? "")}
                >
                  Copiar conteúdo
                </Button>
                <Dialog
                  open={expandedLogId === `${log.source}-${log.id}`}
                  onOpenChange={(open) => setExpandedLogId(open ? `${log.source}-${log.id}` : null)}
                >
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                      Expandir
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Payload formatado</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopy(formattedPayloadById[`${log.source}-${log.id}`] || "")}
                      >
                        Copiar
                      </Button>
                    </div>
                    <pre className="mt-3 max-h-[60vh] overflow-auto rounded bg-black/5 p-4 text-xs text-foreground">
                      {formattedPayloadById[`${log.source}-${log.id}`] || "Sem payload armazenado."}
                    </pre>
                  </DialogContent>
                </Dialog>
              </div>
              <pre className="mt-2 max-h-[240px] overflow-auto rounded bg-black/5 p-4 pr-6 pb-4 text-xs text-foreground">
                {formattedById[`${log.source}-${log.id}`]
                  ? formattedPayloadById[`${log.source}-${log.id}`] || "Sem payload armazenado."
                  : log.payloadPreview || "Sem payload armazenado."}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
