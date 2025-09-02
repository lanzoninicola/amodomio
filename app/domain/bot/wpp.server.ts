// app/domain/bot/wpp.server.ts
type ApiResult<T = any> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const IS_PROD = process.env.NODE_ENV === "production";
const BASE_URL =
  (IS_PROD ? process.env.WPP_BASE_URL : process.env.WPP_BASE_URL_DEV) ??
  "https://bot.amodomio.dev";
const SECRETKEY = process.env.WPP_SECRET ?? "THISISMYSECURETOKEN"; // a mesma secret configurada no seu wppconnect-server

if (!BASE_URL) throw new Error("WPP_BASE_URL(_DEV) não configurado");
if (!SECRETKEY)
  console.warn("[WPP] WPP_SECRET não configurado — generate-token vai falhar.");

const tokenCache = new Map<string, string>();

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ res: Response; json: any }> {
  const res = await fetch(url, init);
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { res, json };
}

async function ensureToken(session: string): Promise<string> {
  const cached = tokenCache.get(session);
  if (cached) return cached;

  const { res, json } = await fetchJson<{ token: string }>(
    `${BASE_URL}/api/${encodeURIComponent(session)}/${encodeURIComponent(
      SECRETKEY
    )}/generate-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );

  if (!res.ok || !json?.token) {
    throw new Error(
      json?.message || json?.error || `generate-token falhou (${res.status})`
    );
  }
  tokenCache.set(session, json.token);
  return json.token;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function startSession(session: string): Promise<ApiResult> {
  const token = await ensureToken(session);
  const { res, json } = await fetchJson(
    `${BASE_URL}/api/${encodeURIComponent(session)}/start-session`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ webhook: "", waitQrCode: true }), // força geração imediata do QR
    }
  );
  return res.ok
    ? { ok: true, status: res.status, data: json }
    : { ok: false, status: res.status, error: json?.message || json?.error };
}

export async function statusSession(session: string): Promise<ApiResult> {
  const token = await ensureToken(session);
  const { res, json } = await fetchJson(
    `${BASE_URL}/api/${encodeURIComponent(session)}/check-connection-session`,
    { method: "GET", headers: authHeaders(token) }
  );
  return res.ok
    ? { ok: true, status: res.status, data: json }
    : { ok: false, status: res.status, error: json?.message || json?.error };
}

// em getQrCodeImage(session):

// ------ utilidades novas ------

/** String parece ser imagem (data URL ou base64 “pura” com tamanho razoável) */
function looksLikeImg(s: string) {
  if (!s) return false;
  const t = s.trim();
  if (t.startsWith("data:image/")) return true;
  return /^[A-Za-z0-9+/=]+$/.test(t) && t.length > 100;
}

/** BFS: encontra a 1ª string de QR em qualquer profundidade; devolve valor e path */
function deepFindQrString(root: any): { value: string; path: string[] } | null {
  if (typeof root === "string" && looksLikeImg(root))
    return { value: root, path: [] };
  const queue: Array<{ v: any; p: string[] }> = [{ v: root, p: [] }];
  const PREFERRED = [
    "base64",
    "qr",
    "qrcode",
    "qrCode",
    "code",
    "image",
    "result",
  ];

  while (queue.length) {
    const { v, p } = queue.shift()!;
    if (typeof v === "string" && looksLikeImg(v)) return { value: v, path: p };
    if (!v || typeof v !== "object") continue;

    const keys = Object.keys(v);
    const ordered = [
      ...PREFERRED.filter((k) => k in v),
      ...keys.filter((k) => !PREFERRED.includes(k)),
    ];
    for (const k of ordered) queue.push({ v: (v as any)[k], p: [...p, k] });
  }
  return null;
}

/** Remove prefixo data: e espaços/quebras, retorna só base64 */
function toBareBase64(s: string) {
  let t = s.trim();
  if (t.startsWith("data:image")) {
    const i = t.indexOf(",");
    if (i >= 0) t = t.slice(i + 1);
  }
  return t.replace(/\s+/g, "");
}

export async function getQrCodeImage(
  session: string
): Promise<ApiResult<{ base64?: string; path?: string[]; raw?: any }>> {
  const token = await ensureToken(session);
  const { res, json } = await fetchJson(
    `${BASE_URL}/api/${encodeURIComponent(session)}/qrcode-session`,
    { method: "GET", headers: authHeaders(token) }
  );

  // Se o servidor já respondeu erro HTTP, propague como erro
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: (json && (json.message || json.error)) || "QR_ENDPOINT_FAILED",
      data: { raw: json },
    };
  }

  // Procura profundamente a string do QR (algumas builds mandam objeto dentro de "base64")
  const found = deepFindQrString(json);

  // NADA encontrado: sinalize erro claro (agora r.ok será false e sua rota /api/wpp/qr devolve "no qr")
  if (!found) {
    return {
      ok: false,
      status: res.status,
      error: "NO_QR_AVAILABLE",
      data: { raw: json }, // útil p/ debug /api/wpp/qr?debug=1
    };
  }

  // Normaliza para base64 “puro” e devolve também o caminho onde estava
  const bare = toBareBase64(found.value);
  return {
    ok: true,
    status: res.status,
    data: {
      base64: bare.startsWith("data:image") ? bare : bare, // já é “puro”
      path: found.path,
    },
  };
}

export async function sendTextMessage(
  session: string,
  phone: string,
  message: string
): Promise<ApiResult> {
  const token = await ensureToken(session);
  const payload = {
    phone,
    message,
    isGroup: false,
    isNewsletter: false,
    isLid: false,
  };
  const { res, json } = await fetchJson(
    `${BASE_URL}/api/${encodeURIComponent(session)}/send-message`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );
  return res.ok
    ? { ok: true, status: res.status, data: json }
    : { ok: false, status: res.status, error: json?.message || json?.error };
}
