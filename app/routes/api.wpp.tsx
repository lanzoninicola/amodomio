// app/routes/api.wpp.tsx
import { json } from "@remix-run/node";


const BASE =
  process.env.WPP_BASE_URL ||
  process.env.WPP_BASE_URL_DEV ||
  "https://bot.amodomio.dev";
const SECRET = process.env.WPP_SECRET || "THISISMYSECURETOKEN";

type Resp = { ok: boolean; status?: number; error?: string;[k: string]: any };

function J(data: any, status = 200) {
  return json(data, { status });
}

// --- Utils --- //
function preferKeysFirst(obj: any, prefer: string[]) {
  const keys = Object.keys(obj || {});
  return [...prefer.filter((k) => k in (obj || {})), ...keys.filter((k) => !prefer.includes(k))];
}

// Busca profunda pela primeira string plausível de QR
function pickQrDeep(d: any): string | null {
  const PREFERRED = ["base64", "qr", "qrcode", "qrCode", "code", "image", "result"];
  const q: Array<any> = [d];
  while (q.length) {
    const v = q.shift();
    if (!v) continue;
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "object") {
      for (const k of preferKeysFirst(v, PREFERRED)) q.push((v as any)[k]);
    }
  }
  return null;
}

function toDataUrl(val: string): string {
  let s = val.trim();
  if (!s.startsWith("data:image")) {
    s = `data:image/png;base64,${s.replace(/\s+/g, "")}`;
  }
  return s;
}

// --- WPP helpers --- //
async function genToken(session: string): Promise<Resp> {
  const res = await fetch(
    `${BASE}/api/${encodeURIComponent(session)}/${encodeURIComponent(SECRET)}/generate-token`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
  );
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok || !jsonBody?.token) {
    return { ok: false, status: res.status, error: jsonBody?.message || jsonBody?.error || "NO_TOKEN" };
  }
  return { ok: true, status: res.status, token: jsonBody.token };
}

async function startSession(session: string, token: string): Promise<Resp> {
  const res = await fetch(`${BASE}/api/${encodeURIComponent(session)}/start-session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ waitQrCode: true }),
  });
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: jsonBody?.message || jsonBody?.error || "START_FAILED" };

  // Alguns servidores já devolvem QR no start
  const raw = pickQrDeep(jsonBody);
  const qrcode = raw ? toDataUrl(raw) : undefined;
  return { ok: true, status: res.status, data: { ...jsonBody, ...(qrcode ? { qrcode } : {}) } };
}

async function getQr(session: string, token: string): Promise<Resp> {
  const res = await fetch(`${BASE}/api/${encodeURIComponent(session)}/qrcode-session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: jsonBody?.message || jsonBody?.error || "QR_FAILED" };

  const raw = pickQrDeep(jsonBody);
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return { ok: false, status: res.status, error: "NO_QR", rawKeys: Object.keys(jsonBody || {}) };
  }

  // 🔑 padronização: sempre retornar em data.qrcode
  return { ok: true, status: res.status, data: { qrcode: toDataUrl(raw) } };
}

async function getStatus(session: string, token: string): Promise<Resp> {
  const res = await fetch(`${BASE}/api/${encodeURIComponent(session)}/check-connection-session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: jsonBody?.message || jsonBody?.error || "STATUS_FAILED" };
  return { ok: true, status: res.status, data: jsonBody };
}

async function logoutSession(session: string, token: string): Promise<Resp> {
  const res = await fetch(`${BASE}/api/${encodeURIComponent(session)}/logout-session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, error: jsonBody?.message || jsonBody?.error || "LOGOUT_FAILED" };
  }
  return { ok: true, status: res.status, data: jsonBody };
}

async function sendText(session: string, token: string, phone: string, message: string): Promise<Resp> {
  const res = await fetch(`${BASE}/api/${encodeURIComponent(session)}/send-message`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message, isGroup: false, isNewsletter: false, isLid: false }),
  });
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: jsonBody?.message || jsonBody?.error || "SEND_FAILED" };
  return { ok: true, status: res.status, data: jsonBody };
}

// --- Remix --- //
export async function loader() {
  return J({ ok: true, route: "/api/wpp" });
}

export async function action({ request }: { request: Request }) {
  if (!BASE || !SECRET) return J({ ok: false, error: "MISSING_ENV" }, 500);

  const form = await request.formData();
  const op = String(form.get("op") || "").toLowerCase();
  const session = String(form.get("session") || "default");
  const tokenFromClient = String(form.get("token") || "");

  const needToken = async () => (tokenFromClient || (await genToken(session)).token || "");

  try {
    if (op === "token") {
      const r = await genToken(session);
      return J(r, r.ok ? 200 : r.status || 500);
    }

    if (op === "start") {
      const token = await needToken();
      if (!token) return J({ ok: false, error: "NO_TOKEN" }, 401);
      const r = await startSession(session, token);
      return J({ ...r, token }, r.ok ? 200 : r.status || 500);
    }

    if (op === "qr" || op === "qrcode-session") {
      // aceita tanto "qr" quanto "qrcode-session"
      const token = await needToken();
      if (!token) return J({ ok: false, error: "NO_TOKEN" }, 401);
      const r = await getQr(session, token);
      return J({ ...r, token }, r.ok ? 200 : r.status || 500);
    }

    if (op === "status") {
      const token = await needToken();
      if (!token) return J({ ok: false, error: "NO_TOKEN" }, 401);
      const r = await getStatus(session, token);
      return J({ ...r, token }, r.ok ? 200 : r.status || 500);
    }

    if (op === "logout-session") {
      const token = await needToken();
      if (!token) return J({ ok: false, error: "NO_TOKEN" }, 401);
      const r = await logoutSession(session, token);
      return J({ ...r, token }, r.ok ? 200 : r.status || 500);
    }

    if (op === "send") {
      const token = await needToken();
      if (!token) return J({ ok: false, error: "NO_TOKEN" }, 401);
      const phone = String(form.get("phone") || "");
      const message = String(form.get("message") || "");
      const r = await sendText(session, token, phone, message);
      return J({ ...r, token }, r.ok ? 200 : r.status || 500);
    }

    return J({ ok: false, error: "INVALID_OP" }, 400);
  } catch (e: any) {
    return J({ ok: false, error: e?.message || "unexpected" }, 500);
  }
}
