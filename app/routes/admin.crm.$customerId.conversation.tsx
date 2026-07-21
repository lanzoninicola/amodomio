import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  CrmConversationFilters,
  CrmConversationSummary,
  CrmConversationWorkspace,
} from "~/components/crm/crm-conversation-panels";
import {
  buildCrmConversationAnalysisPrompt,
  buildCrmConversationTranscript,
  toCrmConversationMessages,
  type CrmConversationMessage,
} from "~/domain/crm/crm-conversation";
import prisma from "~/lib/prisma/client.server";

type Context = {
  customer: {
    id: string;
    name: string | null;
    phone_e164: string;
    tags?: Array<{ id: string; tag: { key: string; label: string | null } }>;
  };
};

type LoaderData = {
  messages: CrmConversationMessage[];
  transcript: string;
  chatGptPrompt: string;
  totalMessages: number;
  filters: {
    from: string;
    to: string;
  };
};

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

  const messages = toCrmConversationMessages(orderedEvents);
  const transcript = buildCrmConversationTranscript(messages);
  const chatGptPrompt = buildCrmConversationAnalysisPrompt(transcript);

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
  const { messages, transcript, chatGptPrompt, totalMessages, filters } =
    useLoaderData<typeof loader>();
  const { customer } = useOutletContext<Context>();
  const tagLabels =
    customer.tags?.map((item) => item.tag.label || item.tag.key) || [];
  const isPartialLoad =
    !filters.from && !filters.to && totalMessages > messages.length;
  const promptWithContext = [
    `Contato: ${customer.name || "Sem nome"}`,
    `Telefone: ${customer.phone_e164}`,
    `Tags: ${tagLabels.length ? tagLabels.join(", ") : "Sem tags"}`,
    "",
    chatGptPrompt,
  ].join("\n");

  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid min-w-0 gap-3 overflow-hidden">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-0.5">
            <CardTitle>Conversa WhatsApp</CardTitle>
            <CardDescription>
              Histórico em ordem cronológica, preparado para copiar e colar no
              ChatGPT.
            </CardDescription>
          </div>
        </header>
        <div className="grid min-w-0 gap-3">
          <CrmConversationSummary
            customer={customer}
            tagLabels={tagLabels}
            visibleMessages={messages.length}
            totalMessages={totalMessages}
            isPartialLoad={isPartialLoad}
          />
          <CrmConversationFilters customerId={customer.id} filters={filters} />
          <CrmConversationWorkspace
            messages={messages}
            transcript={transcript}
            prompt={promptWithContext}
            isPartialLoad={isPartialLoad}
          />
        </div>
      </section>
    </div>
  );
}
