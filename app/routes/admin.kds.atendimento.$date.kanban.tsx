import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import prisma from "~/lib/prisma/client.server";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bike, Flame, Store, Truck } from "lucide-react";

/* dnd-kit core + sortable */
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "~/lib/utils";

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
  takeAway: boolean
  channel: string | null;
  requestedForOven: boolean; // << novo campo
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
      takeAway: true,
      requestedForOven: true, // << carregar o flag
    },
  });

  return json({ dateStr, dateInt, details });
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const _action = String(form.get("_action") || "");

  // mudar status (já existia)
  if (_action === "setStatus") {
    const id = String(form.get("id") || "");
    const status = String(form.get("status") || "");
    if (!id || !status || !isStatusId(status)) {
      return json({ ok: false, error: "Parâmetros insuficientes" }, { status: 400 });
    }

    // Lê status anterior para decidir deliveredAt
    const prev = await prisma.kdsDailyOrderDetail.findUnique({
      where: { id },
      select: { status: true, deliveredAt: true },
    });

    let deliveredAtUpdate: Date | null | undefined = undefined;
    if (status === "despachada" && prev?.status !== "despachada") {
      deliveredAtUpdate = new Date(); // entrou em despachada
    } else if (status !== "despachada" && prev?.status === "despachada") {
      deliveredAtUpdate = null; // saiu de despachada
    }

    await prisma.kdsDailyOrderDetail.update({
      where: { id },
      data: {
        status,
        ...(deliveredAtUpdate !== undefined ? { deliveredAt: deliveredAtUpdate } : {}),
      },
    });

    return json({ ok: true, id, status });
  }

  // novo: toggle pedido para assar
  if (_action === "toggleOven") {
    const id = String(form.get("id") || "");
    const valueStr = String(form.get("value") || "");
    if (!id || (valueStr !== "true" && valueStr !== "false")) {
      return json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }
    const value = valueStr === "true";
    await prisma.kdsDailyOrderDetail.update({
      where: { id },
      data: { requestedForOven: value },
    });
    return json({ ok: true, id, requestedForOven: value });
  }

  return json({ ok: false, error: "Ação inválida" }, { status: 400 });
}

/* ============================= componentes ============================= */
function SortableCard({
  item,
  onToggleOven,
}: {
  item: Detail;
  onToggleOven: (id: string, next: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const hora = fmtHHMM(item.createdAt);
  const dec = fmtElapsed(item.createdAt, Date.now());

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-md border px-3 py-2 bg-white shadow-sm cursor-grab active:cursor-grabbing touch-pan-y
      flex flex-col"
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex gap-1 items-center">

          <div className="font-semibold text-lg">#{item.commandNumber}</div>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-600 w-5 h-5">
            {item.takeAway ? <Bike size={13} /> : <Store size={13} />}
          </span>{/* {item.takeAway ? <Store size={14} /> : <Bike size={14} />} */}
        </div>
        <div className="flex flex-col items-end">
          <div className="flex justify-between gap-x-3">
            <span className="text-[10px] text-gray-500">Hora Pedido:</span>
            <div className="text-[12px] text-gray-600 font-mono">{hora}</div>
          </div>
          <div className="flex items-center gap-x-3">
            <span className="text-[10px] text-gray-500">Decorrido:</span>
            <div className="text-sm font-semibold font-mono">{dec}</div>
          </div>
        </div>
      </div>

      {/* Botão ghost — toggle "pedido para assar" */}
      {
        item.status === "aguardandoForno" && (
          <Button
            type="button"
            variant="outline"
            title={item.requestedForOven ? "Pedido para assar (ativo)" : "Marcar pedido para assar"}
            onMouseDown={(e) => e.stopPropagation()} // evita iniciar drag
            onClick={(e) => {
              e.stopPropagation();
              onToggleOven(item.id, !item.requestedForOven);
            }}
            className={
              cn(
                "mt-2 p-2 self-end",
                item.requestedForOven && "bg-red-500"
              )
            }
          >
            <Flame className={`w-4 h-4 ${item.requestedForOven ? "text-white" : "text-gray-900"}`} />
          </Button>
        )
      }
    </article>
  );
}

function CardPreview({ item }: { item: Detail }) {
  const hora = fmtHHMM(item.createdAt);
  const dec = fmtElapsed(item.createdAt, Date.now());
  return (
    <div className="rounded-md border px-3 py-2 bg-white shadow-lg">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">#{item.commandNumber}</div>
        <div className="text-[11px] text-gray-600 font-mono">{hora}</div>
      </div>
      <div className="text-sm font-semibold font-mono">{dec}</div>
    </div>
  );
}

function Column({
  status,
  items,
  header,
  onToggleOven,
}: {
  status: StatusId;
  items: Detail[];
  header: React.ReactNode;
  onToggleOven: (id: string, next: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-white h-[calc(100vh-180px)] ${isOver ? "outline outline-2 outline-blue-400" : ""
        }`}
    >
      {header}
      <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-0">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 && (
            <div className="text-xs text-gray-500 px-2 py-6 text-center">Nenhum pedido.</div>
          )}
          {items.map((o) => (
            <SortableCard key={o.id} item={o} onToggleOven={onToggleOven} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

/* ============================= página ============================= */
export default function KanbanAtendimento() {
  const { details } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const fetcher = useFetcher();

  const [board, setBoard] = useState<Record<StatusId, Detail[]>>(() => {
    const g: Record<StatusId, Detail[]> = {
      novoPedido: [], emProducao: [], aguardandoForno: [], assando: [], despachada: [],
    };
    for (const d of details as Detail[]) g[d.status]?.push(d);
    return g;
  });

  useEffect(() => {
    const g: Record<StatusId, Detail[]> = {
      novoPedido: [], emProducao: [], aguardandoForno: [], assando: [], despachada: [],
    };
    for (const d of details as Detail[]) g[d.status]?.push(d);
    setBoard(g);
  }, [details]);

  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } })
  );

  const idToColumn = useMemo(() => {
    const map = new Map<string, StatusId>();
    (Object.keys(board) as StatusId[]).forEach((col) => {
      board[col].forEach((c) => map.set(c.id, col));
    });
    return map;
  }, [board]);

  const [active, setActive] = useState<Detail | null>(null);

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    let found: Detail | null = null;
    (Object.keys(board) as StatusId[]).some((col) => {
      const it = board[col].find((d) => d.id === id);
      if (it) { found = it; return true; }
      return false;
    });
    setActive(found);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);

    const activeId = String(e.active.id);
    const overRaw = e.over?.id;
    if (!overRaw) return;

    const from = idToColumn.get(activeId) as StatusId | undefined;
    if (!from) return;

    let to: StatusId | undefined;
    const overId = String(overRaw);
    if (isStatusId(overId)) {
      to = overId; // soltou na área da coluna
    } else {
      to = idToColumn.get(overId) as StatusId | undefined; // soltou sobre um card
    }
    if (!to) return;

    const fromIdx = board[from].findIndex((i) => i.id === activeId);
    if (fromIdx < 0) return;

    if (from === to) {
      const overIdx = board[to].findIndex((i) => i.id === overId);
      if (overIdx < 0 || overIdx === fromIdx) return;
      setBoard((prev) => ({ ...prev, [to!]: arrayMove(prev[to!], fromIdx, overIdx) }));
      return;
    }

    const moved = board[from][fromIdx];
    setBoard((prev) => {
      const next = { ...prev };
      next[from] = next[from].filter((i) => i.id !== activeId);
      next[to!] = [{ ...moved, status: to! }, ...next[to!]];
      return next;
    });

    const fd = new FormData();
    fd.set("_action", "setStatus");
    fd.set("id", activeId);
    fd.set("status", to);
    fetcher.submit(fd, { method: "post" });

    const stop = setInterval(() => {
      if (fetcher.state === "idle") {
        clearInterval(stop);
        revalidate();
      }
    }, 200);
  }

  // Toggle do “pedido para assar” (UX otimista)
  function toggleOven(id: string, next: boolean) {
    const col = idToColumn.get(id);
    if (!col) return;

    setBoard((prev) => {
      const nextBoard = { ...prev };
      nextBoard[col] = nextBoard[col].map((it) =>
        it.id === id ? { ...it, requestedForOven: next } : it
      );
      return nextBoard;
    });

    const fd = new FormData();
    fd.set("_action", "toggleOven");
    fd.set("id", id);
    fd.set("value", String(next));
    fetcher.submit(fd, { method: "post" });

    const stop = setInterval(() => {
      if (fetcher.state === "idle") {
        clearInterval(stop);
        revalidate();
      }
    }, 200);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      collisionDetection={closestCorners}
      autoScroll
    >
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
        {STATUSES.map((s) => {
          const list = board[s.id] || [];
          return (
            <Column
              key={s.id}
              status={s.id}
              items={list}
              onToggleOven={toggleOven}
              header={
                <header className="px-3 py-2 border-b sticky top-0 bg-white rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <Badge variant="secondary" className={`${s.color} border-0`}>
                      {list.length}
                    </Badge>
                  </div>
                </header>
              }
            />
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 180 }}>
        {active ? <CardPreview item={active} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
