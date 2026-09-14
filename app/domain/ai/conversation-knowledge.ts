export type ConversationKnowledgeSourceMessage = {
  messageText: string;
  createdAt: Date;
};

export type ConversationKnowledgeCluster = {
  fingerprint: string;
  category: string;
  canonicalQuestion: string;
  occurrenceCount: number;
  confidence: number;
  examples: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
};

const STOP_WORDS = new Set([
  "a",
  "as",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "me",
  "meu",
  "minha",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "pra",
  "pro",
  "que",
  "um",
  "uma",
  "vcs",
  "voce",
  "voces",
]);

const CATEGORIES: Array<[string, RegExp]> = [
  ["entrega", /\b(entrega|entregam|delivery|bairro|taxa|demora|tempo|chega)\b/],
  ["cardapio", /\b(cardapio|menu|sabores?|pizza|pizzas|ingredientes?)\b/],
  ["preco", /\b(preco|precos|valor|valores|custa|quanto|promo|promocao)\b/],
  ["horario", /\b(horario|aberto|abrem|fecha|fecham|funciona)\b/],
  ["pedido", /\b(pedido|pedir|comprar|encomenda|encomendar)\b/],
  ["pagamento", /\b(pagamento|pagar|pix|cartao|dinheiro|troco)\b/],
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g, " ")
    .replace(/\b\d{8,}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function redactConversationExample(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(
      /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/g,
      "[telefone]"
    )
    .trim()
    .slice(0, 280);
}

function fingerprintFor(value: string) {
  const tokens = normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return [...new Set(tokens)].sort().slice(0, 12).join("-");
}

function categoryFor(value: string) {
  const normalized = normalize(value);
  return (
    CATEGORIES.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "geral"
  );
}

function isUsefulQuestion(value: string) {
  const normalized = normalize(value);
  if (normalized.length < 8 || normalized.length > 280) return false;
  if (
    /^(oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|sim|nao)$/.test(
      normalized
    )
  )
    return false;
  return /\?|\b(qual|quais|quanto|quando|como|onde|tem|teria|faz|entrega|aceita|pode|posso|voc[eê]s?)\b/i.test(
    value
  );
}

export function buildConversationKnowledgeClusters(
  messages: ConversationKnowledgeSourceMessage[],
  minimumOccurrences = 2
) {
  const groups = new Map<string, ConversationKnowledgeSourceMessage[]>();
  for (const message of messages) {
    if (!isUsefulQuestion(message.messageText)) continue;
    const fingerprint = fingerprintFor(message.messageText);
    if (!fingerprint || fingerprint.length > 255) continue;
    groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), message]);
  }

  return [...groups.entries()]
    .filter(([, rows]) => rows.length >= minimumOccurrences)
    .map(([fingerprint, rows]): ConversationKnowledgeCluster => {
      const ordered = [...rows].sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
      );
      const representative = [...rows].sort(
        (left, right) => left.messageText.length - right.messageText.length
      )[0];
      return {
        fingerprint,
        category: categoryFor(representative.messageText),
        canonicalQuestion: redactConversationExample(
          representative.messageText
        ),
        occurrenceCount: rows.length,
        confidence: Math.min(0.95, 0.45 + rows.length * 0.05),
        examples: [
          ...new Set(
            rows.map((row) => redactConversationExample(row.messageText))
          ),
        ].slice(0, 3),
        firstSeenAt: ordered[0].createdAt,
        lastSeenAt: ordered.at(-1)!.createdAt,
      };
    })
    .sort((left, right) => right.occurrenceCount - left.occurrenceCount);
}
