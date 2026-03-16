import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData, useOutletContext } from "@remix-run/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import prisma from "~/lib/prisma/client.server";

type Context = {
  customer: {
    id: string;
    name: string | null;
    phone_e164: string;
    tags?: Array<{ id: string; tag: { key: string; label: string | null } }>;
  };
};

type MessageItem = {
  id: string;
  created_at: string;
  direction: "inbound" | "outbound";
  source: string | null;
  event_type: string;
  messageText: string;
};

type LoaderData = {
  messages: MessageItem[];
  transcript: string;
  chatGptPrompt: string;
  totalMessages: number;
  filters: {
    from: string;
    to: string;
  };
};

function parsePayloadObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parsePayloadRaw(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsePayloadObject(parsed);
  } catch {
    return null;
  }
}

function pickMessageText(payload: Record<string, unknown> | null, payloadRaw: string | null): string | null {
  const text = typeof payload?.messageText === "string" ? payload.messageText.trim() : "";
  if (text) return text;

  const parsedRaw = parsePayloadRaw(payloadRaw);
  const rawText = typeof parsedRaw?.messageText === "string" ? parsedRaw.messageText.trim() : "";
  if (rawText) return rawText;

  if (parsedRaw) return null;

  const fallback = payloadRaw?.trim() || "";
  return fallback || null;
}

function formatMessageLine(message: MessageItem): string {
  const when = new Date(message.created_at).toLocaleString("pt-BR");
  const author = message.direction === "outbound" ? "Atendente" : "Cliente";
  return `[${when}] ${author}: ${message.messageText}`;
}

function parseDateTimeLocal(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) throw new Response("not found", { status: 404 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const fromDate = parseDateTimeLocal(from);
  const toDate = parseDateTimeLocal(to);
  const hasExplicitRange = Boolean(fromDate || toDate);

  const baseWhere = {
    customer_id: customerId,
    event_type: { in: ["WHATSAPP_RECEIVED", "WHATSAPP_SENT"] as const },
    created_at: {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    },
  };

  const totalMessages = await prisma.crmCustomerEvent.count({
    where: baseWhere,
  });

  const events = await prisma.crmCustomerEvent.findMany({
    where: baseWhere,
    orderBy: { created_at: hasExplicitRange ? "asc" : "desc" },
    take: hasExplicitRange ? 200 : 60,
    select: {
      id: true,
      created_at: true,
      source: true,
      event_type: true,
      payload: true,
      payload_raw: true,
    },
  });
  const orderedEvents = hasExplicitRange ? events : [...events].reverse();

  const messages: MessageItem[] = orderedEvents.flatMap((event) => {
    const payload = parsePayloadObject(event.payload);
    const messageText = pickMessageText(payload, event.payload_raw);
    if (!messageText) return [];

    return [{
      id: event.id,
      created_at: event.created_at.toISOString(),
      direction: event.event_type === "WHATSAPP_SENT" ? "outbound" : "inbound",
      source: event.source,
      event_type: event.event_type,
      messageText,
    }];
  });

  const transcript = messages.length
    ? messages.map(formatMessageLine).join("\n")
    : "Nenhuma mensagem de WhatsApp registrada para este contato.";

  const chatGptPrompt = [
    "Analise a conversa abaixo e proponha a melhor proxima acao comercial/atendimento.",
    "",
    "Retorne:",
    "1. Resumo objetivo da conversa.",
    "2. Intencao principal do cliente.",
    "3. Sentimento do cliente.",
    "4. Pendencias e riscos.",
    "5. Proxima resposta recomendada em portugues do Brasil.",
    "6. Acoes operacionais sugeridas para o time.",
    "",
    "Conversa:",
    transcript,
  ].join("\n");

  return json<LoaderData>({
    messages,
    transcript,
    chatGptPrompt,
    totalMessages,
    filters: {
      from,
      to,
    },
  });
}

export const meta: MetaFunction = () => [{ title: "CRM - Conversa" }];

export default function AdminCrmCustomerConversation() {
  const { messages, transcript, chatGptPrompt, totalMessages, filters } = useLoaderData<typeof loader>();
  const { customer } = useOutletContext<Context>();
  const tagLabels = customer.tags?.map((item) => item.tag.label || item.tag.key) || [];
  const isPartialLoad = !filters.from && !filters.to && totalMessages > messages.length;
  const promptWithContext = [
    `Contato: ${customer.name || "Sem nome"}`,
    `Telefone: ${customer.phone_e164}`,
    `Tags: ${tagLabels.length ? tagLabels.join(", ") : "Sem tags"}`,
    "",
    chatGptPrompt,
  ].join("\n");

  return (
    <div className="grid gap-6 font-neue">
      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Conversa WhatsApp</CardTitle>
            <CardDescription>
              Histórico em ordem cronológica, preparado para copiar e colar no ChatGPT.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              textToCopy={transcript}
              label="Copiar conversa"
              variant="outline"
              classNameButton="px-3"
              classNameIcon="text-current"
              toastTitle="OK"
              toastContent="Conversa copiada"
            />
            <CopyButton
              textToCopy={promptWithContext}
              label="Copiar prompt"
              classNameButton="px-3"
              classNameIcon="text-current"
              toastTitle="OK"
              toastContent="Prompt copiado"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <p><span className="font-medium">Contato:</span> {customer.name || "Sem nome"}</p>
            <p><span className="font-medium">Telefone:</span> {customer.phone_e164}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Tags:</span>
              {tagLabels.length ? (
                tagLabels.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Sem tags</span>
              )}
            </div>
            <p>
              <span className="font-medium">Mensagens:</span> {messages.length}
              {isPartialLoad ? ` de ${totalMessages} mais recentes` : totalMessages !== messages.length ? ` de ${totalMessages}` : ""}
            </p>
          </div>

          <Form method="get" className="grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-[1fr,1fr,auto,auto] md:items-end">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">De</label>
              <Input type="datetime-local" name="from" defaultValue={filters.from} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Até</label>
              <Input type="datetime-local" name="to" defaultValue={filters.to} />
            </div>
            <Button type="submit">Filtrar</Button>
            <Button asChild variant="outline">
              <Link to={`/admin/crm/${customer.id}/conversation`}>Limpar</Link>
            </Button>
          </Form>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Prompt pronto para ChatGPT</p>
              <span className="text-xs text-muted-foreground">Inclui instrucoes + conversa</span>
            </div>
            <Textarea value={promptWithContext} readOnly rows={12} className="font-mono text-xs" />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Transcricao</p>
              <span className="text-xs text-muted-foreground">Somente a conversa</span>
            </div>
            <Textarea value={transcript} readOnly rows={16} className="font-mono text-xs" />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Visualizacao rapida</p>
            {isPartialLoad ? (
              <p className="text-xs text-muted-foreground">
                Carregando por padrão só as 60 mensagens mais recentes. Use o filtro por data e horário para ampliar o período.
              </p>
            ) : null}
            {messages.length ? (
              <div className="rounded-3xl border border-border bg-[linear-gradient(180deg,rgba(120,119,198,0.05),rgba(120,119,198,0)_22%),linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0)_42%)]">
                <ScrollArea className="h-[520px] p-3 sm:p-4">
                  <div className="grid gap-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-[88%] sm:max-w-[75%]">
                          <div
                            className={`rounded-3xl px-4 py-3 shadow-sm ${
                              message.direction === "outbound"
                                ? "rounded-br-md bg-emerald-500 text-emerald-50"
                                : "rounded-bl-md border border-border bg-background text-foreground"
                            }`}
                          >
                            <div
                              className={`mb-2 flex flex-wrap items-center gap-2 text-[11px] ${
                                message.direction === "outbound"
                                  ? "text-emerald-100/90"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <span className="font-medium">
                                {message.direction === "outbound" ? "Atendente" : "Cliente"}
                              </span>
                              <span>{new Date(message.created_at).toLocaleString("pt-BR")}</span>
                              {message.source ? <span>• {message.source}</span> : null}
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.messageText}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma conversa registrada ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
