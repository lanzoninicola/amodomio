import { env } from "@config/env";
import {
  beginTrackedMessage,
  finishTrackedMessage,
} from "./message-tracking.server";
import {
  isConfirmedSent,
  providerMessageIds,
  type MessageStatus,
} from "./message-status";

type HttpMethod = "GET" | "POST";

const DEFAULT_TIMEOUT_MS = 15_000;
const ERROR_BODY_PREVIEW = 400;

export class ZApiError extends Error {
  status: number;
  body: any;
  path: string;

  constructor(message: string, status: number, body: any, path: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

type RequestOptions = {
  timeoutMs?: number;
};

function buildUrl(path: string) {
  return `${env.zapiBaseUrl}${path}`;
}

function buildHeaders() {
  return {
    "Content-Type": "application/json",
    "Client-Token": env.zapiClientToken,
  };
}

function createAbortController(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawZapiRequest<T = any>(
  method: HttpMethod,
  path: string,
  body?: any,
  options?: RequestOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { controller, timer } = createAbortController(timeoutMs);

  try {
    const res = await fetch(buildUrl(path), {
      method,
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const parsed = await parseJsonSafe(res);
    if (!res.ok) {
      const preview =
        typeof parsed === "string"
          ? parsed.slice(0, ERROR_BODY_PREVIEW)
          : JSON.stringify(parsed).slice(0, ERROR_BODY_PREVIEW);
      const message = `Z-API request failed (${res.status}): ${
        preview || "no body"
      }`;
      throw new ZApiError(message, res.status, parsed, path);
    }

    return parsed as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ZApiError(
        `Z-API request timed out after ${timeoutMs}ms`,
        504,
        null,
        path
      );
    }
    if (error instanceof ZApiError) throw error;

    throw new ZApiError(
      error?.message || "Z-API request error",
      500,
      null,
      path
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getZapiConnection(options?: RequestOptions) {
  const result = await rawZapiRequest<{ connected?: boolean }>(
    "GET",
    `${zapiInstancePath}/status`,
    undefined,
    options
  );
  if (!result || typeof result.connected !== "boolean") {
    throw new ZApiError(
      "Não foi possível verificar a conexão do WhatsApp.",
      502,
      { code: "instance_status_unknown" },
      "/status"
    );
  }
  return { connected: result.connected };
}

export async function zapiRequest<T = any>(
  method: HttpMethod,
  path: string,
  body?: any,
  options?: RequestOptions
): Promise<T> {
  if (method !== "POST" || !path.startsWith(`${zapiInstancePath}/send-`)) {
    return rawZapiRequest<T>(method, path, body, options);
  }

  const connection = await getZapiConnection(options);
  if (!connection.connected) {
    throw new ZApiError(
      "Instância WhatsApp desconectada. Reconecte na Z-API antes de enviar.",
      503,
      { code: "instance_disconnected", status: "failed" },
      "/status"
    );
  }
  // Persist before contacting the provider; never send an untrackable message.
  const trackingId = await beginTrackedMessage(
    body?.phone,
    body?.message || body?.caption
  );
  const persist = async (
    status: MessageStatus,
    response?: Record<string, unknown>,
    error?: string | null
  ) => {
    try {
      return await finishTrackedMessage(trackingId, status, response, error);
    } catch {
      throw new ZApiError(
        "O acompanhamento do envio não foi atualizado. Consulte o status e não reenvie automaticamente.",
        503,
        { code: "tracking_update_failed", trackingId, status: "unknown" },
        "/send"
      );
    }
  };
  let response: Record<string, unknown>;
  try {
    response = await rawZapiRequest<Record<string, unknown>>(
      method,
      path,
      body,
      options
    );
  } catch (error) {
    const knownRejection =
      error instanceof ZApiError && error.status >= 400 && error.status < 500;
    const status = knownRejection ? "failed" : "unknown";
    await finishTrackedMessage(
      trackingId,
      status,
      undefined,
      knownRejection
        ? "Envio rejeitado pela Z-API."
        : "Resposta do envio não confirmada."
    ).catch(() => {});
    throw new ZApiError(
      knownRejection
        ? "Envio rejeitado pela Z-API."
        : "Envio sem confirmação. Consulte o status antes de tentar novamente.",
      knownRejection ? 502 : 504,
      {
        code: knownRejection ? "send_rejected" : "send_outcome_unknown",
        trackingId,
        status,
      },
      "/send"
    );
  }
  if (
    !response ||
    typeof response !== "object" ||
    Array.isArray(response) ||
    response.error ||
    (Array.isArray(response.errors)
      ? response.errors.length > 0
      : Boolean(response.errors))
  ) {
    const explicitlyRejected = Boolean(response?.error || response?.errors);
    const status = explicitlyRejected ? "failed" : "unknown";
    await persist(
      status,
      undefined,
      "Resposta de envio inválida ou rejeitada."
    );
    throw new ZApiError(
      "A Z-API não confirmou a aceitação da mensagem.",
      502,
      { code: "send_not_accepted", trackingId, status },
      "/send"
    );
  }
  if (!providerMessageIds(response).length) {
    await persist(
      "unknown",
      response,
      "A Z-API retornou sem identificador da mensagem."
    );
    throw new ZApiError(
      "Envio sem identificador. Consulte o status antes de tentar novamente.",
      502,
      { code: "send_outcome_unknown", trackingId, status: "unknown" },
      "/send"
    );
  }
  const tracked = await persist("accepted", response);
  if (tracked.status === "failed") {
    throw new ZApiError(
      "A Z-API confirmou falha no envio da mensagem.",
      502,
      { code: "send_failed", trackingId, status: "failed" },
      "/send"
    );
  }
  return {
    ...response,
    trackingId,
    status: tracked.status,
    confirmed: isConfirmedSent(tracked.status),
  } as T;
}

export const zapiInstancePath = `/instances/${encodeURIComponent(
  env.zapiInstanceId
)}/token/${encodeURIComponent(env.zapiInstanceToken)}`;
