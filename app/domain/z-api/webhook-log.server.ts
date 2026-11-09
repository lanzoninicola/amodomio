type WebhookEventType = "received" | "disconnected" | "traffic";

type LogEntry = {
  id: string;
  event: WebhookEventType;
  correlationId: string;
  timestamp: number;
  headers: Record<string, string>;
  payloadPreview: string;
};

const MAX_LOGS = 200;
const logStore: LogEntry[] = [];

export function addWebhookLog(entry: Omit<LogEntry, "timestamp">) {
  const log: LogEntry = { ...entry, timestamp: Date.now() };
  logStore.unshift(log);
  if (logStore.length > MAX_LOGS) {
    logStore.length = MAX_LOGS;
  }
}

export function getWebhookLogs(event?: WebhookEventType) {
  if (!event) return [...logStore];
  return logStore.filter((log) => log.event === event);
}

export function clearWebhookLogs() {
  logStore.length = 0;
}
