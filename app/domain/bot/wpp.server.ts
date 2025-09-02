// /app/domain/bot/wpp.server.ts
import { setTimeout as wait } from "timers/promises";

type ApiResult<T = any> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const BASE_URL = process.env.WPP_BASE_URL ?? "https://bot.amodomio.dev";
const SECRETKEY = process.env.WPP_SECRET ?? "THISISMYSECURETOKEN"; // defina no .env

// cache simples em memória por sessão
const tokenBySession = new Map<string, { token: string; ts: number }>();

async function fetchJSON<T>(
  path: string,
  init: RequestInit & { session?: string; skipAuth?: boolean } = {}
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // injeta Authorization automaticamente se a rota exigir e não for a de gerar token
  if (!init.skipAuth && init.session) {
    const token = await ensureToken(init.session);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers as any) },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // pode haver respostas 204/sem JSON
  }
  const ok = res.ok;
  return ok
    ? { ok, status: res.status, data }
    : {
        ok,
        status: res.status,
        error: (data && (data.message || data.error)) || res.statusText,
      };
}

// Gera o token para a sessão se não existir em cache
async function ensureToken(session: string): Promise<string> {
  const cached = tokenBySession.get(session);
  if (cached?.token) return cached.token;

  // POST /api/{session}/{secretkey}/generate-token
  // (gera token para a sessão informada)
  const r = await fetchJSON<{ token: string }>(
    `/api/${encodeURIComponent(session)}/${encodeURIComponent(
      SECRETKEY
    )}/generate-token`,
    { method: "POST", body: JSON.stringify({}), skipAuth: true } // rota sem bearer
  );
  if (!r.ok || !r.data?.token) {
    throw new Error(r.error || "Falha ao gerar token");
  }
  tokenBySession.set(session, { token: r.data.token, ts: Date.now() });
  return r.data.token;
}

/** Inicia a sessão (gera QR se necessário) */
export async function startSession(session: string): Promise<ApiResult> {
  // rota exige bearerAuth
  return fetchJSON(`/api/${encodeURIComponent(session)}/start-session`, {
    method: "POST",
    body: JSON.stringify({ webhook: "", waitQrCode: false }), // corpo simples aceito
    session,
  });
}

/** Checa o estado da sessão (connected/inChat/disconnected) */
export async function statusSession(session: string): Promise<ApiResult> {
  // GET /api/{session}/check-connection-session (com bearer)
  return fetchJSON(
    `/api/${encodeURIComponent(session)}/check-connection-session`,
    {
      method: "GET",
      session,
    }
  );
}

/** Obtém o QR (base64) para parear no WhatsApp */
export async function getQrCodeImage(session: string): Promise<ApiResult> {
  // GET /api/{session}/qrcode-session (com bearer)
  return fetchJSON(`/api/${encodeURIComponent(session)}/qrcode-session`, {
    method: "GET",
    session,
  });
}

/** Envia texto para um contato (ou grupo se isGroup=true) */
export async function sendTextMessage(
  session: string,
  phone: string,
  message: string,
  opts?: { isGroup?: boolean; isNewsletter?: boolean; isLid?: boolean }
): Promise<ApiResult> {
  // POST /api/{session}/send-message (com bearer)
  const payload = {
    phone,
    isGroup: Boolean(opts?.isGroup),
    isNewsletter: Boolean(opts?.isNewsletter),
    isLid: Boolean(opts?.isLid),
    message,
  };
  return fetchJSON(`/api/${encodeURIComponent(session)}/send-message`, {
    method: "POST",
    body: JSON.stringify(payload),
    session,
  });
}

/** Opcional: uma ajudinha para aguardar até conectar (útil em UX/polling) */
export async function waitUntilConnected(
  session: string,
  timeoutMs = 60_000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await statusSession(session);
    const st = String(
      (r.data as any)?.status ?? (r.data as any)?.state ?? ""
    ).toLowerCase();
    const connected =
      Boolean((r.data as any)?.connected) ||
      st.includes("connected") ||
      st.includes("inchat");
    if (connected) return true;
    await wait(1500);
  }
  return false;
}
