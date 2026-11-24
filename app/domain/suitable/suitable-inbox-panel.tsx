import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
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
  status?: { configured: boolean; lastEventAt: string | null; errorCount: number };
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

export function SuitableInboxPanel({ readOnly }: { readOnly?: boolean }) {
  const list = useFetcher<InboxData>();
  const importFx = useFetcher<ActionData>();
  const dismissFx = useFetcher<ActionData>();
  const pauseFx = useFetcher<ActionData>();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [flash, setFlash] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const [lastImported, setLastImported] = useState<number | null>(null);

  useEffect(() => {
    list.load("/api/suitable/inbox");
    const t = setInterval(() => list.load("/api/suitable/inbox"), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  for (const fx of [importFx, dismissFx, pauseFx]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (fx.state === "idle" && fx.data) {
        list.load("/api/suitable/inbox");
        setConfirm(null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fx.state]);
  }
  useEffect(() => {
    if (importFx.state === "idle" && importFx.data?.ok)
      setLastImported(importFx.data.commandNumber ?? null);
  }, [importFx.state, importFx.data]);

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
      ? "Integração com problema. Lance os pedidos do cardápio à mão e avise o responsável."
      : st.errorCount > 0
        ? "Há pedido do cardápio que não carregou. Lance à mão e avise o responsável."
        : paused
          ? "Integração PAUSADA. Pedidos do cardápio NÃO entram sozinhos: lance à mão."
          : "Pedidos do cardápio chegando normalmente.";

  const busy = importFx.state !== "idle" || dismissFx.state !== "idle";
  const error = [importFx, dismissFx, pauseFx].find((f) => f.data?.ok === false)?.data?.error;

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
            {orders.length} {orders.length === 1 ? "pedido novo" : "pedidos novos"} do cardápio
          </span>
        )}
        {!readOnly && (
          <span className="ml-auto flex items-center gap-2">
            {confirm === "pause" ? (
              <pauseFx.Form method="post" action="/admin/suitable-api" className="flex gap-1 items-center">
                <input type="hidden" name="paused" value="true" />
                <span>Pausar? Pedidos do cardápio não entrarão no KDS.</span>
                <Button size="sm" type="submit" name="_action" value="setPaused">
                  Sim, pausar
                </Button>
                <Button size="sm" variant="outline" type="button" onClick={() => setConfirm(null)}>
                  Cancelar
                </Button>
              </pauseFx.Form>
            ) : paused ? (
              <pauseFx.Form method="post" action="/admin/suitable-api">
                <input type="hidden" name="paused" value="false" />
                <Button size="sm" type="submit" name="_action" value="setPaused">
                  Voltar a receber pedidos do cardápio
                </Button>
              </pauseFx.Form>
            ) : (
              <Button size="sm" variant="outline" type="button" onClick={() => setConfirm("pause")}>
                Pausar pedidos do cardápio
              </Button>
            )}
          </span>
        )}
      </div>

      {lastImported != null && importFx.data?.ok && (
        <div className="mt-2 font-medium text-green-800">
          Lançado na comanda {lastImported}. Confira o pedido na linha.
        </div>
      )}
      {error && <div className="mt-2 text-red-700 font-medium">{error}</div>}

      {orders.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {orders.map((o) => {
            const needsCheck = Boolean(o.fill?.unmappedItems.length);
            return (
              <li
                key={o.id}
                className="flex items-center gap-2 flex-wrap rounded bg-white/70 border px-2 py-1.5"
              >
                <span className="font-medium">
                  Pedido #{o.displayNumber ?? o.suitableOrderId}
                </span>
                <span>
                  {o.fill?.customerName || "cliente sem nome"} · R${" "}
                  {o.fill?.orderAmount.toFixed(2).replace(".", ",") ?? "—"} ·{" "}
                  {o.fill?.takeAway ? "retirada" : o.fill?.hasMoto ? "entrega" : "no local"}
                  {!o.paid && " · pagar na entrega/retirada"} · chegou às {brTime(o.receivedAt)}
                </span>
                {needsCheck && (
                  <span className="text-red-700">
                    Confira o tamanho: {o.fill!.unmappedItems.join(", ")}
                  </span>
                )}
                {o.fetchError && (
                  <span className="text-red-700">Dados incompletos: lance à mão.</span>
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
                        <importFx.Form method="post">
                          <input type="hidden" name="inboxId" value={o.id} />
                          <Button
                            size="sm"
                            type="submit"
                            name="_action"
                            value="importSuitable"
                            disabled={!o.fill || paused || busy}
                            title={
                              paused
                                ? "Integração pausada"
                                : "Preenche a próxima comanda vazia com os dados do pedido"
                            }
                          >
                            Lançar na próxima comanda
                          </Button>
                        </importFx.Form>
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
