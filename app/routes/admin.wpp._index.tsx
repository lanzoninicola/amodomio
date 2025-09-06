// app/routes/admin.wpp._index.tsx
import { LoaderFunctionArgs } from "@remix-run/node";
import { useState } from "react";
import { ok } from "~/utils/http-response.server";

type ApiResp = {
  ok: boolean;
  status?: number;
  error?: string;
  token?: string;
  data?: any; // esperamos data.qrcode quando vier QR
};

export async function loader({ request }: LoaderFunctionArgs) {

  return ok()
}

export default function AdminWpp() {
  const [session, setSession] = useState("amodomio");
  const [token, setToken] = useState("");
  const [qr, setQr] = useState("");
  const [last, setLast] = useState<ApiResp | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Ciao! Messaggio di test dal A Modo Mio 🍕");
  const [busy, setBusy] = useState(false);

  async function call(
    op: "environment" | "token" | "start" | "qr" | "qrcode-session" | "status" | "logout-session" | "send",
    extra?: Record<string, string>
  ) {
    const fd = new FormData();
    fd.set("op", op);
    fd.set("session", session);
    if (token) fd.set("token", token);
    if (extra) Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    const res = await fetch("/api/wpp", { method: "POST", body: fd });
    const json = (await res.json()) as ApiResp;

    setLast(json);
    if (json.token) setToken(json.token);

    // prioriza data.qrcode
    const qrcode: string | undefined = json.data?.qrcode;
    if (qrcode) setQr(qrcode);

    return json;
  }

  async function onEnvironment() { setBusy(true); try { await call("environment"); } finally { setBusy(false); } }
  async function onToken() { setBusy(true); try { await call("token"); } finally { setBusy(false); } }
  async function onStart() { setBusy(true); try { await call("start"); } finally { setBusy(false); } }
  async function onQr() { setBusy(true); try { await call("qr"); } finally { setBusy(false); } }
  async function onQrSess() { setBusy(true); try { await call("qrcode-session"); } finally { setBusy(false); } }
  async function onStatus() { setBusy(true); try { await call("status"); } finally { setBusy(false); } }
  async function onLogout() {
    setBusy(true);
    try {
      const r = await call("logout-session");
      // limpamos visualmente o QR
      if (r.ok) setQr("");
    } finally { setBusy(false); }
  }
  async function onFlow() {
    setBusy(true);
    try {
      const t = await call("token");
      if (!t.ok || !t.token) return;
      const s = await call("start");
      if (!s.ok) return;
      await call("qrcode-session");
    } finally { setBusy(false); }
  }
  async function onSend() {
    setBusy(true);
    try {
      await call("send", { phone: phone.trim(), message });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>WPP — Painel simples</h2>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label>session:</label>
        <input
          value={session}
          onChange={(e) => setSession(e.target.value)}
          placeholder="nome da sessão"
          style={{ padding: 6, minWidth: 220 }}
        />
        <button onClick={onFlow} disabled={busy} style={{ padding: "8px 12px", fontWeight: 600 }}>Fluxo Completo</button>

        <button onClick={onEnvironment} disabled={busy} style={{ padding: "8px 12px" }}>Ambiente</button>
        <button onClick={onToken} disabled={busy} style={{ padding: "8px 12px" }}>Gerar token</button>
        <button onClick={onStart} disabled={busy} style={{ padding: "8px 12px" }}>Start (waitQrCode)</button>
        <button onClick={onQr} disabled={busy} style={{ padding: "8px 12px" }}>Buscar QR</button>
        <button onClick={onQrSess} disabled={busy} style={{ padding: "8px 12px" }}>QRCode-session</button>
        <button onClick={onStatus} disabled={busy} style={{ padding: "8px 12px" }}>Status</button>
        <button onClick={onLogout} disabled={busy} style={{ padding: "8px 12px", color: "#b91c1c", border: "1px solid #ef4444", background: "#fff" }}>
          Logout-session
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div><b>Token:</b> <code style={{ fontSize: 12 }}>{token || "—"}</code></div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ marginBottom: 6, fontSize: 14, opacity: 0.7 }}>QR Code</div>
          <div style={{
            width: 320, height: 320, border: "1px solid #e5e7eb",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff"
          }}>
            {qr ? (
              <img
                src={qr}
                alt="QR"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={() => setQr("")}
              />
            ) : (
              <span style={{ fontSize: 12, opacity: 0.6 }}>QR não carregado</span>
            )}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 6, fontSize: 14, opacity: 0.7 }}>Última resposta</div>
          <pre style={{
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontSize: 12, padding: 12, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, minHeight: 320
          }}>
            {JSON.stringify(last, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ marginBottom: 6, fontSize: 14, opacity: 0.7 }}>Enviar mensagem</div>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5546999999999"
              style={{ padding: 6 }}
            />
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ padding: 6 }}
            />
            <button onClick={onSend} disabled={busy || !token} style={{ padding: "8px 12px" }}>
              Enviar
            </button>
            {!token && <small style={{ color: "#b45309" }}>Gere o token e inicie a sessão antes de enviar.</small>}
          </div>
        </div>
      </div>
    </div>
  );
}
