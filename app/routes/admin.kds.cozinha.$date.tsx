import { json, defer } from "@remix-run/node";
import { Await, useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import { Suspense, useEffect, useMemo, useState } from "react";

/* shadcn/ui */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/* ========= Domínio KDS ========= */
import type { OrderRow } from "~/domain/kds";
import {
  ymdToDateInt,
  fmtHHMM,
  fmtElapsedHHMM,
} from "~/domain/kds";
import {
  KdsStatus,
  listActiveOrdersByDate,
  setOrderStatus,
} from "~/domain/kds/server/repository.server";
import { cn } from "~/lib/utils";

/* ===== Status (UI da rota) ===== */
const ALL_STATUSES = [
  { id: "novoPedido", label: "Novo Pedido", abbr2: "NP" },
  { id: "emProducao", label: "Em Produção", abbr2: "EP" },
  { id: "aguardandoForno", label: "Aguard. forno", abbr2: "AF" },
  { id: "assando", label: "Assando", abbr2: "AS" },
  { id: "finalizado", label: "Finalizado", abbr2: "DE" },
] as const;
const STATUS_BY_ID = Object.fromEntries(ALL_STATUSES.map((s) => [s.id, s]));

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

  await setOrderStatus(id, status as KdsStatus);
  return json({ ok: true, id, status });
}

/* ===== Página ===== */
export default function CozinhaDia() {
  const data = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const quickFetcher = useFetcher<{ ok: boolean }>();
  const [statusFilter, setStatusFilter] = useState<"all" | "novoPedido" | "aguardandoForno" | "assando">("all");

  // relógio leve (atualização de 30s é suficiente para a cozinha)
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // revalidação periódica
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);
  // revalida quando termina um POST rápido
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
    <div className="max-w-5xl mx-auto">
      <Suspense fallback={<div className="px-3 py-4">Carregando pedidos do dia…</div>}>
        <Await resolve={data.orders}>
          {(orders: OrderRow[]) => {
            const countNO = orders.filter((o) => o.status === "novoPedido").length;
            const countAF = orders.filter((o) => o.status === "aguardandoForno").length;
            const countAS = orders.filter((o) => o.status === "assando").length;
            const ordersRequestedForOven = orders.filter(
              (o) => o.status === "aguardandoForno" && (o as any).requestedForOven === true
            );
            const visibleOrders =
              statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

            return (
              <>
                {/* Barra fixa com contadores e atalhos */}
                <div className="sticky top-20 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)]">
                  {ordersRequestedForOven.length > 0 && (
                    <div className="px-3 pt-2 pb-2">
                      <div className="text-[11px] text-gray-500 mb-1">Pedidos para assar</div>
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
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

                  <div className="px-3 py-2 border-t border-slate-100 bg-white/85 backdrop-blur-md">
                    <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={statusFilter === "novoPedido" ? "default" : "outline"}
                      className={cn(
                        "h-10 w-full rounded-xl px-2 text-sm font-bold whitespace-nowrap",
                        statusFilter === "novoPedido"
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100"
                      )}
                      onClick={() =>
                        setStatusFilter((f) => (f === "novoPedido" ? "all" : "novoPedido"))
                      }
                    >
                      NP ({countNO})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={statusFilter === "aguardandoForno" ? "default" : "outline"}
                      className={cn(
                        "h-10 w-full rounded-xl px-2 text-sm font-bold whitespace-nowrap",
                        statusFilter === "aguardandoForno"
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      )}
                      onClick={() =>
                        setStatusFilter((f) =>
                          f === "aguardandoForno" ? "all" : "aguardandoForno"
                        )
                      }
                    >
                      AF ({countAF})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={statusFilter === "assando" ? "default" : "outline"}
                      className={cn(
                        "h-10 w-full rounded-xl px-2 text-sm font-bold whitespace-nowrap",
                        statusFilter === "assando"
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                      )}
                      onClick={() => setStatusFilter((f) => (f === "assando" ? "all" : "assando"))}
                    >
                      AS ({countAS})
                    </Button>
                    </div>
                  </div>
                </div>

                {/* GRID DE CARDS — colapsado: # grande + tempo; expandido: detalhes */}
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
                  {visibleOrders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      nowMs={nowMs}
                    />
                  ))}
                  {visibleOrders.length === 0 && (
                    <li className="col-span-full text-center text-sm text-gray-500 py-6">
                      Nenhum pedido neste filtro.
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

/* ===== Card ===== */
function OrderCard({
  order,
  nowMs,
}: {
  order: OrderRow;
  nowMs: number;
}) {
  const fetcher = useFetcher<{ ok: boolean; id: string; status: string }>();

  const hora = useMemo(() => fmtHHMM(order.novoPedidoAt ?? undefined), [order.createdAt]);
  const decorrido = useMemo(() => fmtElapsedHHMM(order.novoPedidoAt ?? undefined, nowMs), [order.novoPedidoAt, nowMs]);

  function setStatus(nextId: string) {
    if (nextId === order.status) return;
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", order.id);
    fd.set("status", nextId);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <li className="list-none">
      <Card
        className={[
          "relative overflow-hidden",
          "shadow-sm border-2",
          Number(decorrido.substring(0, 2)) >= 45 && "border-red-400"
        ].join(" ")}
      >
        <CardContent className="p-2 sm:p-3">
          <div className="flex flex-col items-center justify-center select-none pt-1">
            <div className="leading-none tracking-tight font-black text-4xl sm:text-5xl">
              <span className="text-2xl text-foreground/90">#</span>
              <span className="font-mono tabular-nums">{order.commandNumber ?? "—"}</span>
            </div>
            <div className="mt-1 font-mono text-xs sm:text-sm tabular-nums text-muted-foreground">
              {hora}
            </div>
          </div>
          <Separator className="my-2" />

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={order.status === "aguardandoForno" ? "default" : "outline"}
              className={cn(
                "h-12 sm:h-14 rounded-xl text-lg sm:text-xl font-bold tracking-wide",
                order.status === "aguardandoForno" && "bg-blue-600 text-white"
              )}
              onClick={() => setStatus("aguardandoForno")}
              title="Aguardando forno"
            >
              AF
            </Button>
            <Button
              type="button"
              variant={order.status === "assando" ? "default" : "outline"}
              className={cn(
                "h-12 sm:h-14 rounded-xl text-lg sm:text-xl font-bold tracking-wide",
                order.status === "assando" && "bg-blue-600 text-white"
              )}
              onClick={() => setStatus("assando")}
              title="Assando"
            >
              AS
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
