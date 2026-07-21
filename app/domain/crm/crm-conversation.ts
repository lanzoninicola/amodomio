export type CrmConversationMessage = {
  id: string;
  created_at: string;
  direction: "inbound" | "outbound";
  source: string | null;
  event_type: string;
  messageText: string;
};

type CrmConversationEvent = {
  id: string;
  created_at: Date;
  source: string | null;
  event_type: string;
  payload: unknown;
  payload_raw: string | null;
};

function parsePayloadObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parsePayloadRaw(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return parsePayloadObject(JSON.parse(raw));
  } catch {
    return null;
  }
}

function pickMessageText(
  payload: Record<string, unknown> | null,
  payloadRaw: string | null
): string | null {
  const text =
    typeof payload?.messageText === "string" ? payload.messageText.trim() : "";
  if (text) return text;

  const parsedRaw = parsePayloadRaw(payloadRaw);
  const rawText =
    typeof parsedRaw?.messageText === "string"
      ? parsedRaw.messageText.trim()
      : "";
  if (rawText) return rawText;
  if (parsedRaw) return null;

  return payloadRaw?.trim() || null;
}

export function toCrmConversationMessages(
  events: CrmConversationEvent[]
): CrmConversationMessage[] {
  return events.flatMap((event) => {
    const messageText = pickMessageText(
      parsePayloadObject(event.payload),
      event.payload_raw
    );
    if (!messageText) return [];

    return [
      {
        id: event.id,
        created_at: event.created_at.toISOString(),
        direction:
          event.event_type === "WHATSAPP_SENT" ? "outbound" : "inbound",
        source: event.source,
        event_type: event.event_type,
        messageText,
      } satisfies CrmConversationMessage,
    ];
  });
}

export function buildCrmConversationTranscript(
  messages: CrmConversationMessage[]
) {
  if (!messages.length) {
    return "Nenhuma mensagem de WhatsApp registrada para este contato.";
  }

  return messages
    .map((message) => {
      const when = new Date(message.created_at).toLocaleString("pt-BR");
      const author = message.direction === "outbound" ? "Atendente" : "Cliente";
      return `[${when}] ${author}: ${message.messageText}`;
    })
    .join("\n");
}

export function buildCrmConversationAnalysisPrompt(transcript: string) {
  return [
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
}
