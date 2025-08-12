// app/routes/admin.kds.cozinha.$date.tsx
import { json, defer } from "@remix-run/node";
import { Await, useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import { Prisma } from "@prisma/client";
import { Suspense, useEffect, useMemo, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { Button } from "@/components/ui/button";

/* ===== Helpers ===== */
function ymdToDateInt(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return Number(`${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`);
}
function fmtHHMM(dateLike: string | Date | undefined) {
  if (!dateLike) return "--:--";
  const d = new Date(dateLike);
  return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtElapsedHHMM(from: string | Date | undefined, nowMs: number) {
  if (!from) return "--:--";
  const d = new Date(from);
  const diff = nowMs - d.getTime();
  if (!isFinite(diff) || diff < 0) return "--:--";
  const totalMin = Math.floor(diff / 60000);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

type DecimalLike = number | string | Prisma.Decimal;
type OrderRow = {
  id: string;
  dateInt: number;
  createdAt: string;
  commandNumber: number;
  status: string;
  orderAmount?: DecimalLike;
};

/* ===== Status (label + 2 letras) ===== */
const ALL_STATUSES = [
  { id: "novoPedido", label: "Novo Pedido", abbr2: "NO", badge: "bg-gray-200 text-gray-900" },
  { id: "emProducao", label: "Em Produção", abbr2: "EP", badge: "bg-blue-100 text-blue-800" },
  { id: "aguardandoForno", label: "Aguard. forno", abbr2: "AF", badge: "bg-purple-100 text-purple-800" },
  { id: "assando", label: "Assando", abbr2: "AS", badge: "bg-orange-100 text-orange-800" },
  { id: "despachada", label: "Despachada", abbr2: "DE", badge: "bg-yellow-100 text-yellow-900" },
] as const;
const STATUS_BY_ID = Object.fromEntries(ALL_STATUSES.map(s => [s.id, s]));

// Botões clicáveis na cozinha (sem "despachada")
const CLICKABLE = ALL_STATUSES.filter(s => s.id !== "despachada");

/* ===== Loader: pedidos do dia (oculta 'despachada') ===== */
export async function loader({ params }: { params: { date: string } }) {
  const dateStr = params.date;
  const dateInt = ymdToDateInt(dateStr);

  const ordersPromise = await prismaClient.kdsDailyOrderDetail.findMany({
    where: {
      dateInt,
      status: { not: "despachada" }, // não mostrar 'despachada'
    },
    orderBy: [{ commandNumber: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      dateInt: true,
      createdAt: true,
      commandNumber: true,
      status: true,
      orderAmount: true,
    },
  });

  return defer({ dateStr, dateInt, orders: ordersPromise });
}

/* ===== Action: atualizar status (cozinha NÃO pode setar 'despachada') ===== */
export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const _action = String(form.get("_action") || "");
  if (_action !== "setStatus") return json({ ok: false, error: "Ação inválida." }, { status: 400 });

  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  if (!id || !status) return json({ ok: false, error: "Parâmetros insuficientes." }, { status: 400 });
  if (status === "despachada") return json({ ok: false, error: "Operação não permitida." }, { status: 403 });
  if (!STATUS_BY_ID[status]) return json({ ok: false, error: "Status desconhecido." }, { status: 400 });

  await prismaClient.kdsDailyOrderDetail.update({ where: { id }, data: { status } });
  return json({ ok: true, id, status });
}

/* ===== Página do dia (mobile) ===== */
export default function CozinhaDia() {
  const data = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Atualiza "decorrido" a cada 30s
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Revalida a cada 5min
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  return (
    <div className="max-w-md mx-auto">
      <Suspense fallback={<div>Carregando pedidos do dia…</div>}>
        <Await resolve={data.orders}>
          {(orders: OrderRow[]) => {
            const countNO = orders.filter(o => o.status === "novoPedido").length;
            const countAF = orders.filter(o => o.status === "aguardandoForno").length;

            return (
              <>
                {/* === Barra de contadores (fixa no topo, abaixo do seletor) === */}
                <div className="sticky top-14 z-30 bg-white/95 backdrop-blur border-b">
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
              </>
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}

/* ===== Item (linha) ===== */
function OrderItem({ order, nowMs }: { order: OrderRow; nowMs: number }) {
  const fetcher = useFetcher<{ ok: boolean; id: string; status: string }>();
  const current = STATUS_BY_ID[order.status] ?? ALL_STATUSES[0];

  const hora = useMemo(() => fmtHHMM(order.createdAt), [order.createdAt]);
  const decorrido = useMemo(() => fmtElapsedHHMM(order.createdAt, nowMs), [order.createdAt, nowMs]);

  function setStatus(nextId: string) {
    if (nextId === order.status) return;
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", order.id);
    fd.set("status", nextId);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <li className="rounded-lg border p-3 bg-white">
      {/* Topo: Nº + Status perto | Hora (mono) | Decorrido (mono, maior e bold) */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold">#{order.commandNumber}</div>
          <span className={`text-[11px] px-2 py-0.5 rounded ${current.badge}`}>
            {current.label}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-700 font-mono">{hora}</div>
          <div className="text-lg font-semibold font-mono">{decorrido}</div>
        </div>
      </div>

      {/* Botões de status — grid, 2 letras, salva no toque (sem 'despachada') */}
      <div className="grid grid-cols-4 gap-2">
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
    </li>
  );
}
