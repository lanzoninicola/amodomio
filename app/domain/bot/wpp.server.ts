import { setSessionQRCode, setSessionStatus } from "./session.server";

function getBaseUrl() {
  const env = process.env.NODE_ENV ?? "development";
  const dev = process.env.WPP_BASE_URL_DEV;
  const prod = process.env.WPP_BASE_URL;
  const url = env === "production" ? prod : dev || prod;
  if (!url) throw new Error("WPP_BASE_URL não configurado");
  return url.replace(/\/+$/, "");
}

async function api<T>(path: string, init?: RequestInit) {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WPP API ${path} -> ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * NOTA IMPORTANTE:
 * Mapeei endpoints genéricos conforme prática comum do WPPConnect Server.
 * Se sua instância usa caminhos diferentes, ajuste aqui em um único lugar.
 */
export async function startSession(sessionKey: string) {
  // POST /api/sessions/start { session: sessionKey }
  const json = await api<{ session: string; status: string }>(
    "/api/sessions/start",
    {
      method: "POST",
      body: JSON.stringify({ session: sessionKey }),
    }
  );
  await setSessionStatus(sessionKey, "pending", false);
  return json;
}

export async function getSessionStatus(sessionKey: string) {
  // GET /api/sessions/:session/status
  return api<{ session: string; status: string; isLoggedIn: boolean }>(
    `/api/sessions/${encodeURIComponent(sessionKey)}/status`
  );
}

export async function getSessionQRCode(sessionKey: string) {
  // GET /api/sessions/:session/qrcode
  const json = await api<{ qrcode?: string }>(
    `/api/sessions/${encodeURIComponent(sessionKey)}/qrcode`
  );
  // Assumimos que a API retorna um dataURL (ex.: "data:image/png;base64,...")
  await setSessionQRCode(sessionKey, json?.qrcode);
  if (json?.qrcode) await setSessionStatus(sessionKey, "qrcode", false);
  return json;
}

export async function logoutSession(sessionKey: string) {
  // POST /api/sessions/:session/logout
  const json = await api<{ success: boolean }>(
    `/api/sessions/${encodeURIComponent(sessionKey)}/logout`,
    { method: "POST" }
  );
  await setSessionStatus(sessionKey, "logout", false);
  return json;
}

export async function sendTextMessage(
  sessionKey: string,
  to: string,
  text: string
) {
  // POST /api/messages/send { session, phone, text }
  const json = await api<{ success: boolean; id?: string }>(
    `/api/messages/send`,
    {
      method: "POST",
      body: JSON.stringify({ session: sessionKey, phone: to, text }),
    }
  );
  return json;
}
