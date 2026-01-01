export type NormalizedWebhookEvent = {
  event: "received" | "disconnected";
  phone?: string;
  messageText?: string;
  messageType?: string;
  instanceId?: string;
  raw: any;
};

export type WebhookParseResult = {
  correlationId: string;
  normalized: NormalizedWebhookEvent;
};
