import { useState } from "react";
import { Form, Link } from "@remix-run/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import type { CrmConversationMessage } from "~/domain/crm/crm-conversation";

type Customer = {
  id: string;
  name: string | null;
  phone_e164: string;
};

const MESSAGE_PREVIEW_LENGTH = 240;

function getMessagePreview(message: string) {
  const preview = message.slice(0, MESSAGE_PREVIEW_LENGTH);
  const lastSpace = preview.lastIndexOf(" ");
  const safeEnd =
    lastSpace > MESSAGE_PREVIEW_LENGTH * 0.75
      ? lastSpace
      : MESSAGE_PREVIEW_LENGTH;

  return `${preview.slice(0, safeEnd).trimEnd()}…`;
}

export function CrmConversationSummary({
  customer,
  tagLabels,
  visibleMessages,
  totalMessages,
  isPartialLoad,
}: {
  customer: Customer;
  tagLabels: string[];
  visibleMessages: number;
  totalMessages: number;
  isPartialLoad: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm">
      <p className="min-w-0">
        <span className="font-medium">Contato:</span>{" "}
        {customer.name || "Sem nome"}
      </p>
      <p className="min-w-0">
        <span className="font-medium">Telefone:</span> {customer.phone_e164}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="font-medium">Tags:</span>
        {tagLabels.length ? (
          tagLabels.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">Sem tags</span>
        )}
      </div>
      <p className="whitespace-nowrap sm:ml-auto">
        <span className="font-medium">Mensagens:</span> {visibleMessages}
        {isPartialLoad
          ? ` de ${totalMessages} mais recentes`
          : totalMessages !== visibleMessages
          ? ` de ${totalMessages}`
          : ""}
      </p>
    </div>
  );
}

export function CrmConversationFilters({
  customerId,
  filters,
}: {
  customerId: string;
  filters: { from: string; to: string };
}) {
  return (
    <Form
      method="get"
      className="grid gap-2 rounded-lg border border-border bg-background p-3 md:grid-cols-[1fr,1fr,auto,auto] md:items-end"
    >
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground">De</label>
        <Input
          type="datetime-local"
          name="from"
          defaultValue={filters.from}
          className="h-9"
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground">Até</label>
        <Input
          type="datetime-local"
          name="to"
          defaultValue={filters.to}
          className="h-9"
        />
      </div>
      <Button type="submit" size="sm">
        Filtrar
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link to={`/admin/crm/${customerId}/conversation`}>Limpar</Link>
      </Button>
    </Form>
  );
}

function MessageBubble({ message }: { message: CrmConversationMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOutbound = message.direction === "outbound";
  const canExpand = message.messageText.length > MESSAGE_PREVIEW_LENGTH;
  const visibleText =
    canExpand && !isExpanded
      ? getMessagePreview(message.messageText)
      : message.messageText;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className="min-w-0 max-w-[88%] sm:max-w-[75%]">
        <div
          className={`min-w-0 overflow-hidden rounded-3xl px-4 py-3 shadow-sm ${
            isOutbound
              ? "rounded-br-md bg-emerald-500 text-emerald-50"
              : "rounded-bl-md border border-border bg-background text-foreground"
          }`}
        >
          <div
            className={`mb-2 flex flex-wrap items-center gap-2 text-[11px] ${
              isOutbound ? "text-emerald-100/90" : "text-muted-foreground"
            }`}
          >
            <span className="font-medium">
              {isOutbound ? "Atendente" : "Cliente"}
            </span>
            <span>{new Date(message.created_at).toLocaleString("pt-BR")}</span>
            {message.source ? <span>• {message.source}</span> : null}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
            {visibleText}
          </p>
          {canExpand ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
              className={`mt-2 text-xs font-semibold underline underline-offset-4 ${
                isOutbound
                  ? "text-emerald-50 hover:text-white"
                  : "text-primary hover:text-primary/80"
              }`}
            >
              {isExpanded ? "Ver menos" : "Ver mais"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({
  messages,
  isPartialLoad,
}: {
  messages: CrmConversationMessage[];
  isPartialLoad: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      {isPartialLoad ? (
        <p className="text-xs text-muted-foreground">
          Exibindo as 60 mensagens mais recentes. Use o filtro para ampliar o
          período.
        </p>
      ) : null}
      {messages.length ? (
        <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-[linear-gradient(180deg,rgba(120,119,198,0.05),rgba(120,119,198,0)_22%),linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0)_42%)]">
          <ScrollArea className="h-[520px] w-full">
            <div className="grid min-w-0 gap-3 p-3 sm:p-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma conversa registrada ainda.
        </p>
      )}
    </div>
  );
}

function TextPanel({
  value,
  prompt = false,
}: {
  value: string;
  prompt?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {prompt
            ? "Instruções e contexto do cliente prontos para análise."
            : "Conteúdo cronológico, sem instruções adicionais."}
        </p>
        <CopyButton
          textToCopy={value}
          label={prompt ? "Copiar prompt" : "Copiar conversa"}
          variant={prompt ? "default" : "outline"}
          classNameButton="px-3"
          classNameIcon="text-current"
          toastTitle="OK"
          toastContent={prompt ? "Prompt copiado" : "Conversa copiada"}
        />
      </div>
      <Textarea
        value={value}
        readOnly
        rows={prompt ? 18 : 20}
        className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs [overflow-wrap:anywhere]"
      />
    </div>
  );
}

export function CrmConversationWorkspace({
  messages,
  transcript,
  prompt,
  isPartialLoad,
}: {
  messages: CrmConversationMessage[];
  transcript: string;
  prompt: string;
  isPartialLoad: boolean;
}) {
  return (
    <Tabs defaultValue="conversation" className="grid min-w-0 gap-4">
      <div className="overflow-x-auto">
        <TabsList className="grid min-w-[420px] grid-cols-3">
          <TabsTrigger value="conversation">Conversa</TabsTrigger>
          <TabsTrigger value="transcript">Transcrição</TabsTrigger>
          <TabsTrigger value="analysis">Análise IA</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="conversation" className="mt-0 min-w-0">
        <ChatPanel messages={messages} isPartialLoad={isPartialLoad} />
      </TabsContent>
      <TabsContent value="transcript" className="mt-0 min-w-0">
        <TextPanel value={transcript} />
      </TabsContent>
      <TabsContent value="analysis" className="mt-0 min-w-0">
        <TextPanel value={prompt} prompt />
      </TabsContent>
    </Tabs>
  );
}
