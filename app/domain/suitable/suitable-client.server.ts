const BASE = () => process.env.SUITABLE_API_URL || "https://api.suit.com.br";

const cache = new Map<string, { token: string; exp: number }>();

export async function getSuitableToken(scope = "order"): Promise<string> {
  const hit = cache.get(scope);
  if (hit && hit.exp - 60_000 > Date.now()) return hit.token;
  const id = process.env.SUITABLE_CLIENT_ID;
  const secret = process.env.SUITABLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SUITABLE_CLIENT_ID/SECRET ausentes");
  const res = await fetch(`${BASE()}/api/auth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope }).toString(),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Suitable auth falhou (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
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
  orderId: number
): Promise<SuitableOrderDetails> {
  const res = await fetch(`${BASE()}/api/order/details/?order_id=${orderId}`, {
    headers: { Authorization: `Bearer ${await getSuitableToken()}` },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401) cache.delete("order");
  if (!res.ok) throw new Error(`Suitable order ${orderId} falhou (${res.status})`);
  return (await res.json()) as SuitableOrderDetails;
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
    const res = await fetch(`${BASE()}/health`, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (!res.ok || body?.status !== "ok") throw new Error(`/health ${res.status}`);
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
  }
}

async function call<T>(
  scope: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getSuitableToken(scope)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) cache.delete(scope);
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const detail = Array.isArray(data?.detail)
      ? JSON.stringify(data.detail)
      : data?.detail;
    throw new SuitableApiError(
      res.status,
      data?.code ?? "error",
      `${data?.code ?? res.status}: ${detail ?? "falha"}`
    );
  }
  return data as T;
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
