import { desktop } from "../platform/desktop";
import {
  parseServerPresets,
  PUBLIC_SERVER_URL,
} from "../config/server-presets";
import type { KdsOrder, KdsStatus, KdsUser } from "../kds/types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> {
  let response: Response;
  try {
    if (desktop) {
      const result = await desktop.request({
        baseUrl: normalizeBaseUrl(baseUrl),
        path,
        method: init.method || "GET",
        body: typeof init.body === "string" ? init.body : undefined,
        token,
      });
      response = new Response(result.body, { status: result.status });
    } else
      response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
  } catch {
    throw new Error(
      `Não foi possível conectar a ${normalizeBaseUrl(
        baseUrl
      )}. Confira o endereço do servidor e se este dispositivo tem acesso à rede do servidor.`
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || "Falha na comunicação com o servidor.",
      response.status
    );
  }
  return data as T;
}

export async function getServerPresets(signal?: AbortSignal) {
  const result = await request<{ servers: unknown }>(
    PUBLIC_SERVER_URL,
    "/api/mobile/servers",
    { signal, headers: { "Content-Type": "text/plain" } }
  );
  return parseServerPresets(result.servers);
}

export function login(
  baseUrl: string,
  input: { identifier: string; password: string; deviceLabel: string }
) {
  return request<{ token: string; expiresAt: string; user: KdsUser }>(
    baseUrl,
    "/api/kds/mobile-auth",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function getMe(baseUrl: string, token: string) {
  return request<{ user: KdsUser }>(baseUrl, "/api/kds/mobile-auth", {}, token);
}

export function logout(baseUrl: string, token: string) {
  return request(baseUrl, "/api/kds/mobile-auth", { method: "DELETE" }, token);
}

export async function listOrders(baseUrl: string, token: string, date: string) {
  const result = await request<{ orders: KdsOrder[] }>(
    baseUrl,
    `/api/kds/orders?date=${encodeURIComponent(date)}`,
    {},
    token
  );
  return result.orders;
}

export async function updateStatus(
  baseUrl: string,
  token: string,
  id: string,
  status: KdsStatus,
  fulfillOvenRequest = false
) {
  const result = await request<{ order: KdsOrder }>(
    baseUrl,
    "/api/kds/orders",
    {
      method: "PATCH",
      body: JSON.stringify({ id, status, fulfillOvenRequest }),
    },
    token
  );
  return result.order;
}

export function updateOvenRequest(
  baseUrl: string,
  token: string,
  id: string,
  requestedForOven: boolean
) {
  return request<{ id: string; requestedForOven: boolean }>(
    baseUrl,
    "/api/kds/orders",
    {
      method: "PATCH",
      body: JSON.stringify({
        action: "setRequestedForOven",
        id,
        requestedForOven,
      }),
    },
    token
  );
}
