// app/domain/bot/auto-responder.types.ts
export type Inbound = {
  from: string;
  to?: string;
  body: string;
  timestamp?: number | string;
  raw?: any;
};
