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
  return ok();
}

export default function AdminWpp() {
  const [session, setSession] = useState("amodomio");
  const [token, setToken] = useState("");
  const [qr, setQr] = useState("");
  const [last, setLast] = useState<ApiResp | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "Ciao! Messaggio di test dal A Modo Mio 🍕"
  );
  const [busy, setBusy] = useState(false);

  async function call(
    op:
      | "environment"
      | "token"
      | "start"
      | "qr"
      | "qrcode-session"
      | "status"
      | "logout-session"
      | "send",
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
    <div className="px-5 py-6 mx-auto max-w-5xl font-sans">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="m-0 text-xl font-semibold">WPP — Painel simples</h2>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">session:</label>
          <input
            value={session}
            onChange={(e) => setSession(e.target.value)}
            placeholder="nome da sessão"
            className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onFlow}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />}
          Fluxo Completo
        </button>

        <button
          onClick={onEnvironment}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ambiente
        </button>
        <button
          onClick={onToken}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gerar token
        </button>
        <button
          onClick={onStart}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gerar QRCode
        </button>
        <button
          onClick={onQrSess}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          QRCode-session
        </button>
        <button
          onClick={onStatus}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Status
        </button>
        <button
          onClick={onLogout}
          disabled={busy}
          className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Logout-session
        </button>
      </div>

      {/* Token */}
      <div className="mt-3">
        <div className="text-sm">
          <b>Token:</b>{" "}
          <code className="text-xs">{token || "—"}</code>
        </div>
      </div>

      {/* QR e Última resposta */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-sm text-slate-600">QR Code</div>
          <div className="flex h-80 w-80 items-center justify-center rounded-lg border border-slate-200 bg-white">
            {qr ? (
              <img
                src={qr}
                alt="QR"
                className="h-full w-full object-contain"
                onError={() => setQr("")}
              />
            ) : (
              <span className="text-xs text-slate-500">QR não carregado</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 text-sm text-slate-600">Última resposta</div>
          <pre className="min-h-[320px] whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            {JSON.stringify(last, null, 2)}
          </pre>
        </div>
      </div>

      {/* Enviar mensagem */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-sm text-slate-600">Enviar mensagem</div>
          <div className="grid gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5546999999999"
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <button
              onClick={onSend}
              disabled={busy || !token}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar
            </button>
            {!token && (
              <small className="text-amber-700">
                Gere o token e inicie a sessão antes de enviar.
              </small>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
