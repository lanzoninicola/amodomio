import { env } from "@config/env";

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

export async function zapiRequest<T = any>(
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

export const zapiInstancePath = `/instances/${encodeURIComponent(
  env.zapiInstanceId
)}/token/${encodeURIComponent(env.zapiInstanceToken)}`;
