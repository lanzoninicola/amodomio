export type MessageStatus =
  | "unknown"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  unknown: "Envio sem confirmação",
  accepted: "Aguardando confirmação de envio",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falha no envio",
};

export function mergeMessageStatus(
  current: MessageStatus,
  incoming: MessageStatus
): MessageStatus {
  // Receipt/read evidence wins over failures; a failure wins over a send-only ACK.
  const rank: Record<MessageStatus, number> = {
    unknown: 0,
    accepted: 1,
    sent: 2,
    failed: 3,
    delivered: 4,
    read: 5,
  };
  return rank[incoming] > rank[current] ? incoming : current;
}

export function isConfirmedSent(status: MessageStatus) {
  return ["sent", "delivered", "read"].includes(status);
}

export function providerMessageIds(payload: Record<string, unknown>): string[] {
  return [
    ...new Set(
      [
        payload.messageId,
        payload.zaapId,
        payload.id,
        ...(Array.isArray(payload.ids) ? payload.ids : []),
      ].filter(
        (id): id is string => typeof id === "string" && Boolean(id.trim())
      )
    ),
  ];
}

export function parseMessageCallback(
  payload: Record<string, unknown>,
  kind: "delivery" | "message-status"
) {
  const ids = providerMessageIds(payload);
  if (!ids.length || ids.length > 100) return null;
  if (kind === "delivery") {
    if (payload.type !== "DeliveryCallback") return null;
    return {
      ids,
      status: (payload.error ? "failed" : "sent") as MessageStatus,
      error: typeof payload.error === "string" ? payload.error : null,
    };
  }
  if (payload.type !== "MessageStatusCallback") return null;
  const statuses = new Map<string, MessageStatus>([
    ["SENT", "sent"],
    ["RECEIVED", "delivered"],
    ["READ", "read"],
    ["PLAYED", "read"],
  ]);
  const status = statuses.get(String(payload.status));
  // READ_BY_ME is an inbound read acknowledgment, not proof that the customer read our message.
  return status ? { ids, status, error: null } : null;
}
