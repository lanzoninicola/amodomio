import { json } from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
} from "@remix-run/react";
import prisma from "~/lib/prisma/client.server";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* dnd-kit core + sortable */
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ============================= helpers ============================= */
function ymdToDateInt(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return Number(`${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`);
}
function fmtHHMM(dateLike?: string | Date) {
  if (!dateLike) return "--:--";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtElapsed(from?: string | Date, nowMs?: number) {
  if (!from || !nowMs) return "--:--";
  const d = new Date(from);
  const diff = nowMs - d.getTime();
  if (!Number.isFinite(diff) || diff < 0) return "--:--";
  const totalMin = Math.floor(diff / 60000);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ============================= tipos ============================= */
type StatusId =
  | "novoPedido"
  | "emProducao"
  | "aguardandoForno"
  | "assando"
  | "despachada";

type Detail = {
  id: string;
  dateInt: number;
  createdAt: string;
  commandNumber: number;
  status: StatusId;
  orderAmount: any;
  motoValue: any;
  channel: string | null;
};

/* ============================= status ============================= */
const STATUSES: { id: StatusId; label: string; color: string }[] = [
  { id: "novoPedido", label: "Novo Pedido", color: "bg-gray-100 text-gray-900" },
  { id: "emProducao", label: "Em Produção", color: "bg-blue-100 text-blue-800" },
  { id: "aguardandoForno", label: "Aguardando forno", color: "bg-purple-100 text-purple-800" },
  { id: "assando", label: "Assando", color: "bg-orange-100 text-orange-800" },
  { id: "despachada", label: "Despachada", color: "bg-yellow-100 text-yellow-900" },
];

/* ============================= loader/action ============================= */
export async function loader({ params }: { params: { date: string } }) {
  const dateStr = params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Response("Data inválida", { status: 400 });
  }
  const dateInt = ymdToDateInt(dateStr);

  const details = await prisma.kdsDailyOrderDetail.findMany({
    where: { dateInt },
    orderBy: [{ commandNumber: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      dateInt: true,
      createdAt: true,
      commandNumber: true,
      status: true,
      orderAmount: true,
      motoValue: true,
      channel: true,
    },
  });

  return json({ dateStr, dateInt, details });
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const _action = String(form.get("_action") || "");
  if (_action !== "setStatus") {
    return json({ ok: false, error: "Ação inválida" }, { status: 400 });
  }
  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "") as StatusId;
  if (!id || !status) {
    return json({ ok: false, error: "Parâmetros insuficientes" }, { status: 400 });
  }
  if (!STATUSES.some((s) => s.id === status)) {
    return json({ ok: false, error: "Status desconhecido" }, { status: 400 });
  }

  await prisma.kdsDailyOrderDetail.update({
    where: { id },
    data: { status },
  });

  return json({ ok: true, id, status });
}

/* ============================= componentes ============================= */
function SortableCard({ item }: { item: Detail }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const pedido = Number(item.orderAmount?.toString?.() ?? item.orderAmount ?? 0);
  const moto = Number(item.motoValue?.toString?.() ?? item.motoValue ?? 0);

  const hora = fmtHHMM(item.createdAt);
  const dec = fmtElapsed(item.createdAt, Date.now());

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-md border px-3 py-2 bg-white shadow-sm cursor-grab active:cursor-grabbing touch-pan-y"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">#{item.commandNumber}</div>
        <div className="text-[11px] text-gray-600 font-mono">{hora}</div>
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <div className="text-gray-700 font-mono font-semibold">{dec}</div>
        <div className="text-gray-600">{item.channel ?? ""}</div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
        <div className="rounded bg-gray-50 px-2 py-1">
          <span className="text-gray-500">Pedido</span>{" "}
          <span className="font-semibold">
            {pedido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="rounded bg-gray-50 px-2 py-1">
          <span className="text-gray-500">Moto</span>{" "}
          <span className="font-semibold">
            {moto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </article>
  );
}

function Column({
  status,
  items,
  children,
}: {
  status: StatusId;
  items: Detail[];
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border bg-white min-h-[60vh]">
      {children}
      {/* SortableContext dá reorder dentro da coluna */}
      <div className="p-2 space-y-2 overflow-y-auto">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length === 0 && (
            <div className="text-xs text-gray-500 px-2 py-6 text-center">
              Nenhum pedido.
            </div>
          )}
          {items.map((o) => (
            <SortableCard key={o.id} item={o} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

/* ============================= página ============================= */
export default function KanbanAtendimento() {
  const { dateStr, details } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const fetcher = useFetcher();

  // dados em memória (UX otimista)
  const [board, setBoard] = useState<Record<StatusId, Detail[]>>(() => {
    const g: Record<StatusId, Detail[]> = {
      novoPedido: [], emProducao: [], aguardandoForno: [], assando: [], despachada: [],
    };
    for (const d of details as Detail[]) g[d.status]?.push(d);
    return g;
  });

  // rehidrata quando loader muda
  useEffect(() => {
    const g: Record<StatusId, Detail[]> = {
      novoPedido: [], emProducao: [], aguardandoForno: [], assando: [], despachada: [],
    };
    for (const d of details as Detail[]) g[d.status]?.push(d);
    setBoard(g);
  }, [details]);

  // refresh automático
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  // sensores (mouse + touch)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } }),
  );

  // map rápido: id -> coluna
  const idToColumn = useMemo(() => {
    const map = new Map<string, StatusId>();
    (Object.keys(board) as StatusId[]).forEach((col) => {
      board[col].forEach((c) => map.set(c.id, col));
    });
    return map;
  }, [board]);

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : undefined;
    if (!overId) return;

    const from = idToColumn.get(activeId) as StatusId | undefined;
    if (!from) return;

    // alvo pode ser card ou coluna vazia; descobrir coluna destino
    let to: StatusId | undefined = idToColumn.get(overId) as StatusId | undefined;
    if (!to) {
      // se overId não é card conhecido, pode ser id de uma coluna (usamos o próprio 'status' como fallback)
      // aqui mapeamos por header ids, mas como SortableContext usa ids dos cards,
      // quando solta numa coluna vazia 'overId' será o container; vamos testar pelas chaves do board:
      const maybeCol = (Object.keys(board) as StatusId[]).find((c) => c === (e.over?.id as any));
      if (maybeCol) to = maybeCol;
    }
    if (!to) return;

    // índice do card ativo na coluna origem
    const fromIdx = board[from].findIndex((i) => i.id === activeId);
    if (fromIdx < 0) return;

    // se destino for um card da mesma coluna, reordenar visualmente (arrayMove)
    if (from === to) {
      const overIdx = board[to].findIndex((i) => i.id === overId);
      if (overIdx < 0 || overIdx === fromIdx) return;
      setBoard((prev) => ({
        ...prev,
        [to!]: arrayMove(prev[to!], fromIdx, overIdx),
      }));
      // (Somente visual; se quiser persistir a ordem, posso propor um campo próprio)
      return;
    }

    // move entre colunas (muda status) — otimista
    const moved = board[from][fromIdx];
    setBoard((prev) => {
      const next = { ...prev };
      next[from] = next[from].filter((i) => i.id !== activeId);
      next[to!] = [{ ...moved, status: to! }, ...next[to!]];
      return next;
    });

    // persiste novo status
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", activeId);
    fd.set("status", to);
    fetcher.submit(fd, { method: "post" });

    // revalida ao terminar
    const stop = setInterval(() => {
      if (fetcher.state === "idle") {
        clearInterval(stop);
        revalidate();
      }
    }, 200);
  }

  return (
    <div className="space-y-3">
      {/* Toggle Planilha/Kanban */}
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/kds/atendimento/${dateStr}`}>Ver planilha</Link>
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
          {STATUSES.map((s) => {
            const list = board[s.id] || [];
            return (
              <Column key={s.id} status={s.id} items={list}>
                <header className="px-3 py-2 border-b sticky top-0 bg-white rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <Badge variant="secondary" className={`${s.color} border-0`}>
                      {list.length}
                    </Badge>
                  </div>
                </header>
              </Column>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
