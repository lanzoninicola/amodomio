// app/domain/bot/auto-responder.types.ts
export type InboundMessage = {
  from: string; // número do cliente (E.164: 55DDDNNNNNNN)
  to?: string; // seu número (opcional)
  body: string; // texto recebido
  timestamp?: number; // unix epoch opcional
};

export type HandleResult = {
  matched: boolean;
  ruleId?: string;
  offHours?: boolean;
};
