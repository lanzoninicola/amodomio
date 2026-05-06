export type NormalizedWebhookEvent = {
  event: "received" | "disconnected" | "traffic";
  phone?: string;
  fromMe?: boolean;
  messageText?: string;
  messageType?: string;
  instanceId?: string;
  contactName?: string;
  contactPhoto?: string;
  raw: any;
};

export type WebhookParseResult = {
  correlationId: string;
  normalized: NormalizedWebhookEvent;
};
