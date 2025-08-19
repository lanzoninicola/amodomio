import { json, defer } from "@remix-run/node";
import { Await, useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Flame, Mic, MicOff } from "lucide-react";

/* ========= Domínio KDS ========= */
import type { OrderRow } from "~/domain/kds";
import {
  ymdToDateInt,
  fmtHHMM,
  fmtElapsedHHMM,
  STATUS_COLORS,
  // Voice (PT+IT com merge)
  useVoice,
  mergeLexica,
  detectStatusWithLexicon,
  parseNumberMulti,
  LEXICON_PT_BR,
  LEXICON_IT_IT,
  parseNumberPT,
  parseNumberIT,
} from "~/domain/kds";
import {
  listActiveOrdersByDate,
  setOrderStatus,
} from "~/domain/kds/server/repository.server";

/* ===== Status (UI da rota) ===== */
const ALL_STATUSES = [
  { id: "novoPedido", label: "Novo Pedido", abbr2: "NP" },
  { id: "emProducao", label: "Em Produção", abbr2: "EP" },
  { id: "aguardandoForno", label: "Aguard. forno", abbr2: "AF" },
  { id: "assando", label: "Assando", abbr2: "AS" },
  { id: "finalizado", label: "Finalizado", abbr2: "DE" },
] as const;
const STATUS_BY_ID = Object.fromEntries(ALL_STATUSES.map((s) => [s.id, s]));
const CLICKABLE = ALL_STATUSES.filter((s) => s.id !== "finalizado");

/* ===== Loader ===== */
export async function loader({ params }: { params: { date: string } }) {
  const dateStr = params.date;
  const dateInt = ymdToDateInt(dateStr);
  const ordersPromise = listActiveOrdersByDate(dateInt);
  return defer({ dateStr, dateInt, orders: ordersPromise });
}

/* ===== Action ===== */
export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const _action = String(form.get("_action") || "");
  if (_action !== "setStatus") {
    return json({ ok: false, error: "Ação inválida." }, { status: 400 });
  }

  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  if (!id || !status || !STATUS_BY_ID[status]) {
    return json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });
  }

  await setOrderStatus(id, status);
  return json({ ok: true, id, status });
}

/* ===== Página (mobile) ===== */
export default function CozinhaDia() {
  const data = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const quickFetcher = useFetcher<{ ok: boolean }>();

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);
  useEffect(() => {
    if (quickFetcher.state === "idle") revalidate();
  }, [quickFetcher.state, revalidate]);

  function startOven(id: string) {
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", id);
    fd.set("status", "assando");
    quickFetcher.submit(fd, { method: "post" });
  }

  return (
    <div className="max-w-md mx-auto">
      <Suspense fallback={<div>Carregando pedidos do dia…</div>}>
        <Await resolve={data.orders}>
          {(orders: OrderRow[]) => {
            const countNO = orders.filter((o) => o.status === "novoPedido").length;
            const countAF = orders.filter((o) => o.status === "aguardandoForno").length;

            const ordersRequestedForOven = orders.filter(
              (o) => o.status === "aguardandoForno" && (o as any).requestedForOven === true
            );

            return (
              <>
                {/* Barra fixa com contadores e atalhos */}
                <div className="sticky top-20 z-30 bg-white/95 backdrop-blur border-b">
                  {ordersRequestedForOven.length > 0 && (
                    <div className="px-3 pt-2 pb-2">
                      <div className="text-[11px] text-gray-500 mb-1">Pedidos para assar</div>
                      <div className="grid grid-cols-4 gap-2">
                        {ordersRequestedForOven.map((o) => (
                          <div key={o.id} className="relative flex items-center justify-center">
                            <span className="absolute inline-flex h-10 w-10 rounded-full bg-red-500 opacity-60 animate-ping" />
                            <Button
                              type="button"
                              variant="default"
                              className="relative rounded-full w-10 h-10 bg-red-600 text-white shadow"
                              title={`Assar #${o.commandNumber}`}
                              onClick={() => startOven(o.id)}
                            >
                              <span className="text-[15px] font-semibold leading-none">
                                {o.commandNumber ?? "—"}
                              </span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-3 py-2 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Novo Pedido</span>
                      <span className="px-2 py-0.5 text-sm font-semibold rounded bg-gray-200 text-gray-900">
                        {countNO}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Aguard. forno</span>
                      <span className="px-2 py-0.5 text-sm font-semibold rounded bg-purple-100 text-purple-800">
                        {countAF}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista */}
                <ul className="flex flex-col gap-2 pt-2">
                  {orders.map((o) => (
                    <OrderItem key={o.id} order={o} nowMs={nowMs} />
                  ))}
                  {orders.length === 0 && (
                    <li className="text-center text-sm text-gray-500 py-6">
                      Nenhum pedido para este dia.
                    </li>
                  )}
                </ul>

                {/* Controle de Voz (flutuante) */}
                <VoiceController orders={orders} />
              </>
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}

/* ===== Item ===== */
function OrderItem({ order, nowMs }: { order: OrderRow; nowMs: number }) {
  const fetcher = useFetcher<{ ok: boolean; id: string; status: string }>();
  const current = STATUS_BY_ID[order.status ?? "novoPedido"] ?? ALL_STATUSES[0];

  const hora = useMemo(() => fmtHHMM(order.createdAt ?? undefined), [order.createdAt]);
  const decorrido = useMemo(
    () => fmtElapsedHHMM(order.createdAt ?? undefined, nowMs),
    [order.createdAt, nowMs]
  );

  function setStatus(nextId: string) {
    if (nextId === order.status) return;
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", order.id);
    fd.set("status", nextId);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <li className="relative rounded-lg border p-3 bg-white">
      {/* Topo */}
      <div className="flex items-start justify-between mb-2">
        <div className="text-2xl font-semibold flex items-center gap-1.5">
          #{order.commandNumber ?? "—"}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-700 font-mono">{hora}</div>
          <div className="text-lg font-semibold font-mono">{decorrido}</div>
        </div>
      </div>

      <div className="flex items-center justify-between w-full mb-4">
        <span
          className={`text-[11px] px-2 py-0.5 rounded ${STATUS_COLORS[order.status ?? "novoPedido"] ?? "bg-gray-200 text-gray-800"
            }`}
        >
          {current.label}
        </span>

        <div className="flex gap-2">
          {(order as any).requestedForOven && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-600 w-5 h-5">
              <Flame className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="inline-flex items-center justify-center rounded-full text-gray-600 text-[11px]">
            {/* aceita tanto takeAway (camel) quanto take_away (snake) */}
            {(order as any).takeAway ?? (order as any).take_away ? "Retirada" : "Entrega"}
          </span>
        </div>
      </div>

      {/* Botões de status (sem 'finalizado') */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {CLICKABLE.map((s) => {
          const active = s.id === order.status;
          return (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className={[
                "w-full h-12 rounded-full p-0 text-sm font-semibold tracking-wider",
                active ? "bg-blue-600 text-white" : "bg-white",
              ].join(" ")}
              onClick={() => setStatus(s.id)}
              title={s.label}
            >
              {s.abbr2}
            </Button>
          );
        })}
      </div>

      {order.status === "assando" && (
        <Button
          type="button"
          size="sm"
          className="w-full h-12 rounded-full p-0 text-sm font-semibold uppercase tracking-wider bg-green-600"
          onClick={() => setStatus("finalizado")}
          title="Finalizado"
        >
          Finalizado
        </Button>
      )}
    </li>
  );
}

/* ===== Voice Controller (PT+IT, sem toggle) ===== */
import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, AlertCircle, RefreshCw } from "lucide-react";
import type { OrderRow } from "@/domain/kds";

function VoiceController({ orders }: { orders: OrderRow[] }) {
  const fetcher = useFetcher();
  const [debugMode, setDebugMode] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  function submitStatus(commandNumber: number, statusId: string) {
    const order = orders.find((o) => o.commandNumber === commandNumber);
    if (!order || order.status === statusId) return;

    console.log(`Voice command executed: #${commandNumber} -> ${statusId}`);
    setLastCommand(`#${commandNumber} → ${statusId}`);

    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", order.id);
    fd.set("status", statusId);
    fetcher.submit(fd, { method: "post" });
  }

  const EXTRA = { intents: { assando: ["mete no forno"], emProducao: ["manda pra produção"] } };
  const MERGED = mergeLexica(LEXICON_PT_BR, LEXICON_IT_IT, EXTRA);

  const { active, listening, micStatus, interimText, lastHeard, start, stop } = useVoice((normalized, raw) => {
    console.log("Voice input:", { raw, normalized });

    const status = detectStatusWithLexicon(normalized, MERGED);
    const num = parseNumberMulti(normalized, [parseNumberPT, parseNumberIT]);

    if (debugMode) {
      console.log("Voice parsing:", { status, num, text: normalized });
    }

    if (status && num != null) {
      submitStatus(num, status);
    }
  }, { autoStart: false });

  // Reset manual para casos extremos
  const handleForceReset = async () => {
    console.log("Force reset requested");
    setRetryCount(prev => prev + 1);

    // Para completamente
    stop();

    // Aguarda um pouco mais para garantir limpeza
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Limpa qualquer estado residual
    if (typeof window !== 'undefined') {
      const store = (window as any).__KDS_SPEECH__;
      if (store) {
        store.forceStopped = false;
        store.networkErrors = 0;
        store.isRunning = false;
        store.isStarting = false;
      }

      // Tenta parar qualquer instância de reconhecimento ativa
      if ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition) {
        console.log("Cleaning up any active recognition instances...");
      }
    }

    // Reinicia
    start();
  };

  // Auto-reset em caso de erro persistente
  useEffect(() => {
    if (micStatus === "erro" && retryCount < 3) {
      const timer = setTimeout(() => {
        console.log(`Auto-retry attempt ${retryCount + 1}/3`);
        handleForceReset();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [micStatus, retryCount]);

  // Reset do contador de retry quando funciona
  useEffect(() => {
    if (micStatus === "ouvindo") {
      setRetryCount(0);
    }
  }, [micStatus]);

  const bubbleText = interimText || lastHeard ||
    (active && micStatus === "solicitando" ? "Solicitando permissão..." :
      active && micStatus === "aguardando" ? "Iniciando..." :
        active && !listening ? "Aguardando..." : "");

  const showBubble = Boolean(bubbleText || (active && listening));

  // Determina cor do botão baseado no status
  const getButtonColor = () => {
    if (!active) return "bg-gray-700 hover:bg-gray-800";

    switch (micStatus) {
      case "erro":
        return "bg-red-600 hover:bg-red-700 animate-pulse";
      case "negado":
        return "bg-red-800 hover:bg-red-900";
      case "ouvindo":
        return "bg-green-600 hover:bg-green-700";
      case "solicitando":
        return "bg-blue-600 hover:bg-blue-700 animate-pulse";
      case "aguardando":
        return "bg-yellow-600 hover:bg-yellow-700 animate-pulse";
      case "reconectando":
        return "bg-yellow-500 hover:bg-yellow-600 animate-pulse";
      default:
        return "bg-gray-700 hover:bg-gray-800";
    }
  };

  // Mensagem de status mais clara
  const getStatusMessage = () => {
    switch (micStatus) {
      case "ouvindo":
        return "🎤 Ouvindo...";
      case "aguardando":
        return "⏳ Iniciando...";
      case "parado":
        return "⏸️ Parado";
      case "negado":
        return "🚫 Permissão negada";
      case "erro":
        return `❌ Erro${retryCount > 0 ? ` (tentativa ${retryCount}/3)` : ""}`;
      case "solicitando":
        return "🔵 Solicitando permissão...";
      case "reconectando":
        return "🔄 Reconectando...";
      default:
        return "";
    }
  };

  // Instruções para o usuário quando há problema
  const getHelpMessage = () => {
    if (micStatus === "negado") {
      return (
        <div className="text-[10px] bg-red-100 text-red-800 p-2 rounded max-w-[200px] mt-1">
          <strong>Permissão negada!</strong><br />
          1. Clique no 🔒 na barra de endereço<br />
          2. Permita o microfone<br />
          3. Recarregue a página
        </div>
      );
    }

    if (micStatus === "erro" && retryCount >= 3) {
      return (
        <div className="text-[10px] bg-orange-100 text-orange-800 p-2 rounded max-w-[200px] mt-1">
          <strong>Erro persistente!</strong><br />
          Tente recarregar a página ou<br />
          verificar as configurações do navegador
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-1">
      {/* Debug toggle (só em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setDebugMode(!debugMode)}
          className="text-[8px] text-gray-400 bg-gray-100 px-1 rounded hover:bg-gray-200 transition-colors"
        >
          {debugMode ? "Debug ON" : "Debug OFF"}
        </button>
      )}

      {/* Status detalhado */}
      <div className="text-[10px] text-gray-600 select-none pr-1 flex flex-col items-end">
        <div className="font-medium">
          {getStatusMessage()}
        </div>
        {lastCommand && (
          <div className="text-green-600 font-mono mt-1">
            ✓ {lastCommand}
          </div>
        )}
        {getHelpMessage()}
      </div>

      {/* Balão de fala */}
      {showBubble && (
        <div className="max-w-[60vw] sm:max-w-xs bg-white border shadow-lg rounded-2xl px-3 py-2 text-[13px] text-gray-800 relative">
          <span className={interimText ? "opacity-80 italic" : ""}>
            {bubbleText || "..."}
          </span>

          {/* Indicador de processamento animado */}
          {active && (micStatus === "aguardando" || micStatus === "solicitando") && (
            <span className="inline-flex ml-1">
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce mr-1" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce mr-1" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}

          {/* Seta do balão */}
          <div
            className="absolute -right-2 bottom-3 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-white"
            aria-hidden
          />
        </div>
      )}

      {/* Botões de controle */}
      <div className="flex flex-col gap-2">
        {/* Botão principal do microfone */}
        <Button
          type="button"
          onClick={active ? stop : start}
          className={`rounded-full w-14 h-14 shadow-lg transition-all duration-200 ${getButtonColor()}`}
          title={active ? "Desligar microfone" : "Ligar microfone"}
          disabled={micStatus === "solicitando"}
        >
          {active ? (
            micStatus === "erro" ? (
              <AlertCircle className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )
          ) : (
            <MicOff className="w-6 h-6 text-white" />
          )}
        </Button>

        {/* Botão de reset manual (aparece em erro após tentativas falharem) */}
        {micStatus === "erro" && retryCount >= 3 && (
          <Button
            type="button"
            onClick={handleForceReset}
            className="rounded-full w-10 h-10 bg-orange-600 hover:bg-orange-700 text-white shadow transition-all"
            title="Tentar novamente"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Debug info aprimorado */}
      {debugMode && process.env.NODE_ENV === 'development' && (
        <div className="bg-black/90 text-white text-[10px] p-2 rounded max-w-xs font-mono">
          <div className="text-green-400">== Voice Debug ==</div>
          <div>Active: {active ? "✓" : "✗"}</div>
          <div>Listening: {listening ? "✓" : "✗"}</div>
          <div>Status: {micStatus}</div>
          <div>Retry: {retryCount}/3</div>
          <div className="mt-1 text-yellow-400">Last heard:</div>
          <div className="text-xs">{lastHeard || "(none)"}</div>
          <div className="mt-1 text-yellow-400">Interim:</div>
          <div className="text-xs">{interimText || "(none)"}</div>
          {typeof window !== 'undefined' && (window as any).__KDS_SPEECH__ && (
            <>
              <div className="mt-1 text-yellow-400">Store:</div>
              <pre className="text-[8px] overflow-auto max-w-[200px]">
                {JSON.stringify((window as any).__KDS_SPEECH__, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

