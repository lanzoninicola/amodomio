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
import VoiceController from "~/domain/kds/utils/voice/components/voice-controller";

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

