// app/domain/bot/wpp.server.ts
/**
 * Cliente mínimo para WppConnect Server
 * - Usa WPP_BASE_URL (prod) ou WPP_BASE_URL_DEV (dev)
 * - Suporta header Authorization (WPP_API_TOKEN) se existir
 */
const BASE =
  process.env.WPP_BASE_URL?.replace(/\/+$/, "") ||
  process.env.WPP_BASE_URL_DEV?.replace(/\/+$/, "") ||
  "";

const TOKEN = process.env.WPP_API_TOKEN || "";

function authHeaders() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

/**
 * Alguns builds do wppconnect-server expõem endpoints diferentes.
 * Tentamos uma sequência de rotas comuns.
 */
async function tryPost(urls: string[], body: any) {
  let lastErr: any;
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) return await res.json().catch(() => ({}));
      lastErr = await res.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`WPP API error: ${String(lastErr)}`);
}

export async function sendMessage(
  session: string,
  to: string,
  message: string
) {
  if (!BASE) throw new Error("WPP_BASE_URL/WPP_BASE_URL_DEV não configurado");

  // normaliza número para formato WhatsApp se necessário
  const toId = /@/.test(to) ? to : `${to}@c.us`;

  const body = { phone: toId, message };

  // rotas comuns (ajuste conforme seu swagger.json)
  const urls = [
    `${BASE}/message/sendText/${session}`, // ex: wppconnect-team/wppconnect-server
    `${BASE}/api/${session}/send-text`, // variações
    `${BASE}/api/${session}/sendMessage`, // variações
  ];

  return tryPost(urls, body);
}
