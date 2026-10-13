import { desktop } from "../platform/desktop";
import {
  parseServerPresets,
  PUBLIC_SERVER_URL,
} from "../config/server-presets";
import type { KdsOrder, KdsStatus, KdsUser } from "../kds/types";
import type {
  DoughCounts,
  DoughSnapshot,
  DoughStockData,
  DoughStockIntent,
} from "../dough-stock/types";

export function getDoughStock(
  baseUrl: string,
  token: string,
  date: string,
  signal?: AbortSignal
) {
  return request<DoughStockData>(
    baseUrl,
    `/api/kds/dough-stock?date=${encodeURIComponent(date)}`,
    { signal },
    token
  );
}

export function submitDoughStock(
  baseUrl: string,
  token: string,
  date: string,
  intent: DoughStockIntent,
  counts: DoughCounts
) {
  return request<{
    ok: boolean;
    stock?: DoughSnapshot;
    message: string;
    whatsappSent: boolean;
  }>(
    baseUrl,
    "/api/kds/dough-stock",
    { method: "POST", body: JSON.stringify({ date, intent, counts }) },
    token
  );
}

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
  } catch (error) {
    if (
      desktop &&
      error instanceof Error &&
      error.message.includes("Operação não permitida")
    ) {
      throw new Error(
        "Esta versão do aplicativo bloqueia esta operação. Atualize o aplicativo Windows para usar o WhatsApp."
      );
    }
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

export function getRecipes(
  baseUrl: string,
  token: string,
  params = "",
  signal?: AbortSignal
) {
  return request<{
    recipes?: import("../recipes/types").RecipeSummary[];
    recipe?: import("../recipes/types").MobileRecipe;
    templates?: import("../recipes/types").TemplateSummary[];
    template?: import("../recipes/types").SavedTemplate;
  }>(
    baseUrl,
    `/api/mobile/recipes${params ? `?${params}` : ""}`,
    { signal },
    token
  );
}

export function submitRecipe(
  baseUrl: string,
  token: string,
  body: {
    recipeId: string;
    intent: "create-template" | "delete-template" | "save-display-unit";
    name?: string;
    description?: string;
    scaleFactor?: number;
    selectedUnits?: Record<string, string>;
    templateId?: string;
    ingredientId?: string;
    unit?: string;
  }
) {
  return request<{ createdTemplateId?: string }>(
    baseUrl,
    "/api/mobile/recipes",
    { method: "POST", body: JSON.stringify(body) },
    token
  );
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

export function getWhatsappConfig(baseUrl: string, token: string) {
  return request<{ enabled: boolean }>(baseUrl, "/api/kds/whatsapp", {}, token);
}

export function sendOrderWhatsapp(
  baseUrl: string,
  token: string,
  orderId: string,
  message: string
) {
  return request<{ ok: boolean }>(
    baseUrl,
    "/api/kds/whatsapp",
    {
      method: "POST",
      body: JSON.stringify({ orderId, message }),
    },
    token
  );
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
