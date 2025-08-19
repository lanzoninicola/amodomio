/* ===== Voice Controller (UI moderna, texto à esquerda) ===== */
import { useState, useEffect, useMemo } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, AlertCircle, RefreshCw, Waves, CheckCircle2, Loader2 } from "lucide-react";
import type { OrderRow } from "@/domain/kds";
import { mergeLexica, LEXICON_PT_BR, LEXICON_IT_IT, detectStatusWithLexicon, parseNumberMulti, parseNumberPT, parseNumberIT, useVoice } from "@/domain/kds";

type MicColor = "idle" | "listening" | "starting" | "error" | "waiting";

export default function VoiceController({ orders }: { orders: OrderRow[] }) {
  const fetcher = useFetcher();
  const [debugMode, setDebugMode] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  function submitStatus(commandNumber: number, statusId: string) {
    const order = orders.find((o) => o.commandNumber === commandNumber);
    if (!order || order.status === statusId) return;

    setLastCommand(`#${commandNumber} → ${statusId}`);
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", order.id);
    fd.set("status", statusId);
    fetcher.submit(fd, { method: "post" });
  }

  const EXTRA = { intents: { assando: ["mete no forno"], emProducao: ["manda pra produção"] } };
  const MERGED = useMemo(() => mergeLexica(LEXICON_PT_BR, LEXICON_IT_IT, EXTRA), []);

  const { active, listening, micStatus, interimText, lastHeard, start, stop } = useVoice((normalized) => {
    const status = detectStatusWithLexicon(normalized, MERGED);
    const num = parseNumberMulti(normalized, [parseNumberPT, parseNumberIT]);
    if (debugMode) console.log("Voice parsing:", { status, num, text: normalized });
    if (status && num != null) submitStatus(num, status);
  }, { autoStart: false });

  // auto‑retry leve apenas quando faz sentido
  useEffect(() => {
    if (micStatus === "erro" && retryCount < 2) {
      const t = setTimeout(() => {
        // não tente em erros "network/not-allowed/service-not-allowed"
        const last = (window as any).__KDS_SPEECH__?.lastError;
        if (last && ["network", "not-allowed", "service-not-allowed", "audio-capture"].includes(last)) return;
        setRetryCount((n) => n + 1);
        start();
      }, 1200 * (retryCount + 1));
      return () => clearTimeout(t);
    }
  }, [micStatus, retryCount, start]);

  useEffect(() => {
    if (micStatus === "ouvindo") setRetryCount(0);
  }, [micStatus]);

  // texto à esquerda (prioriza o que está em andamento)
  const bubbleText = interimText || lastHeard || (active ? (micStatus === "solicitando" ? "Solicitando permissão..." : "Fale um comando…") : "");

  // cor/estado do botão
  const color: MicColor = !active
    ? "idle"
    : micStatus === "erro"
      ? "error"
      : micStatus === "ouvindo"
        ? "listening"
        : micStatus === "aguardando" || micStatus === "reconectando"
          ? "waiting"
          : "starting";

  const micClasses: Record<MicColor, string> = {
    idle: "bg-gray-800 hover:bg-gray-900",
    listening: "bg-green-600 hover:bg-green-700",
    starting: "bg-blue-600 hover:bg-blue-700",
    waiting: "bg-amber-500 hover:bg-amber-600",
    error: "bg-red-600 hover:bg-red-700",
  };

  const statusChip = (() => {
    switch (micStatus) {
      case "ouvindo":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ouvindo
          </span>
        );
      case "aguardando":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Iniciando…
          </span>
        );
      case "reconectando":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reconectando…
          </span>
        );
      case "negado":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" /> Permissão negada
          </span>
        );
      case "erro":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" /> Erro
          </span>
        );
      case "solicitando":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Solicitando permissão…
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4 sm:px-6 pointer-events-none">
      <div className="mx-auto max-w-3xl flex items-center gap-3">
        {/* Coluna esquerda: bolha de transcrição + histórico curto */}
        <div className="pointer-events-auto flex-1">
          {
            active && (

              <div className="inline-flex  max-w-full transition-all">
                <div className="relative w-full sm:max-w-md">
                  {/* bolha */}
                  <div className="rounded-lg border bg-white/95 backdrop-blur px-3 py-2 shadow-md">
                    <div className={`text-[12px] ${interimText ? "italic opacity-80" : "opacity-100"} text-gray-900 break-words`}>
                      {bubbleText || "—"}
                    </div>
                    {/* rabinho da bolha */}
                    <div
                      className="absolute -right-2 bottom-3 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white"
                      aria-hidden
                    />
                  </div>

                  {/* feedback do último comando */}
                  {lastCommand && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="font-mono">✓ {lastCommand}</span>
                    </div>
                  )}
                </div>
              </div>

            )
          }
        </div>

        {/* Coluna direita: cartão compacto com status + botão */}
        <div className="pointer-events-auto">
          <div className="flex flex-col items-end p-2 ">
            {/* toggle debug (só dev) */}
            {process.env.NODE_ENV === "development" && active && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setDebugMode((v) => !v)}
                  className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded hover:bg-gray-200"
                >
                  {debugMode ? "Debug ON" : "Debug OFF"}
                </button>
              </div>
            )}

            <div className="flex items-center justify-start pb-1 min-h-[20px]">
              {statusChip}
            </div>

            <div className="relative flex items-center justify-center py-2">
              {/* ondas ao ouvir */}
              {active && listening && (
                <>
                  <span className="absolute inline-flex h-16 w-16 rounded-full bg-green-500/30 animate-ping" />
                  <span className="absolute inline-flex h-10 w-10 rounded-full bg-green-500/30 animate-ping [animation-delay:120ms]" />
                </>
              )}

              <Button
                type="button"
                onClick={active ? stop : start}
                className={`rounded-full w-14 h-14 shadow-lg transition-all ${micClasses[color]} ${active && listening ? "ring-4 ring-green-200" : ""}`}
                title={active ? "Desligar microfone" : "Ligar microfone"}
              >
                {active ? (
                  micStatus === "erro" ? <AlertCircle className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />
                ) : (
                  <MicOff className="w-6 h-6 text-white" />
                )}
              </Button>
            </div>

            {/* ajuda contextual em erros de rede/permissão */}
            {micStatus === "erro" && (
              <div className="px-2 pb-1">
                <div className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 rounded-md p-1.5">
                  Falha no serviço de voz. Use <b>HTTPS/localhost</b>, desative <b>VPN/Proxy</b> e verifique permissões.
                </div>
              </div>
            )}
          </div>

          {/* botão de retry manual só após repetidas falhas */}
          {micStatus === "erro" && retryCount >= 2 && (
            <div className="flex justify-center mt-2">
              <Button
                type="button"
                onClick={() => { setRetryCount(0); start(); }}
                className="rounded-full w-10 h-10 bg-amber-600 hover:bg-amber-700 text-white shadow"
                title="Tentar novamente"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}


