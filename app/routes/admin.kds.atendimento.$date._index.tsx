import { defer, json } from "@remix-run/node";
import {
  Await,
  useLoaderData,
  useFetcher,
  useRevalidator,
  Link,
} from "@remix-run/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash, Pencil, Save, GripVertical } from "lucide-react";

/* DND-KIT */
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* =============================
 * Date utils (timezone-safe)
 * ============================= */
function ymdToDateInt(ymd: string) {
  const [y, m, d] = ymd.split("-");
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return Number(`${y}${mm}${dd}`);
}
function ymdToUtcNoon(ymd: string) {
  const [y, m, d] = ymd.split("-");
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return new Date(`${y}-${mm}-${dd}T12:00:00.000Z`);
}

function todayLocalYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* =============================
 * In-memory lock (unicidade no app)
 * ============================= */
const inFlightLocks = new Set<string>();
function lockKey(dateInt: number, commandNumber: number) {
  return `${dateInt}:${commandNumber}`;
}

/* =============================
 * Tipos
 * ============================= */
type SizeCounts = { F: number; M: number; P: number; I: number };
type DecimalLike = number | string | Prisma.Decimal;

type OrderRow = {
  id?: string;
  date?: string;
  dateInt?: number;
  createdAt?: string | Date;
  commandNumber?: number;

  size?: string;
  hasMoto?: boolean;
  motoValue?: DecimalLike;
  orderAmount?: DecimalLike;

  channel?: string;
  status?: string;

  // NOVO: campo para soft delete
  deletedAt?: string | null;
};

function defaultSizeCounts(): SizeCounts {
  return { F: 0, M: 0, P: 0, I: 0 };
}

/* =============================
 * Loader (compat 7/8 dígitos)
 * ============================= */
export async function loader({ params }: { params: { date?: string } }) {
  const fallbackToday = todayLocalYMD();
  const dateStr = params.date ?? fallbackToday;

  const dateInt8 = ymdToDateInt(dateStr);
  const [y, m, d] = dateStr.split("-");
  const dateInt7 = Number(`${y}${Number(m)}${Number(d)}`); // legacy compat
  const currentDate = ymdToUtcNoon(dateStr);

  const ordersPromise = await prismaClient.kdsDailyOrderDetail.findMany({
    where: { dateInt: { in: [dateInt8, dateInt7] } },
    orderBy: [{ commandNumber: "asc" }, { createdAt: "asc" }],
  });

  return defer({
    orders: ordersPromise,
    currentDate: currentDate.toISOString().split("T")[0],
  });
}

/* =============================
 * Helpers de totals do cabeçalho (IGNORA cancelados)
 * ============================= */
async function recalcHeaderTotal(dateInt: number) {
  const agg = await prismaClient.kdsDailyOrderDetail.aggregate({
    where: { dateInt, deletedAt: null }, // << só ativos
    _sum: { orderAmount: true },
  });
  const total = agg._sum.orderAmount ?? new Prisma.Decimal(0);
  await prismaClient.kdsDailyOrder.update({
    where: { dateInt },
    data: { totOrdersAmount: total },
  });
}

/* =============================
 * Action
 * ============================= */
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { date?: string };
}) {
  const formData = await request.formData();
  const _action = (formData.get("_action") as string) ?? "upsert";

  const fallbackToday = todayLocalYMD();
  const formDate = (formData.get("date") as string) || "";
  const dateStr = formDate || params.date || fallbackToday;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return json({ ok: false, error: "Invalid date." }, { status: 400 });
  }

  const dateInt = ymdToDateInt(dateStr);
  const currentDate = ymdToUtcNoon(dateStr);

  try {
    /* ---------- REORDER (mantém o mesmo conjunto de números dos ATIVOS) ---------- */
    if (_action === "reorder") {
      const idsRaw = (formData.get("ids") as string) ?? "[]";
      let ids: string[] = [];
      try {
        ids = JSON.parse(idsRaw);
      } catch {
        throw new Error("Lista de ids inválida.");
      }
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) {
        throw new Error("Lista de ids inválida.");
      }

      // Busca commandNumbers atuais dos ATIVOS (ids informados)
      const active = await prismaClient.kdsDailyOrderDetail.findMany({
        where: { dateInt, deletedAt: null, id: { in: ids } },
        select: { id: true, commandNumber: true },
        orderBy: { commandNumber: "asc" },
      });
      const numbers = active.map((a) => a.commandNumber!); // preserva lacunas de cancelados

      // Aplica os MESMOS números na nova ordem de ids
      await prismaClient.$transaction(
        ids.map((id, idx) =>
          prismaClient.kdsDailyOrderDetail.update({
            where: { id },
            data: { commandNumber: numbers[idx] ?? numbers[numbers.length - 1] },
          })
        )
      );

      return json({ ok: true, reordered: true });
    }

    /* ---------- CANCELAMENTO LÓGICO ---------- */
    if (_action === "cancel") {
      const commandNumber = Number(formData.get("commandNumber") || 0);
      if (!commandNumber) throw new Error("commandNumber inválido.");

      const existente = await prismaClient.kdsDailyOrderDetail.findFirst({
        where: { dateInt, commandNumber },
        select: { id: true },
      });
      if (!existente) return json({ ok: true, canceled: false });

      await prismaClient.kdsDailyOrderDetail.update({
        where: { id: existente.id },
        data: {
          size: JSON.stringify({ F: 0, M: 0, P: 0, I: 0 }),
          hasMoto: false,
          motoValue: new Prisma.Decimal(0),
          orderAmount: new Prisma.Decimal(0),
          channel: "",
          // requestedForOven: false, // só se o campo existir neste form
          deletedAt: new Date(), // << soft delete
        },
      });

      await recalcHeaderTotal(dateInt);
      return json({ ok: true, canceled: true, id: existente.id });
    }

    /* ---------- UPSERT ---------- */
    const commandNumber = Number(formData.get("commandNumber") || 0);
    if (!commandNumber) throw new Error("commandNumber inválido.");

    const key = lockKey(dateInt, commandNumber);
    if (inFlightLocks.has(key)) {
      return json(
        { ok: false, error: "Outra gravação desta linha está em andamento. Tente novamente." },
        { status: 429 }
      );
    }
    inFlightLocks.add(key);

    try {
      // Garante cabeçalho do dia
      const header = await prismaClient.kdsDailyOrder.upsert({
        where: { dateInt },
        update: {},
        create: { date: currentDate, dateInt, totOrdersAmount: new Prisma.Decimal(0) },
        select: { id: true },
      });

      // Form data
      const hasMoto = formData.get("hasMoto") === "true";
      const channel = (formData.get("channel") as string) || "";
      const status = (formData.get("status") as string) || "novoPedido";

      const sizeCountsRaw = formData.get("size") as string;
      if (!sizeCountsRaw) throw new Error("Tamanhos não informados.");

      let sizeCounts: SizeCounts;
      try {
        sizeCounts = JSON.parse(sizeCountsRaw);
      } catch {
        throw new Error("Formato inválido dos tamanhos.");
      }

      // Money (string -> Decimal com 2 casas)
      const rawMoto = (formData.get("motoValue") as string) ?? "0";
      const rawAmount = (formData.get("orderAmount") as string) ?? "0";
      const motoValueNum = Math.max(0, Number(rawMoto.replace(",", ".") || 0));
      const orderAmountNum = Math.max(0, Number(rawAmount.replace(",", ".") || 0));
      const motoValue = new Prisma.Decimal(motoValueNum.toFixed(2));
      const orderAmount = new Prisma.Decimal(orderAmountNum.toFixed(2));

      // Linha vazia? (bloqueia)
      const total =
        (sizeCounts.F || 0) +
        (sizeCounts.M || 0) +
        (sizeCounts.P || 0) +
        (sizeCounts.I || 0);

      const linhaVazia =
        total === 0 &&
        !hasMoto &&
        !channel &&
        (status === "novoPedido" || !status) &&
        motoValueNum === 0 &&
        orderAmountNum === 0;

      if (linhaVazia) {
        return json(
          { ok: false, error: "Linha vazia — nada para salvar." },
          { status: 400 }
        );
      }

      // Upsert por (dateInt, commandNumber)
      const existente = await prismaClient.kdsDailyOrderDetail.findFirst({
        where: { dateInt, commandNumber },
        select: { id: true, deletedAt: true },
      });

      if (existente) {
        const updated = await prismaClient.kdsDailyOrderDetail.update({
          where: { id: existente.id },
          data: {
            orderId: header.id,
            commandNumber,
            size: JSON.stringify(sizeCounts),
            hasMoto,
            channel,
            status,
            motoValue,
            orderAmount,
            deletedAt: null, // reativa se estava cancelada
          },
        });

        await recalcHeaderTotal(dateInt);
        return json({ ok: true, id: updated.id, mode: "update" });
      }

      const created = await prismaClient.kdsDailyOrderDetail.create({
        data: {
          orderId: header.id,
          dateInt,
          commandNumber,
          size: JSON.stringify(sizeCounts),
          hasMoto,
          motoValue,
          orderAmount,
          channel,
          status,
          deletedAt: null,
        },
      });

      await recalcHeaderTotal(dateInt);
      return json({ ok: true, id: created.id, mode: "create" });
    } finally {
      inFlightLocks.delete(key);
    }
  } catch (err: any) {
    return json(
      { ok: false, error: err?.message ?? "Erro desconhecido ao salvar." },
      { status: 400 }
    );
  }
}

/* =============================
 * Status labels/colors (UI intacta)
 * ============================= */
const statusLabels: Record<string, string> = {
  novoPedido: "Novo Pedido",
  emProducao: "Em Produção",
  aguardandoForno: "Aguardando forno",
  assando: "Assando",
  despachada: "Despachada",
};
const statusColors: Record<string, string> = {
  novoPedido: "bg-gray-200 text-gray-800",
  emProducao: "bg-blue-100 text-blue-800",
  aguardandoForno: "bg-purple-100 text-purple-800",
  assando: "bg-orange-100 text-orange-800",
  despachada: "bg-yellow-100 text-yellow-800",
};
function statusColorClasses(status: string | undefined) {
  return statusColors[status || "novoPedido"] || "bg-gray-200 text-gray-800";
}

/* =============================
 * MoneyInput (cent-based typing) — sem mudar UI
 * ============================= */
function MoneyInput({
  name,
  defaultValue,
  placeholder,
  className = "w-24",
  disabled = false, // << permite desabilitar quando cancelado
}: {
  name: string;
  defaultValue?: DecimalLike;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const initialCents = (() => {
    const n =
      defaultValue == null
        ? 0
        : typeof defaultValue === "number"
          ? defaultValue
          : Number((defaultValue as any)?.toString?.() ?? `${defaultValue}`);
    return Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100));
  })();

  const [cents, setCents] = useState<number>(initialCents);

  useEffect(() => {
    const n =
      defaultValue == null
        ? 0
        : typeof defaultValue === "number"
          ? defaultValue
          : Number((defaultValue as any)?.toString?.() ?? `${defaultValue}`);
    const centsFromProp = Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100));
    setCents(centsFromProp);
  }, [defaultValue]);

  const display = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return; // << não edita se cancelado
    const k = e.key;
    if (k === "Enter") return; // deixa o Enter passar para o form
    if (k === "Backspace") {
      e.preventDefault();
      setCents((c) => Math.floor(c / 10));
      return;
    }
    if (k === "Delete") {
      e.preventDefault();
      setCents(0);
      return;
    }
    if (/^\d$/.test(k)) {
      e.preventDefault();
      const d = Number(k);
      setCents((c) => (c * 10 + d) % 1000000000);
      return;
    }
    if (k === "Tab" || k === "ArrowLeft" || k === "ArrowRight" || k === "Home" || k === "End") {
      return;
    }
    e.preventDefault();
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onKeyDown={handleKeyDown}
        onChange={() => { }}
        disabled={disabled}          // << desabilita visualmente
        aria-disabled={disabled}
        className={`${className} h-9 border rounded px-2 py-1 text-right ${disabled ? "bg-gray-50 text-gray-400" : ""
          }`}
        placeholder={placeholder}
      />
      <input type="hidden" name={name} value={(cents / 100).toFixed(2)} />
    </div>
  );
}

/* =============================
 * Helpers de hora/decorrido (inalterados)
 * ============================= */
function fmtHHMM(dateLike: string | Date | undefined) {
  if (!dateLike) return "--:--";
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtElapsedHHMM(from: string | Date | undefined, nowMs: number) {
  if (!from) return "--:--";
  const d = new Date(from);
  const diff = nowMs - d.getTime();
  if (!isFinite(diff) || diff < 0) return "--:--";
  const totalMin = Math.floor(diff / 60000);
  const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const mm = (totalMin % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/* =============================
 * Grid template (UI preservada)
 * ============================= */
const GRID_TMPL =
  "grid grid-cols-[48px,60px,60px,150px,120px,220px,85px,85px,85px,100px,120px] gap-2 items-center gap-x-4";
const HEADER_TMPL =
  "grid grid-cols-[48px,60px,60px,150px,120px,220px,85px,85px,85px,100px,120px] gap-2 gap-x-4 border-b font-semibold text-sm sticky top-0  z-10";

/* =============================
 * SizeSelector (UI INALTERADA)
 * ============================= */
function SizeSelector({
  counts,
  onChange,
  disabled,
}: {
  counts: SizeCounts;
  onChange: (newCounts: SizeCounts) => void;
  disabled?: boolean; // << adicionamos apenas para travar quando cancelado
}) {
  function increment(size: keyof SizeCounts) {
    if (disabled) return;
    onChange({ ...counts, [size]: counts[size] + 1 });
  }
  function reset() {
    if (disabled) return;
    onChange(defaultSizeCounts());
  }

  return (
    <div className="flex items-center gap-2">
      {(["F", "M", "P", "I"] as (keyof SizeCounts)[]).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => increment(size)}
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${counts[size] > 0 ? "bg-primary text-white" : "bg-white"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={`Adicionar ${size}`}
          disabled={disabled}
        >
          {size}
          {counts[size] > 0 && <span className="ml-1">{counts[size]}</span>}
        </button>
      ))}
      <Badge
        variant="secondary"
        className={`ml-1 cursor-pointer ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={reset}
      >
        Zerar
      </Badge>
    </div>
  );
}

/* =============================
 * Sortable Row wrapper (somente para ATIVOS)
 * ============================= */
function SortableRow({
  order,
  index,
  canais,
  dateStr,
  nowMs,
}: {
  order: OrderRow;
  index: number;
  canais: string[];
  dateStr: string;
  nowMs: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <RowItem
      order={order}
      index={index}
      canais={canais}
      dateStr={dateStr}
      nowMs={nowMs}
      sortable={{ attributes, listeners, setNodeRef, style, isDragging }}
    />
  );
}

/* =============================
 * RowItem (fetcher + feedback + cancelamento lógico)
 * ============================= */
function RowItem({
  order,
  index,
  canais,
  dateStr,
  nowMs,
  sortable,
}: {
  order: OrderRow | null;
  index: number;
  canais: string[];
  dateStr: string;
  nowMs: number;
  sortable?: {
    attributes: any;
    listeners: any;
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    isDragging: boolean;
  };
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string; id?: string }>();
  const { revalidate } = useRevalidator();

  const [counts, setCounts] = useState<SizeCounts>(() => {
    if (order?.size) {
      try {
        const parsed = JSON.parse(order.size);
        return { ...defaultSizeCounts(), ...parsed };
      } catch {
        return defaultSizeCounts();
      }
    }
    return defaultSizeCounts();
  });

  useEffect(() => {
    if (order?.size) {
      try {
        const parsed = JSON.parse(order.size as any);
        setCounts({ ...defaultSizeCounts(), ...parsed });
      } catch {
        setCounts(defaultSizeCounts());
      }
    } else {
      setCounts(defaultSizeCounts());
    }
  }, [order?.id]);

  const [rowId, setRowId] = useState<string | null>(order?.id ?? null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<boolean | null>(null);

  const currentStatus = order?.status || "novoPedido";
  const isCanceled = !!order?.deletedAt;

  useEffect(() => {
    if (fetcher.state === "submitting") {
      setErrorText(null);
      setLastOk(null);
    }
  }, [fetcher.state]);

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.ok) {
        setLastOk(true);
        setErrorText(null);
        if (fetcher.data.id) setRowId(fetcher.data.id);
        setEditingStatus(false);
        revalidate();
        const t = setTimeout(() => setLastOk(null), 1500);
        return () => clearTimeout(t);
      } else {
        setLastOk(false);
        setErrorText(fetcher.data.error ?? "Erro ao salvar.");
      }
    }
  }, [fetcher.data, revalidate]);

  // Círculo: feedback > cor do status
  const circleClass = useMemo(() => {
    if (fetcher.state === "submitting") return "bg-gray-200";
    if (lastOk === true) return "bg-green-500 text-white";
    if (lastOk === false) return "bg-red-500 text-white";
    return statusColorClasses(currentStatus);
  }, [fetcher.state, lastOk, currentStatus]);

  const horaStr = fmtHHMM(order?.createdAt);
  const decorridoStr = fmtElapsedHHMM(order?.createdAt, nowMs);

  return (
    <li
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={isCanceled ? "opacity-50" : sortable?.isDragging ? "opacity-60" : undefined}
    >
      {/* grid: # | Hora | Decorrido | Status | Pedido (R$) | Tamanho | Moto | Moto (R$) | Canal (×2) | Ações */}
      <fetcher.Form method="post" className={`${GRID_TMPL} py-2`}>
        {/* # + grip handle */}
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            {...(rowId && !isCanceled ? (sortable?.listeners || {}) : {})}
            {...(rowId && !isCanceled ? (sortable?.attributes || {}) : {})}
            className={
              "text-gray-600 " +
              (rowId && !isCanceled ? "cursor-grab active:cursor-grabbing" : "opacity-30 cursor-not-allowed")
            }
            title={rowId && !isCanceled ? "Arraste para reordenar" : "Linha bloqueada"}
            disabled={isCanceled}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div
            className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${circleClass}`}
            title={
              fetcher.state === "submitting"
                ? "Salvando…"
                : lastOk === true
                  ? "Salvo!"
                  : lastOk === false
                    ? "Erro ao salvar"
                    : `Comanda ${order?.commandNumber ?? index + 1}`
            }
          >
            {order?.commandNumber ?? index + 1}
          </div>
        </div>

        {/* Hora / Decorrido */}
        <div className="text-center text-sm text-gray-800 font-mono">{horaStr}</div>
        <div className="text-center text-sm text-gray-800 font-mono">{decorridoStr}</div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2">
          {editingStatus ? (
            <Select name="status" defaultValue={currentStatus} disabled={isCanceled}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novoPedido">(1) Novo Pedido</SelectItem>
                <SelectItem value="emProducao">(2) Em Produção</SelectItem>
                <SelectItem value="aguardandoForno">(3) Aguardando forno</SelectItem>
                <SelectItem value="assando">(4) Assando</SelectItem>
                <SelectItem value="despachada">(5) Despachada</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className={`px-2 py-1 text-xs rounded-md ${statusColorClasses(currentStatus)}`}>
              {statusLabels[currentStatus] || currentStatus}
            </div>
          )}
          <button
            type="button"
            onClick={() => !isCanceled && setEditingStatus((v) => !v)}
            className={"text-gray-500 hover:text-gray-700 " + (isCanceled ? "opacity-30 cursor-not-allowed" : "")}
            title={isCanceled ? "Linha cancelada" : "Editar status"}
            disabled={isCanceled}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {/* Pedido (R$) */}
        <div className="flex items-center justify-center">
          <MoneyInput
            name="orderAmount"
            defaultValue={order?.orderAmount}
            placeholder="Pedido (R$)"
            className="w-24"
            disabled={isCanceled}
          />
        </div>

        {/* Hidden */}
        {rowId && <input type="hidden" name="id" value={rowId} />}
        <input type="hidden" name="size" value={JSON.stringify(counts)} />
        <input type="hidden" name="commandNumber" value={order?.commandNumber ?? index + 1} />
        <input type="hidden" name="date" value={dateStr} />
        <input type="hidden" name="status" value={currentStatus} />

        {/* Tamanhos (UI intacta; apenas travamos se cancelado) */}
        <div>
          <SizeSelector counts={counts} onChange={setCounts} disabled={isCanceled} />
        </div>

        {/* Moto (boolean) */}
        <div className="flex items-center justify-center">
          <Select name="hasMoto" defaultValue={order?.hasMoto ? "true" : "false"} disabled={isCanceled}>
            <SelectTrigger className="w-24 h-9 text-xs">
              <SelectValue placeholder="Moto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Moto (R$) */}
        <div className="flex items-center justify-center">
          <MoneyInput
            name="motoValue"
            defaultValue={order?.motoValue}
            placeholder="Moto (R$)"
            className="w-28"
            disabled={isCanceled}
          />
        </div>

        {/* Canal (span 2) */}
        <div className="flex items-center justify-center col-span-2">
          <Select name="channel" defaultValue={order?.channel ?? ""} disabled={isCanceled}>
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              {["WHATS/PRESENCIAL/TELE", "MOGO", "AIQFOME", "IFOOD"].map((canal) => (
                <SelectItem key={canal} value={canal}>
                  {canal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ações */}
        <div className="flex justify-center gap-2">
          <Button
            type="submit"
            name="_action"
            value="upsert"
            variant={"outline"}
            disabled={isCanceled || fetcher.state === "submitting"}
            title={isCanceled ? "Linha cancelada" : "Salvar"}
          >
            <Save className="w-4 h-4" />
          </Button>

          {rowId && (
            <Button
              type="submit"
              name="_action"
              value="cancel" /* << ERA delete */
              variant={"ghost"}
              disabled={isCanceled || fetcher.state === "submitting"}
              title="Cancelar (lógico)"
              className="hover:bg-red-50"
            >
              <Trash className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>

        {/* Erro (11 cols) */}
        {errorText && (
          <div className="col-span-11 text-red-600 text-xs mt-1">{errorText}</div>
        )}
      </fetcher.Form>
    </li>
  );
}

/* =============================
 * Página (DnD, Totais, Refresh)
 * ============================= */
export default function KdsAtendimentoPlanilha() {
  const data = useLoaderData<typeof loader>();

  // Atualiza "agora" a cada 30s para recalcular o decorrido
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const { revalidate } = useRevalidator();
  // Recarrega os dados (loader) a cada 5 minutos
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  // ENTER submete o form focado (evita inputs de texto)
  useHotkeys("enter", (e) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    e.preventDefault();
    const form = target?.closest("form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  });

  const canais = useMemo(
    () => ["WHATS/PRESENCIAL/TELE", "MOGO", "AIQFOME", "IFOOD"],
    []
  );

  const [orderList, setOrderList] = useState<OrderRow[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const reorderFetcher = useFetcher();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderList((prev) => {
      // Só reordena entre ATIVOS
      const activeOnly = prev.filter((o) => !o.deletedAt);
      const oldIndex = activeOnly.findIndex((o) => o.id === active.id);
      const newIndex = activeOnly.findIndex((o) => o.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;

      const nextActive = arrayMove(activeOnly, oldIndex, newIndex);
      const ids = nextActive.map((o) => o.id);

      // servidor preserva o conjunto de commandNumber dos ATIVOS
      reorderFetcher.submit(
        { _action: "reorder", date: data.currentDate, ids: JSON.stringify(ids) },
        { method: "post" }
      );

      // Reflete visual (apenas rearranja os ativos, cancelados ficam no lugar)
      const next = [...prev];
      let k = 0;
      for (let i = 0; i < next.length; i++) {
        if (!next[i].deletedAt) next[i] = nextActive[k++];
      }
      return next;
    });
  }

  return (
    <Suspense fallback={<div>Carregando pedidos...</div>}>
      <Await resolve={data.orders}>
        {(orders) => {
          const safeOrders = Array.isArray(orders) ? (orders as OrderRow[]) : [];

          // Totais só com ATIVOS
          const activeOrders = safeOrders.filter((o) => !o?.deletedAt);
          const toNum = (v: any) => Number((v as any)?.toString?.() ?? v ?? 0) || 0;
          const totalPedido = activeOrders.reduce((s, o) => s + toNum(o?.orderAmount), 0);
          const totalMoto = activeOrders.reduce((s, o) => s + toNum(o?.motoValue), 0);
          const sizeTotals = activeOrders.reduce(
            (acc, o) => {
              try {
                const s = o?.size ? JSON.parse(o.size as any) : {};
                acc.F += Number(s.F || 0);
                acc.M += Number(s.M || 0);
                acc.P += Number(s.P || 0);
                acc.I += Number(s.I || 0);
              } catch { } // ignora JSON malformado
              return acc;
            },
            { F: 0, M: 0, P: 0, I: 0 }
          );

          // sincroniza estado local quando o loader muda
          useEffect(() => {
            setOrderList(safeOrders.filter((o) => !!o?.id));
          }, [safeOrders]);

          // ids arrastáveis = apenas ativos
          const activeIds = orderList.filter((o) => !o.deletedAt).map((o) => o.id!) as string[];

          // fillers
          const fillerCount = Math.max(0, 50 - orderList.length);
          const fillers = Array(fillerCount).fill(null);

          return (
            <div className="space-y-6">
              {/* Totais (IGNORAM cancelados) */}
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <div className="flex  items-center gap-x-3 px-3 py-2 rounded-lg border">
                  <span className="text-xs text-gray-500">Numero Pedidos</span>
                  <div className="text-base font-semibold font-mono">
                    {activeOrders.length}
                  </div>
                </div>
                <div className="flex  items-center gap-x-3 px-3 py-2 rounded-lg border">
                  <span className="text-xs text-gray-500">Faturamento dia (R$)</span>
                  <div className="text-base font-semibold font-mono">
                    {totalPedido.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div className="flex  items-center gap-x-3  px-3 py-2 rounded-lg border ">
                  <span className="text-xs text-gray-500">Total Moto (R$)</span>
                  <div className="text-base font-semibold font-mono">
                    {totalMoto.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-x-3 px-3 py-2 rounded-lg border">
                  <span className="text-xs text-gray-500">Total Tamanhos</span>
                  <div className="text-sm font-mono">
                    F: <span className="font-semibold">{sizeTotals.F}</span>{" "}
                    M: <span className="font-semibold">{sizeTotals.M}</span>{" "}
                    P: <span className="font-semibold">{sizeTotals.P}</span>{" "}
                    I: <span className="font-semibold">{sizeTotals.I}</span>
                  </div>
                </div>

              </div>

              {/* Cabeçalho */}
              <div className={`${HEADER_TMPL}`}>
                <div className="text-center">#</div>
                <div className="text-center">Hora</div>
                <div className="text-center">Decorrido</div>
                <div className="text-center">Status</div>
                <div className="text-center">Pedido (R$)</div>
                <div className="text-center">Tamanho</div>
                <div className="text-center">Moto</div>
                <div className="text-center">Moto (R$)</div>
                <div className="text-center col-span-2">Canal</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Lista: ATIVOS (sortable) + CANCELADOS (não-sortable, opacos) */}
              <ul>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={activeIds} strategy={verticalListSortingStrategy}>
                    {orderList.map((order, index) =>
                      order.deletedAt ? (
                        <RowItem
                          key={order.id}
                          order={order}
                          index={index}
                          canais={["WHATS/PRESENCIAL/TELE", "MOGO", "AIQFOME", "IFOOD"]}
                          dateStr={data.currentDate}
                          nowMs={nowMs}
                        />
                      ) : (
                        <SortableRow
                          key={order.id}
                          order={order}
                          index={index}
                          canais={["WHATS/PRESENCIAL/TELE", "MOGO", "AIQFOME", "IFOOD"]}
                          dateStr={data.currentDate}
                          nowMs={nowMs}
                        />
                      )
                    )}
                  </SortableContext>
                </DndContext>

                {/* Linhas vazias (não arrastáveis) */}
                {fillers.map((_, i) => (
                  <RowItem
                    key={`row-empty-${i}-${safeOrders.length}`}
                    order={null}
                    index={orderList.length + i}
                    canais={["WHATS/PRESENCIAL/TELE", "MOGO", "AIQFOME", "IFOOD"]}
                    dateStr={data.currentDate}
                    nowMs={nowMs}
                  />
                ))}
              </ul>
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
