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
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || "Falha na comunicação com o servidor.",
      response.status
    );
  }
  return data as T;
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
  status: KdsStatus
) {
  const result = await request<{ order: KdsOrder }>(
    baseUrl,
    "/api/kds/orders",
    { method: "PATCH", body: JSON.stringify({ id, status }) },
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
