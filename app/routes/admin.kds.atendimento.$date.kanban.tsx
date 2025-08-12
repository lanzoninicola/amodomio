import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
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
  useDroppable,
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
type StatusId = "novoPedido" | "emProducao" | "aguardandoForno" | "assando" | "despachada";

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
const STATUS_IDS = STATUSES.map(s => s.id) as StatusId[];
function isStatusId(x: string): x is StatusId { return STATUS_IDS.includes(x as StatusId); }

/* ============================= loader/action ============================= */
export async function loader({ params }: { params: { date: string } }) {
  const dateStr = params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Response("Data inválida", { status: 400 });
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
  if (_action !== "setStatus") return json({ ok: false, error: "Ação inválida" }, { status: 400 });

  const id = String(form.get("id") || "");
  const status = String(form.get("status") || "");
  if (!id || !status || !isStatusId(status)) {
    return json({ ok: false, error: "Parâmetros insuficientes" }, { status: 400 });
  }

  await prisma.kdsDailyOrderDetail.update({ where: { id }, data: { status } });
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

  const hora = fmtHHMM(item.createdAt);
  const dec = fmtElapsed(item.createdAt, Date.now());

  // Cartão simplificado: #, hora, decorrido (destaque)
  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-md border px-3 py-2 bg-white shadow-sm cursor-grab active:cursor-grabbing touch-pan-y flex justify-between items-start hover:bg-blue-400 hover:cursor-pointer"
    >
      <div className="font-semibold">#{item.commandNumber}</div>

      <div className="flex flex-col items-end">
        <div className="flex justify-between gap-x-3">
          <span className="text-[10px] text-gray-500">Hóra Pedido:</span>
          <div className="text-[12px] text-gray-600 font-mono">{hora}</div>
        </div>
        <div className="flex items-center gap-x-3">
          <span className="text-[10px] text-gray-500">Decorrido:</span>
          <div className="text-sm font-semibold font-mono">{dec}</div>
        </div>


      </div>

    </article>
  );
}

function Column({
  status,
  items,
  header,
}: {
  status: StatusId;
  items: Detail[];
  header: React.ReactNode;
}) {
  // Coluna droppable: permite soltar mesmo quando está vazia
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-white min-h-[70vh] ${isOver ? "outline outline-2 outline-blue-400" : ""
        }`}
    >
      {header}
      {/* SortableContext: reorder dentro da coluna */}
      <div className="p-2 space-y-2 overflow-y-auto">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 && (
            <div className="text-xs text-gray-500 px-2 py-6 text-center">Nenhum pedido.</div>
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

  // estado local (UX otimista)
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

  // auto refresh
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  // sensores
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } })
  );

  // mapa rápido: id do card -> coluna
  const idToColumn = useMemo(() => {
    const map = new Map<string, StatusId>();
    (Object.keys(board) as StatusId[]).forEach((col) => {
      board[col].forEach((c) => map.set(c.id, col));
    });
    return map;
  }, [board]);

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overRaw = e.over?.id;
    if (!overRaw) return;

    const from = idToColumn.get(activeId) as StatusId | undefined;
    if (!from) return;

    // destino pode ser um card (id) ou uma coluna (statusId)
    let to: StatusId | undefined;
    const overId = String(overRaw);
    if (isStatusId(overId)) {
      to = overId; // soltou na área da coluna (vazia ou não)
    } else {
      to = idToColumn.get(overId) as StatusId | undefined; // soltou sobre um card
    }
    if (!to) return;

    const fromIdx = board[from].findIndex((i) => i.id === activeId);
    if (fromIdx < 0) return;

    // Se mesma coluna e sobre outro card, apenas reorder visual
    if (from === to) {
      const overIdx = board[to].findIndex((i) => i.id === overId);
      if (overIdx < 0 || overIdx === fromIdx) return;
      setBoard((prev) => ({ ...prev, [to!]: arrayMove(prev[to!], fromIdx, overIdx) }));
      return;
    }

    // Move entre colunas (muda status) — otimista
    const moved = board[from][fromIdx];
    setBoard((prev) => {
      const next = { ...prev };
      next[from] = next[from].filter((i) => i.id !== activeId);
      next[to!] = [{ ...moved, status: to! }, ...next[to!]];
      return next;
    });

    // Persistir novo status
    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", activeId);
    fd.set("status", to);
    fetcher.submit(fd, { method: "post" });

    // Revalidar quando concluir
    const stop = setInterval(() => {
      if (fetcher.state === "idle") {
        clearInterval(stop);
        revalidate();
      }
    }, 200);
  }

  return (
    <div className="space-y-3">
      {/* Toggle (se o layout já tem, pode remover este botão) */}
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
              <Column
                key={s.id}
                status={s.id}
                items={list}
                header={
                  <header className="px-3 py-2 border-b sticky top-0 bg-white rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{s.label}</span>
                      <Badge variant="secondary" className={`${s.color} border-0`}>{list.length}</Badge>
                    </div>
                  </header>
                }
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
