// app/domain/bot/wpp.server.ts
type Json = Record<string, any>;

function getBaseUrl() {
  const url = process.env.WPP_BASE_URL;
  if (!url) throw new Error("WPP_BASE_URL não configurado");
  return url.replace(/\/+$/, "");
}

async function wppFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WPP API error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json().catch(() => ({}))) as Json;
}

/**
 * Checa/abre sessão — ajuste os paths conforme seu WppConnect.
 * Padrões comuns expostos pelo WppConnect Server:
 *  - GET  /api/:session/status
 *  - POST /api/:session/start-session
 */
export async function ensureSession(session: string) {
  try {
    return await wppFetch(`/api/${encodeURIComponent(session)}/status`);
  } catch {
    return await wppFetch(`/api/${encodeURIComponent(session)}/start-session`, {
      method: "POST",
      body: JSON.stringify({ session }),
    });
  }
}

/**
 * Envia mensagem de texto simples
 * Padrões comuns:
 *  - POST /api/:session/send-message  { phone, message }
 *  - Em alguns builds, o campo pode se chamar `number` ao invés de `phone`.
 */
export async function sendText(
  session: string,
  phone: string,
  message: string
) {
  // Tente o caminho padrão:
  try {
    return await wppFetch(`/api/${encodeURIComponent(session)}/send-message`, {
      method: "POST",
      body: JSON.stringify({ phone, message }),
    });
  } catch (e) {
    // Fallback para variantes (ex.: { number, text })
    return await wppFetch(`/api/${encodeURIComponent(session)}/send-message`, {
      method: "POST",
      body: JSON.stringify({ number: phone, text: message }),
    });
  }
}

/**
 * (Opcional) Envio de lista/botões — se quiser evoluir para interativo depois
 */
export async function sendButtons(
  session: string,
  phone: string,
  title: string,
  buttons: Array<{ id: string; text: string }>
) {
  return await wppFetch(`/api/${encodeURIComponent(session)}/send-buttons`, {
    method: "POST",
    body: JSON.stringify({ phone, title, buttons }),
  });
}
