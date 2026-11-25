import { AlertCircle, RefreshCw, Pause, Play } from "lucide-react";
import { useFetcher, useRevalidator } from "@remix-run/react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "~/components/ui/button";

type InboxOrder = {
  id: string;
  suitableOrderId: number;
  displayNumber: string | null;
  paid: boolean;
  receivedAt: string;
  fetchError: string | null;
  fill: {
    customerName: string;
    orderAmount: number;
    unmappedItems: string[];
    takeAway: boolean;
    hasMoto: boolean;
  } | null;
};

type InboxData = {
  paused: boolean;
  status?: { configured: boolean; lastEventAt: string | null; errorCount: number; lastImportedAt?: string | null };
  orders: InboxOrder[];
};

type ActionData = { ok: boolean; error?: string; commandNumber?: number | null };

const brTime = (iso: string, withDate = false) =>
  new Date(iso).toLocaleString("pt-BR", {
    ...(withDate ? { day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch {
    /* navegador pode bloquear áudio antes do primeiro clique */
  }
}

function useSuitableIntegrationState() {
  const list = useFetcher<InboxData>();
  const revalidator = useRevalidator();
  const lastImportVersion = useRef<string | null>(null);
  const dismissFx = useFetcher<ActionData>();
  const pauseFx = useFetcher<ActionData>();
  const retryFx = useFetcher<ActionData>();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [flash, setFlash] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    list.load("/api/suitable/inbox");
    const t = setInterval(() => list.load("/api/suitable/inbox"), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ([dismissFx, pauseFx, retryFx].some((fx) => fx.state === "idle" && fx.data)) {
      list.load("/api/suitable/inbox");
      setConfirm(null);
    }
    // Recarrega após concluir uma ação, sem depender da identidade dos fetchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissFx.state, pauseFx.state, retryFx.state]);
  useEffect(() => {
    const version = list.data?.status?.lastImportedAt;
    if (version && version !== lastImportVersion.current) {
      lastImportVersion.current = version;
      revalidator.revalidate();
    }
  }, [list.data?.status?.lastImportedAt, revalidator]);

  const orders = list.data?.orders ?? [];
  const paused = list.data?.paused ?? false;
  const st = list.data?.status;

  // Aviso de pedido novo: som + destaque (não toca na primeira carga)
  useEffect(() => {
    if (!list.data) return;
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current && orders.some((o) => !seen.current!.has(o.id))) {
      if (!paused) beep();
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 6000);
      seen.current = ids;
      return () => clearTimeout(t);
    }
    seen.current = ids;
  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const problem = st && (!st.configured || st.errorCount > 0);
  const tone = !st
    ? "gray"
    : problem
      ? "red"
      : paused
        ? "amber"
        : "green";
  const palette = {
    gray: "border-gray-200 bg-white text-gray-700",
    red: "border-red-300 bg-red-50 text-red-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    green: "border-green-300 bg-green-50 text-green-900",
  }[tone];
  const message = !st
    ? "Verificando pedidos do cardápio…"
    : !st.configured
      ? "Integração sem configuração. Avise o responsável."
      : st.errorCount > 0
        ? "Há pedido do cardápio aguardando recuperação."
        : paused
          ? "Integração PAUSADA. Pedidos do cardápio NÃO entram sozinhos: lance à mão."
          : "Pedidos do cardápio lançados automaticamente no KDS.";

  const error = [dismissFx, pauseFx, retryFx].find((f) => f.data?.ok === false)?.data?.error;

  return { list, dismissFx, pauseFx, retryFx, confirm, setConfirm, showDetails, setShowDetails, flash, orders, paused, st, problem, palette, message, error };
}

const SuitableIntegrationContext = createContext<ReturnType<typeof useSuitableIntegrationState> | null>(null);

export function SuitableIntegrationProvider({ children }: { children: ReactNode }) {
  const state = useSuitableIntegrationState();
  return <SuitableIntegrationContext.Provider value={state}>{children}</SuitableIntegrationContext.Provider>;
}

function useSuitableIntegration() {
  const state = useContext(SuitableIntegrationContext);
  if (!state) throw new Error("SuitableIntegrationProvider ausente no layout do KDS");
  return state;
}

export function SuitableIntegrationToolbar() {
  const { list, paused, st, pauseFx } = useSuitableIntegration();
  const label = !list.data ? "Verificando" : paused ? "Pausada" : !st?.configured || st.errorCount > 0 ? "Com falha" : "Ativa";
  const color = !list.data ? "bg-slate-400" : paused ? "bg-amber-500" : !st?.configured || st.errorCount > 0 ? "bg-red-500" : "bg-emerald-500";
  const actionLabel = paused ? "Retomar integração Suitable" : "Pausar integração Suitable";
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 lg:ml-auto">
      <pauseFx.Form method="post" action="/admin/suitable-api">
        <input type="hidden" name="paused" value={String(!paused)} />
        <Button type="submit" name="_action" value="setPaused" size="icon" variant="outline"
          className="h-9 w-9" disabled={!list.data || pauseFx.state !== "idle"} title={actionLabel} aria-label={actionLabel}>
          {pauseFx.state !== "idle" ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </pauseFx.Form>
      <span role="status" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600">
        <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
        Suitable · {label}
      </span>
      {pauseFx.data?.ok === false && <span role="alert" className="basis-full max-w-sm text-right text-xs text-red-700">{pauseFx.data.error}</span>}
    </div>
  );
}

export function SuitableInboxPanel({ readOnly }: { readOnly?: boolean }) {
  const { list, dismissFx, retryFx, confirm, setConfirm, showDetails, setShowDetails, flash, orders, paused, st, problem, palette, message, error } = useSuitableIntegration();
  if (!list.data || paused) return null;

  return (
    <div
      className={`border rounded-md p-3 mb-2 text-sm ${palette} ${
        flash ? "ring-4 ring-pink-400 animate-pulse" : ""
      }`}
      role="status"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-base">{message}</span>
        {orders.length > 0 && !problem && (
          <span className="rounded-full bg-pink-600 text-white px-3 py-1 text-sm font-bold">
            {orders.length} {orders.length === 1 ? "pedido aguardando lançamento automático" : "pedidos aguardando lançamento automático"}
          </span>
        )}

      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-white p-3 text-red-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">A ação não foi concluída</p>
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{error}</p>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {orders.map((o) => {
            const importFailed = Boolean(o.fetchError?.includes("etapa=import_kds"));
            const needsCheck = Boolean(o.fill?.unmappedItems.length);
            return (
              <li
                key={o.id}
                className="flex items-center gap-2 flex-wrap rounded bg-white/70 border px-2 py-1.5"
              >
                <span className="font-medium">
                  Pedido {o.displayNumber ? `#${o.displayNumber}` : "(número indisponível)"}
                </span>
                <span className="text-sm">
                  {o.fill ? (
                    <>
                      {o.fill.customerName || "cliente sem nome"} · R$ {o.fill.orderAmount.toFixed(2).replace(".", ",")} ·{" "}
                      {o.fill.takeAway ? "retirada" : o.fill.hasMoto ? "entrega" : "no local"}
                      {!o.paid && " · pagar na entrega/retirada"} ·{" "}
                    </>
                  ) : "Dados do pedido ainda não carregados · "}
                  recebido às {brTime(o.receivedAt)}
                </span>
                {needsCheck && (
                  <span className="text-red-700">
                    Conferir tamanho no KDS: {o.fill!.unmappedItems.join(", ")}
                  </span>
                )}
                {!readOnly && (
                  <span className="ml-auto flex gap-2 items-center">
                    {confirm === `dismiss:${o.id}` ? (
                      <dismissFx.Form method="post" className="flex gap-1 items-center">
                        <input type="hidden" name="inboxId" value={o.id} />
                        <span>Este pedido vai sumir da lista. Confirma?</span>
                        <Button size="sm" variant="outline" type="submit" name="_action" value="dismissSuitable">
                          Sim, não vou lançar
                        </Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => setConfirm(null)}>
                          Voltar
                        </Button>
                      </dismissFx.Form>
                    ) : (
                      <>

                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => setConfirm(`dismiss:${o.id}`)}
                        >
                          Não vou lançar
                        </Button>
                      </>
                    )}
                  </span>
                )}
                {o.fetchError && (
                  <div className="basis-full rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
                    <div className="flex flex-wrap items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{importFailed ? "Não foi possível lançar o pedido automaticamente" : "Não foi possível carregar o pedido"}</p>
                        <p className="mt-1 text-sm">A recuperação é automática enquanto o KDS estiver aberto. Se a falha continuar, avise o responsável.</p>
                      </div>
                      {!readOnly && (
                        <retryFx.Form method="post" action="/admin/suitable-api">
                          <input type="hidden" name="orderId" value={o.suitableOrderId} />
                          <Button size="sm" variant="outline" type="submit" name="_action" value="retryOrder" disabled={retryFx.state !== "idle"}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${retryFx.state !== "idle" && String(retryFx.formData?.get("orderId")) === String(o.suitableOrderId) ? "animate-spin" : ""}`} aria-hidden="true" />
                            {retryFx.state !== "idle" && String(retryFx.formData?.get("orderId")) === String(o.suitableOrderId) ? "Buscando…" : "Tentar de novo"}
                          </Button>
                        </retryFx.Form>
                      )}
                    </div>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer underline">Ver diagnóstico técnico</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono text-gray-700">{o.fetchError}</pre>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 text-xs">
        <button
          type="button"
          className="underline"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "esconder detalhes" : "ver detalhes"}
        </button>
        {showDetails && (
          <span className="ml-2">
            Último aviso recebido da Suitable:{" "}
            {st?.lastEventAt ? brTime(st.lastEventAt, true) : "nenhum"} ·{" "}
            {st && !st.configured ? "chaves da integração faltando · " : ""}
            {st?.errorCount ? `${st.errorCount} pedido(s) com falha · ` : ""}
            <a href="/admin/suitable-api" className="underline">
              página técnica
            </a>
          </span>
        )}
      </div>
    </div>
  );
}
