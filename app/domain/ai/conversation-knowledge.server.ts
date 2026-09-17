import prisma from "~/lib/prisma/client.server";
import { buildConversationKnowledgeClusters } from "./conversation-knowledge";

const CONVERSATION_SOURCES = [
  "zapi-webhook",
  "zapi-send-text",
  "zapi-auto-reply",
  "api.messages.text",
] as const;

function messageTextFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const messageText = (payload as Record<string, unknown>).messageText;
  return typeof messageText === "string" && messageText.trim()
    ? messageText.trim()
    : null;
}

export async function scanCrmConversationKnowledge(params?: {
  days?: number;
  limit?: number;
  minimumOccurrences?: number;
}) {
  const days = Math.min(3650, Math.max(1, params?.days ?? 365));
  const limit = Math.min(30_000, Math.max(100, params?.limit ?? 25_000));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);

  const events = await prisma.crmCustomerEvent.findMany({
    where: {
      event_type: "WHATSAPP_RECEIVED",
      source: { in: [...CONVERSATION_SOURCES] },
      created_at: { gte: since },
    },
    orderBy: { created_at: "desc" },
    take: limit,
    select: { payload: true, created_at: true },
  });

  const messages = events.flatMap((event) => {
    const messageText = messageTextFromPayload(event.payload);
    return messageText ? [{ messageText, createdAt: event.created_at }] : [];
  });
  const clusters = buildConversationKnowledgeClusters(
    messages,
    params?.minimumOccurrences ?? 2
  );
  if (!clusters.length) {
    return {
      scannedEvents: events.length,
      messagesWithText: messages.length,
      clusters: 0,
      created: 0,
      refreshed: 0,
      truncated: events.length === limit,
    };
  }
  const existing = await prisma.aiConversationKnowledgeCandidate.findMany({
    where: {
      fingerprint: { in: clusters.map((cluster) => cluster.fingerprint) },
    },
    select: { id: true, fingerprint: true, status: true },
  });
  const existingByFingerprint = new Map(
    existing.map((row) => [row.fingerprint, row])
  );
  let created = 0;
  let refreshed = 0;

  for (let index = 0; index < clusters.length; index += 100) {
    const batch = clusters.slice(index, index + 100);
    await prisma.$transaction(
      batch.map((cluster) => {
        const current = existingByFingerprint.get(cluster.fingerprint);
        if (!current) {
          created += 1;
          return prisma.aiConversationKnowledgeCandidate.create({
            data: cluster,
          });
        }
        refreshed += 1;
        return prisma.aiConversationKnowledgeCandidate.update({
          where: { id: current.id },
          data: {
            category: cluster.category,
            occurrenceCount: cluster.occurrenceCount,
            confidence: cluster.confidence,
            examples: cluster.examples,
            firstSeenAt: cluster.firstSeenAt,
            lastSeenAt: cluster.lastSeenAt,
            ...(current.status === "pending"
              ? { canonicalQuestion: cluster.canonicalQuestion }
              : {}),
          },
        });
      }),
      { timeout: 30_000 }
    );
  }

  return {
    scannedEvents: events.length,
    messagesWithText: messages.length,
    clusters: clusters.length,
    created,
    refreshed,
    truncated: events.length === limit,
  };
}

export async function getPublishedConversationKnowledge() {
  return prisma.aiConversationKnowledgeCandidate.findMany({
    where: { status: "approved", answer: { not: null } },
    orderBy: [{ occurrenceCount: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      category: true,
      canonicalQuestion: true,
      answer: true,
      occurrenceCount: true,
      updatedAt: true,
    },
  });
}
