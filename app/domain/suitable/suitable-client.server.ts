const BASE = () => process.env.SUITABLE_API_URL || "https://api.suit.com.br";

export type SuitableRequestOptions = { signal?: AbortSignal };

const cache = new Map<string, { token: string; exp: number }>();

export async function getSuitableToken(scope = "order", options: SuitableRequestOptions = {}): Promise<string> {
  const hit = cache.get(scope);
  if (hit && hit.exp - 60_000 > Date.now()) return hit.token;
  const id = process.env.SUITABLE_CLIENT_ID;
  const secret = process.env.SUITABLE_CLIENT_SECRET;
  if (!id || !secret) throw new SuitableApiError(0, "missing_configuration",
    `[Suitable missing_configuration] Emissão de token; escopo=${scope}; variáveis ausentes: ${[!id && "SUITABLE_CLIENT_ID", !secret && "SUITABLE_CLIENT_SECRET"].filter(Boolean).join(", ")}. Configure no ambiente do servidor e reinicie o processo.`);
  const data = await requestJson<{ access_token: string; expires_in: number }>(scope, "POST", "/api/auth/token/", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope }).toString(),
    signal: options.signal,
  });
  if (!data || typeof data.access_token !== "string" || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    throw new SuitableApiError(200, "invalid_token_response", "[Suitable invalid_token_response] POST /api/auth/token/: esperado access_token não vazio e expires_in numérico positivo. Confira o contrato da API; nenhum token foi armazenado.");
  }
  cache.set(scope, { token: data.access_token, exp: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

export type SuitableOrderDetails = {
  id: number;
  display_number?: string | null;
  status: string;
  order_type?: string | null;
  source?: string | null;
  paid: boolean;
  comments?: string | null;
  delivery_fee: string;
  discount: string;
  total: string;
  customer?: { name?: string | null; phone?: string | null } | null;
  delivery_address?: { formatted: string } | null;
  items: Array<{
    name: string;
    category?: string | null;
    quantity: number;
    comments?: string | null;
    options: Array<{ group_name?: string | null; name: string; quantity: number }>;
  }>;
  payment: {
    paid: boolean;
    change_for?: string | null;
    methods: Array<{ type?: string | null; name?: string | null; value: string }>;
  };
};

export async function fetchSuitableOrder(
  orderId: number,
  options: SuitableRequestOptions = {}
): Promise<SuitableOrderDetails> {
  return call<SuitableOrderDetails>("order", "GET", `/api/order/details/?order_id=${orderId}`, undefined, options);
}

export type SuitableHealth = {
  env: Record<"SUITABLE_API_URL" | "SUITABLE_CLIENT_ID" | "SUITABLE_CLIENT_SECRET" | "SUITABLE_WEBHOOK_SECRET", boolean>;
  api: { ok: boolean; ms: number; error?: string };
  auth: { ok: boolean; ms: number; error?: string };
};

const timed = async (fn: () => Promise<void>) => {
  const t = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: e instanceof Error ? e.message : String(e) };
  }
};

/** Verifica variáveis, `GET /health` (público) e emissão de token. Nunca expõe valores. */
export async function checkSuitableHealth(): Promise<SuitableHealth> {
  const env = {
    SUITABLE_API_URL: Boolean(process.env.SUITABLE_API_URL),
    SUITABLE_CLIENT_ID: Boolean(process.env.SUITABLE_CLIENT_ID),
    SUITABLE_CLIENT_SECRET: Boolean(process.env.SUITABLE_CLIENT_SECRET),
    SUITABLE_WEBHOOK_SECRET: Boolean(process.env.SUITABLE_WEBHOOK_SECRET),
  };
  const api = await timed(async () => {
    const body = await requestJson<{ status?: string }>("public", "GET", "/health", {});
    if (body?.status !== "ok") throw new SuitableApiError(200, "unhealthy", "[Suitable unhealthy] GET /health; resposta sem status=ok. Confira a disponibilidade do provedor.");
  });
  cache.clear(); // força emissão real de token
  const auth = await timed(async () => {
    await getSuitableToken();
  });
  return { env, api, auth };
}

export class SuitableApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "SuitableApiError";
  }
}

export function suitableDiagnosticExcerpt(value: string, maxLength = 500): string {
  let safe = value;
  const id = process.env.SUITABLE_CLIENT_ID;
  const secret = process.env.SUITABLE_CLIENT_SECRET;
  const secrets = [id, secret, process.env.SUITABLE_WEBHOOK_SECRET,
    id && secret ? Buffer.from(`${id}:${secret}`).toString("base64") : undefined,
    ...Array.from(cache.values(), (entry) => entry.token)];
  for (const item of secrets) if (item) safe = safe.split(item).join("[REDACTED]");
  return safe
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi, "$1 [REDACTED]")
    .replace(/("?(?:access_token|refresh_token|client_secret|secret|password|authorization)"?\s*[:=]\s*)("[^"\n]*"|[^\s,}]+)/gi, '$1"[REDACTED]"')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\b\d[\d ()+.-]{8,}\d\b/g, "[PHONE/ID]")
    .replace(/\s+/g, " ").slice(0, maxLength);
}

function diagnostic(method: string, path: string, scope: string, status: number, code: string) {
  const hint = code === "timeout"
    ? "Prazo da chamada esgotado; confira latência e disponibilidade da API. Recupere pedidos pendentes por Tentar de novo ou reconciliação."
    : status === 401
    ? "Confira SUITABLE_CLIENT_ID e SUITABLE_CLIENT_SECRET e a validade do token."
    : status === 403
      ? `Confira se a chave Suitable permite o escopo ${scope}.`
      : status === 429
        ? "Limite da API atingido; aguarde antes de tentar novamente."
        : status >= 500
          ? "Falha no provedor Suitable; confira a disponibilidade antes de repetir a operação."
          : status === 0
            ? "Confira SUITABLE_API_URL, DNS, TLS e conectividade; a entrega pode ter ocorrido antes da falha."
            : "Confira o endpoint e o contrato dos campos enviados em app/domain/suitable/suitable-client.server.ts.";
  return `[Suitable ${code}] etapa=${path === "/api/auth/token/" ? "auth" : "api_request"}; ${method} ${path.split("?")[0]}; escopo=${scope}; HTTP=${status || "sem resposta"}. ${hint}`;
}

/** Inclui apenas trechos truncados e saneados das respostas com erro. */
async function requestJson<T>(scope: string, method: string, path: string, init: RequestInit): Promise<T> {
  let res: Response;
  const signal = init.signal ?? AbortSignal.timeout(15_000);
  try {
    res = await fetch(`${BASE()}${path}`, {
      ...init, method, redirect: "error", signal,
    });
  } catch (error) {
    const code = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
      ? "timeout" : "network_error";
    throw new SuitableApiError(0, code, diagnostic(method, path, scope, 0, code));
  }
  if (res.status === 401) cache.delete(scope);
  if (!res.ok) {
    let raw: string;
    try { raw = await res.text(); } catch {
      const code = signal.aborted ? "timeout" : "response_read_error";
      throw new SuitableApiError(res.status, code, diagnostic(method, path, scope, res.status, code));
    }
    let data: { code?: unknown } | null = null;
    try { data = JSON.parse(raw); } catch { /* proxy responses can be HTML */ }
    const code = typeof data?.code === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(data.code)
      ? suitableDiagnosticExcerpt(data.code) : "http_error";
    throw new SuitableApiError(res.status, code,
      `${diagnostic(method, path, scope, res.status, code)} corpo=${suitableDiagnosticExcerpt(raw) || "(vazio)"}`);
  }
  if (res.status === 204) return undefined as T;
  let raw: string;
  try { raw = await res.text(); } catch {
    const code = signal.aborted ? "timeout" : "response_read_error";
    throw new SuitableApiError(res.status, code, diagnostic(method, path, scope, res.status, code));
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SuitableApiError(res.status, "invalid_json", `${diagnostic(method, path, scope, res.status, "invalid_json")} A resposta não contém JSON válido; corpo=${suitableDiagnosticExcerpt(raw) || "(vazio)"}`);
  }
}

async function call<T>(scope: string, method: string, path: string, body?: unknown, options: SuitableRequestOptions = {}): Promise<T> {
  return requestJson<T>(scope, method, path, {
    headers: {
      Authorization: `Bearer ${await getSuitableToken(scope, options)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });
}

export type SuitableWebhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

const W = "webhook:manage";
export const SUITABLE_EVENTS = ["new_order", "paid_order", "changed_order_status"];

export const listSuitableWebhooks = () =>
  call<SuitableWebhook[]>(W, "GET", "/api/webhooks/");
export const createSuitableWebhook = (name: string, url: string) =>
  call<SuitableWebhook & { secret: string }>(W, "POST", "/api/webhooks/", {
    name,
    url,
    events: SUITABLE_EVENTS,
  });
export const setSuitableWebhookActive = (id: string, active: boolean) =>
  call<SuitableWebhook>(W, "PATCH", `/api/webhooks/${encodeURIComponent(id)}/`, { active });
export const testSuitableWebhook = (id: string) =>
  call<{ event_id: string }>(W, "POST", `/api/webhooks/${encodeURIComponent(id)}/test/`);
export const rotateSuitableWebhookSecret = (id: string) =>
  call<{ id: string; secret: string }>(
    W,
    "POST",
    `/api/webhooks/${encodeURIComponent(id)}/rotate-secret/`
  );

export type SuitableOrderListItem = { id: number; status: string; created_at: string | null };
export const listSuitableOrders = (params: {
  createdFrom: string;
  page: number;
  pageSize?: number;
}) => {
  const q = new URLSearchParams({
    created_from: params.createdFrom,
    page: String(params.page),
    page_size: String(params.pageSize ?? 100),
  });
  return call<{ count: number; page: number; page_size: number; results: SuitableOrderListItem[] }>(
    "order",
    "GET",
    `/api/order/list?${q}`
  );
};
