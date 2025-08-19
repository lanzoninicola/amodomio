// app/routes/mic.tsx
import * as React from "react";

/** Hook simples para saber se já hidratou (client-side) */
function useIsClient() {
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => setIsClient(true), []);
  return isClient;
}

/** Hook mínimo para Web Speech, só client-side */
function useWebSpeech() {
  const recRef = React.useRef<any>(null);
  const runningRef = React.useRef(false);
  const [status, setStatus] = React.useState<
    "idle" | "asking" | "listening" | "ended" | "error"
  >("idle");
  const [error, setError] = React.useState<string>("");
  const [interim, setInterim] = React.useState("");
  const [finalText, setFinalText] = React.useState("");

  const start = React.useCallback(() => {
    if (typeof window === "undefined") return;           // SSR guard
    if (runningRef.current) return;                      // evita reentrância

    // Somente HTTPS ou localhost (evita "network")
    const isLocalhost =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const isSecure = location.protocol === "https:";
    if (!isLocalhost && !isSecure) {
      setStatus("error");
      setError("Precisa HTTPS (ou localhost).");
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus("error");
      setError("Navegador sem Web Speech API.");
      return;
    }

    setError("");
    setInterim("");
    setFinalText("");

    const rec = new SR();
    recRef.current = rec;
    runningRef.current = true;

    rec.lang = "pt-BR";           // ou "it-IT"
    rec.continuous = false;       // teste mínimo
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setStatus("asking");
    rec.onspeechstart = () => setStatus("listening");

    rec.onresult = (e: any) => {
      let interimAccum = "";
      let finalAccum = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalAccum += seg;
        else interimAccum += seg;
      }
      if (interimAccum) setInterim(interimAccum);
      if (finalAccum) setFinalText(prev => (prev ? prev + " " : "") + finalAccum);
    };

    rec.onerror = (e: any) => {
      const err = e?.error || "unknown";
      setStatus("error");
      setError(err);
      runningRef.current = false;
      // Importante: NÃO dar retry automático em erros de rede/permissão
      // ("network" | "not-allowed" | "service-not-allowed" | "audio-capture")
    };

    rec.onend = () => {
      // Se acabou naturalmente (sem erro), marca ended
      setStatus(prev => (prev === "error" ? "error" : "ended"));
      runningRef.current = false;
    };

    try {
      rec.start(); // chame sempre após gesto do usuário (onClick)
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || String(err));
      runningRef.current = false;
    }
  }, []);

  const stop = React.useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try { rec.stop(); } catch { }
    }
  }, []);

  // Limpeza ao desmontar (client only)
  React.useEffect(() => {
    return () => {
      const rec = recRef.current;
      if (rec) { try { rec.stop(); } catch { } }
      runningRef.current = false;
    };
  }, []);

  return { status, error, interim, finalText, start, stop };
}

/** Página client-only */
export default function MicPage() {
  const isClient = useIsClient();

  // SSR: renderiza um shell leve para evitar mismatch
  if (!isClient) {
    return (
      <div style={{ maxWidth: 720, margin: "2rem auto" }}>
        <h1>Teste de Microfone</h1>
        <p style={{ opacity: 0.6 }}>Carregando…</p>
      </div>
    );
  }

  // Client: usa Web Speech
  return <MicClientOnly />;
}

/** Componente que só renderiza no client */
function MicClientOnly() {
  const { status, error, interim, finalText, start, stop } = useWebSpeech();

  const canUse =
    typeof window !== "undefined" &&
    (((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ? true : false);

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Teste de Microfone (Client‑only)</h1>

      {!canUse && (
        <p style={{ color: "#b91c1c" }}>
          Este navegador não expõe <strong>SpeechRecognition</strong>.
          Teste no Chrome/Edge desktop.
        </p>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button onClick={start} disabled={!canUse || status === "listening"}>🎤 Iniciar</button>
        <button onClick={stop} disabled={!canUse || status === "idle"}>⏹️ Parar</button>
      </div>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        <b>Status:</b>{" "}
        {status === "idle" && "Parado"}
        {status === "asking" && "Solicitando / iniciando…"}
        {status === "listening" && "Ouvindo… fale agora"}
        {status === "ended" && "Encerrado"}
        {status === "error" && "Erro"}
        {error && <span style={{ color: "#b91c1c" }}> — {error}</span>}
      </div>

      {error === "network" && (
        <div style={{ marginTop: 8, fontSize: 12, background: "#FFEDD5", color: "#9A3412", padding: 8, borderRadius: 8 }}>
          <b>Falha de rede do serviço de voz.</b><br />
          Use HTTPS (ou localhost), desative VPN/Proxy/AdBlock e confirme as permissões do microfone.
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div><b>Interim:</b></div>
        <div style={{ minHeight: 24, opacity: 0.7, fontStyle: "italic" }}>{interim || "—"}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div><b>Final:</b></div>
        <div style={{ minHeight: 32 }}>{finalText || "—"}</div>
      </div>
    </div>
  );
}
