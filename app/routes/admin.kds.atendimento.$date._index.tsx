import { defer, json, MetaFunction } from "@remix-run/node";
import {
  Await,
  useLoaderData,
  useFetcher,
  useRevalidator,
} from "@remix-run/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Trash,
  Save,
  GripVertical,
  MoreHorizontal,
  Loader2,
  PlusCircle,
  ChevronDown,
  Receipt,
} from "lucide-react";

/* Dialogs */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/* Dropdown & Popover (shadcn) */

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";

export const meta: MetaFunction = () => {
  return [
    { title: "KDS | Planilha" },
  ];
};

/* =============================
 * Date utils
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
 * Tipos
 * ============================= */
type SizeCounts = { F: number; M: number; P: number; I: number; FT: number };
type DecimalLike = number | string | Prisma.Decimal;

type OrderRow = {
  id: string;
  dateInt: number;
  createdAt?: string | Date | null;
  commandNumber: number | null;
  sortOrderIndex: number;
  isVendaLivre: boolean;

  size?: string | null;
  hasMoto?: boolean | null;
  motoValue?: DecimalLike | null;
  take_away?: boolean | null;
  orderAmount?: DecimalLike | null;

  channel?: string | null;
  status?: string | null;
};

function defaultSizeCounts(): SizeCounts {
  return { F: 0, M: 0, P: 0, I: 0, FT: 0 };
}

/* =============================
 * Helpers header/seed
 * ============================= */
async function ensureHeader(dateInt: number, currentDate: Date) {
  return prismaClient.kdsDailyOrder.upsert({
    where: { dateInt },
    update: {},
    create: { date: currentDate, dateInt, totOrdersAmount: new Prisma.Decimal(0) },
    select: { id: true },
  });
}
async function recalcHeaderTotal(dateInt: number) {
  const agg = await prismaClient.kdsDailyOrderDetail.aggregate({
    where: { dateInt },
    _sum: { orderAmount: true },
  });
  const total = agg._sum.orderAmount ?? new Prisma.Decimal(0);
  await prismaClient.kdsDailyOrder.update({
    where: { dateInt },
    data: { totOrdersAmount: total },
  });
}
async function getMaxes(dateInt: number) {
  // ✅ sem SQL raw: evita 42P01
  const agg = await prismaClient.kdsDailyOrderDetail.aggregate({
    where: { dateInt },
    _max: { commandNumber: true, sortOrderIndex: true },
  });
  return {
    maxCmd: agg._max.commandNumber ?? 0,
    maxSort: agg._max.sortOrderIndex ?? 0,
  };
}

/* =============================
 * Loader
 * ============================= */
export async function loader({ params }: { params: { date?: string } }) {
  const fallbackToday = todayLocalYMD();
  const dateStr = params.date ?? fallbackToday;

  const dateInt8 = ymdToDateInt(dateStr);
  const [y, m, d] = dateStr.split("-");
  const dateInt7 = Number(`${y}${Number(m)}${Number(d)}`); // compat legado
  const currentDate = ymdToUtcNoon(dateStr);

  const ordersPromise = await prismaClient.kdsDailyOrderDetail.findMany({
    where: { dateInt: { in: [dateInt8, dateInt7] } },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });

  return defer({
    orders: ordersPromise,
    currentDate: currentDate.toISOString().split("T")[0],
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
  const rowId = (formData.get("id") as string) || null;

  const fallbackToday = todayLocalYMD();
  const formDate = (formData.get("date") as string) || "";
  const dateStr = formDate || params.date || fallbackToday;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return json({ ok: false, error: "Data inválida." }, { status: 400 });
  }
  const dateInt = ymdToDateInt(dateStr);
  const currentDate = ymdToUtcNoon(dateStr);

  try {
    /* ---------- REORDER: só mexe no sortOrderIndex ---------- */
    if (_action === "reorder") {
      const idsRaw = (formData.get("ids") as string) ?? "[]";
      let ids: string[] = [];
      try { ids = JSON.parse(idsRaw); } catch { throw new Error("Lista de ids inválida."); }
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) {
        throw new Error("Lista de ids inválida.");
      }
      const STEP = 1000;
      await prismaClient.$transaction(
        ids.map((id, idx) =>
          prismaClient.kdsDailyOrderDetail.update({
            where: { id },
            data: { sortOrderIndex: (idx + 1) * STEP },
          })
        )
      );
      return json({ ok: true, reordered: true });
    }

    /* ---------- ABRIR DIA: cria 40 registros numerados 1..40 ---------- */
    if (_action === "openDay") {
      const header = await ensureHeader(dateInt, currentDate);
      const existing = await prismaClient.kdsDailyOrderDetail.count({ where: { dateInt } });
      if (existing > 0) {
        return json({ ok: false, error: "Dia já possui registros." }, { status: 400 });
      }
      const STEP = 1000;
      const rows = Array.from({ length: 40 }).map((_, i) => ({
        orderId: header.id,
        dateInt,
        commandNumber: i + 1,
        isVendaLivre: false,
        sortOrderIndex: (i + 1) * STEP,
        size: JSON.stringify({ F: 0, M: 0, P: 0, I: 0, FT: 0 }),
        hasMoto: false,
        motoValue: new Prisma.Decimal(0),
        takeAway: false,
        orderAmount: new Prisma.Decimal(0),
        channel: "",
        status: "novoPedido",
        deliveredAt: null,
      }));
      await prismaClient.kdsDailyOrderDetail.createMany({ data: rows });
      return json({ ok: true, seeded: 40 });
    }

    /* ---------- ADICIONAR MAIS X ---------- */
    if (_action === "addSlots") {
      const qty = Math.max(1, Number(formData.get("qty") || 10));
      const header = await ensureHeader(dateInt, currentDate);
      const { maxCmd, maxSort } = await getMaxes(dateInt);
      const STEP = 1000;
      const rows = Array.from({ length: qty }).map((_, i) => ({
        orderId: header.id,
        dateInt,
        commandNumber: (maxCmd || 0) + i + 1, // se preferir slots sem número: use null
        isVendaLivre: false,
        sortOrderIndex: (maxSort || 0) + (i + 1) * STEP,
        size: JSON.stringify({ F: 0, M: 0, P: 0, I: 0, FT: 0 }),
        hasMoto: false,
        motoValue: new Prisma.Decimal(0),
        takeAway: false,
        orderAmount: new Prisma.Decimal(0),
        channel: "",
        status: "novoPedido",
        deliveredAt: null,
      }));
      await prismaClient.kdsDailyOrderDetail.createMany({ data: rows });
      return json({ ok: true, added: qty });
    }

    /* ---------- CRIAR VENDA LIVRE (linha rápida) ---------- */
    if (_action === "createVendaLivre") {
      const header = await ensureHeader(dateInt, currentDate);
      const { maxSort } = await getMaxes(dateInt);
      const rawAmount = (formData.get("orderAmount") as string) ?? "0";
      const orderAmountNum = Math.max(0, Number(rawAmount.replace(",", ".") || 0));
      const orderAmount = new Prisma.Decimal(orderAmountNum.toFixed(2));
      const status = ((formData.get("status") as string) || "pendente") as string;
      const STEP = 1000;

      const created = await prismaClient.kdsDailyOrderDetail.create({
        data: {
          orderId: header.id,
          dateInt,
          commandNumber: null,
          isVendaLivre: true,
          sortOrderIndex: (maxSort || 0) + STEP,
          size: JSON.stringify({ F: 0, M: 0, P: 0, I: 0, FT: 0 }),
          hasMoto: false,
          motoValue: new Prisma.Decimal(0),
          takeAway: false,
          orderAmount,
          channel: "",
          status, // pendente por padrão
          deliveredAt: null,
        },
        select: { id: true },
      });
      await recalcHeaderTotal(dateInt);
      return json({ ok: true, id: created.id, mode: "createVendaLivre" });
    }

    /* ---------- CANCELAMENTO (DELETE físico) ---------- */
    if (_action === "cancel") {
      const idFromForm = (formData.get("id") as string) || null;
      if (!idFromForm) throw new Error("id inválido.");
      await prismaClient.kdsDailyOrderDetail.delete({ where: { id: idFromForm } });
      await recalcHeaderTotal(dateInt);
      return json({ ok: true, canceled: true, id: idFromForm });
    }

    /* ---------- UPSERT (salvar/atualizar) ---------- */
    const rawCmd = (formData.get("commandNumber") as string) ?? "";
    const channel = (formData.get("channel") as string) || "";
    const status = (formData.get("status") as string) || "novoPedido";
    const hasMoto = (formData.get("hasMoto") as string) === "true";
    const takeAway = (formData.get("take_away") as string) === "true";

    const sizeCountsRaw = (formData.get("size") as string) || "";
    if (!sizeCountsRaw) {
      return json({ ok: false, error: "Tamanhos não informados." }, { status: 400 });
    }

    let sizeCounts: SizeCounts;
    try {
      sizeCounts = JSON.parse(sizeCountsRaw);
    } catch {
      return json({ ok: false, error: "Formato inválido dos tamanhos." }, { status: 400 });
    }

    const rawMoto = (formData.get("motoValue") as string) ?? "0";
    const rawAmount = (formData.get("orderAmount") as string) ?? "0";
    const motoValueNum = Math.max(0, Number(rawMoto.replace(",", ".") || 0));
    const orderAmountNum = Math.max(0, Number(rawAmount.replace(",", ".") || 0));
    const motoValue = new Prisma.Decimal(motoValueNum.toFixed(2));
    const orderAmount = new Prisma.Decimal(orderAmountNum.toFixed(2));

    let commandNumber: number | null = null;
    if (rawCmd.trim() !== "") {
      const n = Number(rawCmd);
      commandNumber = Number.isFinite(n) && n > 0 ? n : null;
    }
    const isVendaLivre = commandNumber == null;

    // Linha vazia? bloqueia save inútil
    const totalSizes = (sizeCounts.F || 0) + (sizeCounts.M || 0) + (sizeCounts.P || 0) + (sizeCounts.I || 0) + (sizeCounts.FT || 0);
    const linhaVazia =
      totalSizes === 0 &&
      !hasMoto &&
      !channel &&
      (status === "novoPedido" || !status) &&
      motoValueNum === 0 &&
      orderAmountNum === 0 &&
      isVendaLivre;
    if (linhaVazia && rowId) {
      return json({ ok: true, id: rowId, mode: "noop" });
    } else if (linhaVazia && !rowId) {
      return json({ ok: false, error: "Linha vazia — nada para salvar." }, { status: 400 });
    }

    // duplicidade só quando há número
    if (commandNumber != null) {
      const dup = await prismaClient.kdsDailyOrderDetail.findFirst({
        where: {
          dateInt,
          commandNumber,
          ...(rowId ? { id: { not: rowId } } : {}),
        },
        select: { id: true },
      });
      if (dup) {
        return json({ ok: false, error: `Número de comanda ${commandNumber} já existe neste dia.` }, { status: 400 });
      }
    }

    // garante header do dia
    const header = await ensureHeader(dateInt, currentDate);

    // UPDATE
    if (rowId) {
      const prev = await prismaClient.kdsDailyOrderDetail.findUnique({
        where: { id: rowId },
        select: { status: true },
      });
      if (!prev) throw new Error("Registro não encontrado.");

      let deliveredAtUpdate: Date | null | undefined = undefined;
      if (status === "finalizado" && prev.status !== "finalizado") {
        deliveredAtUpdate = currentDate;
      } else if (status !== "finalizado" && prev.status === "finalizado") {
        deliveredAtUpdate = null;
      }

      const updated = await prismaClient.kdsDailyOrderDetail.update({
        where: { id: rowId },
        data: {
          orderId: header.id,
          dateInt,
          commandNumber,         // pode ser null
          isVendaLivre,
          size: JSON.stringify(sizeCounts),
          hasMoto,
          channel,
          status,
          motoValue,
          orderAmount,
          takeAway,
          ...(deliveredAtUpdate !== undefined ? { deliveredAt: deliveredAtUpdate } : {}),
        },
        select: { id: true, commandNumber: true },
      });
      await recalcHeaderTotal(dateInt);
      return json({ ok: true, id: updated.id, mode: "update", commandNumber: updated.commandNumber });
    }

    // CREATE (menos usado; preferir abrir dia / add / venda livre)
    const created = await prismaClient.kdsDailyOrderDetail.create({
      data: {
        orderId: header.id,
        dateInt,
        commandNumber,
        isVendaLivre,
        sortOrderIndex: (await getMaxes(dateInt)).maxSort + 1000,
        size: JSON.stringify(sizeCounts),
        hasMoto,
        channel,
        status,
        motoValue,
        orderAmount,
        takeAway,
        deliveredAt: status === "finalizado" ? currentDate : null,
      },
      select: { id: true, commandNumber: true },
    });
    await recalcHeaderTotal(dateInt);
    return json({ ok: true, id: created.id, mode: "create", commandNumber: created.commandNumber });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? "Erro desconhecido." }, { status: 400 });
  }
}

/* =============================
 * Status colors (inclui "pendente")
 * ============================= */
const statusColors: Record<string, string> = {
  pendente: "bg-slate-200 text-slate-800",
  novoPedido: "bg-gray-200 text-gray-800",
  emProducao: "bg-blue-100 text-blue-800",
  aguardandoForno: "bg-purple-100 text-purple-800",
  assando: "bg-orange-100 text-orange-800",
  finalizado: "bg-yellow-100 text-yellow-800",
};
function statusColorClasses(status: string | undefined | null) {
  return statusColors[status || "novoPedido"] || "bg-gray-200 text-gray-800";
}

/* =============================
 * MoneyInput (cent-based typing)
 * ============================= */
function MoneyInput({
  name,
  defaultValue,
  placeholder,
  className = "w-24",
  disabled = false,
}: {
  name: string;
  defaultValue?: DecimalLike | null;
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
    if (disabled) return;
    const k = e.key;
    if (k === "Enter") return;
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
        disabled={disabled}
        aria-disabled={disabled}
        className={`${className} h-9 border rounded px-2 py-1 text-right ${disabled ? "bg-gray-50 text-gray-400" : ""}`}
        placeholder={placeholder}
      />
      <input type="hidden" name={name} value={(cents / 100).toFixed(2)} />
    </div>
  );
}

/* =============================
 * Time helpers (Dialog)
 * ============================= */
function fmtHHMM(dateLike: string | Date | undefined | null) {
  if (!dateLike) return "--:--";
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtElapsedHHMM(from: string | Date | undefined | null, nowMs: number) {
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
 * Grid
 * ============================= */
const GRID_TMPL =
  "grid grid-cols-[70px,150px,260px,90px,110px,85px,160px,120px,60px,96px] gap-2 items-center gap-x-4";
const HEADER_TMPL =
  "grid grid-cols-[70px,150px,260px,90px,110px,85px,160px,120px,60px,96px] gap-2 gap-x-4 border-b font-semibold text-sm sticky top-0 z-10";

/* =============================
 * SizeSelector (com FT - FATIA)
 * ============================= */
function SizeSelector({
  counts,
  onChange,
  disabled,
}: {
  counts: SizeCounts;
  onChange: (newCounts: SizeCounts) => void;
  disabled?: boolean;
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
    <div className="flex items-center gap-3">
      {(["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => increment(size)}
          className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold
          ${counts[size] > 0 ? "bg-primary text-white" : "bg-white"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={`Adicionar ${size}`}
          disabled={disabled}
          title={size === "FT" ? "FATIA" : String(size)}
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
 * Sortable Row
 * ============================= */
function SortableRow({
  order,
  index,
  canais,
  dateStr,
  nowMs,
  displayNumber,
}: {
  order: OrderRow;
  index: number;
  canais: string[];
  dateStr: string;
  nowMs: number;
  displayNumber: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
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
      displayNumber={displayNumber}
      sortable={{ attributes, listeners, setNodeRef, style, isDragging }}
    />
  );
}

/* =============================
 * RowItem
 * ============================= */
function RowItem({
  order,
  index,
  canais,
  dateStr,
  nowMs,
  displayNumber,
  sortable,
}: {
  order: OrderRow;
  index: number;
  canais: string[];
  dateStr: string;
  nowMs: number;
  displayNumber: number;
  sortable?: {
    attributes: any;
    listeners: any;
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    isDragging: boolean;
  };
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string; id?: string; commandNumber?: number | null }>();
  const { revalidate } = useRevalidator();

  const [counts, setCounts] = useState<SizeCounts>(() => {
    if (order?.size) {
      try {
        const parsed = JSON.parse(order.size as any);
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

  const [rowId, setRowId] = useState<string>(order.id);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const [takeAway, setTakeAway] = useState(order?.take_away ?? false);

  // Dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Número de comanda (texto: permite vazio)
  const [isEditingNumber, setIsEditingNumber] = useState(false);
  const [cmdText, setCmdText] = useState<string>(order.commandNumber ? String(order.commandNumber) : "");

  const currentStatus = order?.status || "novoPedido";
  const semNumero = order.commandNumber == null || order.isVendaLivre;

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
        if ("commandNumber" in (fetcher.data as any)) {
          const n = (fetcher.data as any).commandNumber;
          setCmdText(n == null ? "" : String(n));
        }
        revalidate();
        const t = setTimeout(() => setLastOk(null), 1000);
        return () => clearTimeout(t);
      } else {
        setLastOk(false);
        setErrorText(fetcher.data.error ?? "Erro ao salvar.");
      }
    }
  }, [fetcher.data, revalidate]);

  const circleClass = useMemo(() => {
    if (fetcher.state === "submitting") return "bg-gray-200";
    if (lastOk === true) return "bg-green-500 text-white";
    if (lastOk === false) return "bg-red-500 text-white";
    return semNumero ? "bg-white text-gray-700 border-dashed" : statusColorClasses(currentStatus);
  }, [fetcher.state, lastOk, currentStatus, semNumero]);

  const horaStr = fmtHHMM(order?.createdAt);
  const decorridoStr = fmtElapsedHHMM(order?.createdAt, nowMs);

  return (
    <li
      data-row-id={order.id}
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={sortable?.isDragging ? "opacity-60" : undefined}
    >
      <fetcher.Form method="post" className={`${GRID_TMPL} py-2`}>
        {/* # / drag / número */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            {...(sortable?.listeners || {})}
            {...(sortable?.attributes || {})}
            className={"text-gray-600 cursor-grab active:cursor-grabbing"}
            title="Arraste para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div
            className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold ${circleClass} cursor-pointer`}
            title={
              fetcher.state === "submitting"
                ? "Salvando…"
                : lastOk === true
                  ? "Salvo!"
                  : lastOk === false
                    ? "Erro ao salvar"
                    : order.commandNumber
                      ? `Comanda ${cmdText}`
                      : `Venda livre (posição ${displayNumber})`
            }
            onClick={() => setIsEditingNumber(true)}
          >
            {isEditingNumber ? (
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                className="w-16 h-8 text-center rounded-full border bg-white/90 text-gray-900 outline-none"
                value={cmdText}
                onChange={(e) => setCmdText(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={String(displayNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setIsEditingNumber(false);
                }}
                onBlur={() => setIsEditingNumber(false)}
              />
            ) : (
              <span>{cmdText || String(displayNumber)}</span>
            )}
          </div>

          {semNumero && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0.5">VL</Badge>
          )}
        </div>

        {/* Pedido (R$) */}
        <div className="flex items-center justify-center">
          <MoneyInput
            name="orderAmount"
            defaultValue={order?.orderAmount}
            placeholder="Pedido (R$)"
            className="w-24"
          />
        </div>

        {/* Tamanhos */}
        <div>
          <SizeSelector counts={counts} onChange={setCounts} />
        </div>

        {/* Moto (boolean) */}
        <div className="flex items-center justify-center">
          <Select name="hasMoto" defaultValue={order?.hasMoto ? "true" : "false"}>
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
          />
        </div>

        {/* Delivery/Balcão */}
        <div className="flex items-center justify-center">
          <input type="hidden" name="take_away" value={takeAway ? "true" : "false"} />
          <button
            type="button"
            onClick={() => setTakeAway((v) => !v)}
            className={`w-[35px] h-[35px] rounded-lg ${takeAway ? "bg-green-100" : "bg-gray-100"} hover:bg-green-200`}
            title={takeAway ? "Retirada no balcão" : "Delivery"}
          >
            {takeAway ? <span className="font-semibold text-sm">B</span> : <span className="font-semibold text-sm">D</span>}
          </button>
        </div>

        {/* Canal (span 2) */}
        <div className="flex items-center justify-center col-span-2">
          <Select name="channel" defaultValue={order?.channel ?? ""}>
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

        {/* Detalhes (abre dialog) */}
        <div className="flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDetailsOpen(true)}
            title="Detalhes da comanda"
            className="mx-auto"
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>

        {/* Ações */}
        <div className="flex justify-center gap-2">
          <Button
            type="submit"
            name="_action"
            value="upsert"
            variant={"outline"}
            title="Salvar"
          >
            <Save className="w-4 h-4" />
          </Button>

          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            variant={"ghost"}
            title="Cancelar (exclusão definitiva)"
            className="hover:bg-red-50"
          >
            <Trash className="w-4 h-4 text-red-500" />
          </Button>

          {/* Dialog de confirmação de cancelamento */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar pedido?</DialogTitle>
                <DialogDescription>
                  Esta ação <strong>remove definitivamente</strong> o registro.
                  Não será possível desfazer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    fetcher.submit(
                      { _action: "cancel", id: rowId, date: dateStr },
                      { method: "post" }
                    );
                    setConfirmOpen(false);
                  }}
                >
                  Cancelar pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Hidden necessários */}
        <input type="hidden" name="id" value={rowId} />
        <input type="hidden" name="size" value={JSON.stringify(counts)} />
        <input type="hidden" name="commandNumber" value={cmdText} />
        <input type="hidden" name="date" value={dateStr} />
        <input type="hidden" name="status" value={currentStatus} />

        {/* Erro (linha) */}
        {errorText && <div className="col-span-10 text-red-600 text-xs mt-1">{errorText}</div>}
      </fetcher.Form>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {order.commandNumber ? `Comanda #${cmdText}` : `Venda livre (pos. ${displayNumber})`}
            </DialogTitle>
            <DialogDescription>Informações completas do registro</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-500">Criado às</div>
                <div className="font-mono text-3xl">{horaStr}</div>
              </div>
              <div>
                <div className="text-gray-500">Decorrido</div>
                <div className="font-mono text-3xl">{decorridoStr}</div>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <div className="text-gray-500 mb-1">Status</div>
                <Select
                  defaultValue={currentStatus}
                  onValueChange={(v) => {
                    const form = document.querySelector(`form input[name="id"][value="${rowId}"]`)?.closest("form") as HTMLFormElement | null;
                    const input = form?.querySelector('input[name="status"]') as HTMLInputElement | null;
                    if (input) input.value = v;
                  }}
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">(0) Pendente</SelectItem>
                    <SelectItem value="novoPedido">(1) Novo Pedido</SelectItem>
                    <SelectItem value="emProducao">(2) Em Produção</SelectItem>
                    <SelectItem value="aguardandoForno">(3) Aguardando forno</SelectItem>
                    <SelectItem value="assando">(4) Assando</SelectItem>
                    <SelectItem value="finalizado">(5) Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resumo de valores */}
              <div>
                <div className="text-gray-500">Pedido (R$)</div>
                <div className="font-mono">
                  {Number((order?.orderAmount as any) ?? 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Moto (R$)</div>
                <div className="font-mono">
                  {Number((order?.motoValue as any) ?? 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>

              {/* Tamanhos (resumo) */}
              <div className="col-span-2">
                <div className="text-gray-500 mb-1">Tamanhos</div>
                <div className="font-mono">
                  F:{counts.F} M:{counts.M} P:{counts.P} I:{counts.I} FT:{counts.FT}
                </div>
              </div>

              {/* Canal */}
              {order?.channel && (
                <div className="col-span-2">
                  <div className="text-gray-500">Canal</div>
                  <div>{order.channel}</div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="default"
              onClick={() => {
                const form = document.querySelector(`form input[name="id"][value="${rowId}"]`)?.closest("form") as HTMLFormElement | null;
                form?.requestSubmit();
                setDetailsOpen(false);
              }}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/* =============================
 * Página
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
  // Recarrega dados a cada 5 minutos
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  // ENTER submete o form focado (evita inputs de texto)
  useHotkeys("enter", (e) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    e.preventDefault();
    const form = target?.closest("form") as HTMLFormElement | null;
    form?.requestSubmit();
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const reorderFetcher = useFetcher();
  const openDayFetcher = useFetcher();
  const addSlotsFetcher = useFetcher();
  const createFreeFetcher = useFetcher();

  // Toolbar controls
  const addQtyRef = useRef<HTMLInputElement>(null);
  const [showFree, setShowFree] = useState(true);

  // Quick-create venda livre feedback
  const [creatingFree, setCreatingFree] = useState(false);
  const [createFreeError, setCreateFreeError] = useState<string | null>(null);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (createFreeFetcher.state === "submitting") {
      setCreatingFree(true);
      setCreateFreeError(null);
    }
  }, [createFreeFetcher.state]);

  useEffect(() => {
    if (createFreeFetcher.data) {
      const d = createFreeFetcher.data as any;
      setCreatingFree(false);
      if (d.ok) {
        setLastCreatedId(d.id ?? null);
        revalidate();
      } else {
        setCreateFreeError(d.error ?? "Falha ao criar venda livre");
      }
    }
  }, [createFreeFetcher.data, revalidate]);

  useEffect(() => {
    if (!lastCreatedId) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-row-id="${lastCreatedId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("ring-2", "ring-primary", "rounded-md", "animate-pulse");
        setTimeout(() => {
          el.classList.remove("animate-pulse", "ring-2", "ring-primary");
        }, 1200);
      }
      setLastCreatedId(null);
    }, 150);
    return () => clearTimeout(t);
  }, [lastCreatedId]);

  return (
    <Suspense fallback={<div>Carregando pedidos...</div>}>
      <Await resolve={data.orders}>
        {(orders) => {
          const safeOrders = Array.isArray(orders) ? (orders as OrderRow[]) : [];
          const hasAny = safeOrders.length > 0;

          // Totais (incluem vendas livres mesmo que ocultas)
          const toNum = (v: any) => Number((v as any)?.toString?.() ?? v ?? 0) || 0;
          const totalPedido = safeOrders.reduce((s, o) => s + toNum(o?.orderAmount), 0);
          const totalMoto = safeOrders.reduce((s, o) => s + toNum(o?.motoValue), 0);
          const sizeTotals = safeOrders.reduce(
            (acc, o) => {
              try {
                const s = o?.size ? JSON.parse(o.size as any) : {};
                acc.F += Number(s.F || 0);
                acc.M += Number(s.M || 0);
                acc.P += Number(s.P || 0);
                acc.I += Number(s.I || 0);
                acc.FT += Number(s.FT || 0);
              } catch { }
              return acc;
            },
            { F: 0, M: 0, P: 0, I: 0, FT: 0 }
          );

          // Alerta de comanda duplicada (ignora null)
          const duplicatedNumbers = (() => {
            const counts = new Map<number, number>();
            for (const o of safeOrders) {
              const n = o.commandNumber;
              if (!n) continue;
              counts.set(n, (counts.get(n) ?? 0) + 1);
            }
            return [...counts.entries()]
              .filter(([, c]) => c > 1)
              .map(([n]) => n)
              .sort((a, b) => a - b);
          })();

          // Filtragem por toggle
          const displayedOrders = showFree ? safeOrders : safeOrders.filter((o) => !o.isVendaLivre);

          // IDs visíveis e totais
          const displayedIds = displayedOrders.map((o) => o.id);

          function handleDragEnd(event: DragEndEvent) {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const visOldIndex = displayedOrders.findIndex((o) => o.id === active.id);
            const visNewIndex = displayedOrders.findIndex((o) => o.id === over.id);
            if (visOldIndex === -1 || visNewIndex === -1 || visOldIndex === visNewIndex) return;

            const nextVisible = arrayMove(displayedOrders, visOldIndex, visNewIndex);

            // Reconstrói ordem completa preservando itens fora da visão
            const newFull = [...safeOrders];
            const visibleSet = new Set(displayedIds);
            const positions: number[] = [];
            for (let i = 0; i < newFull.length; i++) {
              if (visibleSet.has(newFull[i].id)) positions.push(i);
            }
            positions.forEach((pos, idx) => {
              newFull[pos] = nextVisible[idx];
            });

            const ids = newFull.map((o) => o.id);
            reorderFetcher.submit(
              { _action: "reorder", date: data.currentDate, ids: JSON.stringify(ids) },
              { method: "post" }
            );
          }

          return (
            <div className="space-y-6">
              {/* Header organizado */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {!hasAny ? (
                  <openDayFetcher.Form method="post">
                    <input type="hidden" name="_action" value="openDay" />
                    <input type="hidden" name="date" value={data.currentDate} />
                    <Button type="submit" variant="default">Abrir dia (40)</Button>
                  </openDayFetcher.Form>
                ) : (
                  <>
                    {/* Split-button: Adicionar linhas */}
                    <div className="inline-flex items-center">
                      <addSlotsFetcher.Form method="post" id="addSlotsForm" className="hidden">
                        <input type="hidden" name="_action" value="addSlots" />
                        <input type="hidden" name="date" value={data.currentDate} />
                        <input ref={addQtyRef} type="hidden" name="qty" defaultValue={10} />
                      </addSlotsFetcher.Form>

                      <Button
                        className="rounded-r-none gap-2"
                        onClick={() => {
                          const f = document.getElementById("addSlotsForm") as HTMLFormElement | null;
                          f?.requestSubmit();
                        }}
                      >
                        <PlusCircle className="w-4 h-4" /> Adicionar
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="rounded-l-none px-2">
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => { if (addQtyRef.current) addQtyRef.current.value = "5"; document.getElementById("addSlotsForm")?.requestSubmit(); }}>
                            +5 linhas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (addQtyRef.current) addQtyRef.current.value = "10"; document.getElementById("addSlotsForm")?.requestSubmit(); }}>
                            +10 linhas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (addQtyRef.current) addQtyRef.current.value = "20"; document.getElementById("addSlotsForm")?.requestSubmit(); }}>
                            +20 linhas
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* Poderíamos incluir aqui "+ Venda livre", mas para manter o header limpo,
                              usamos a linha rápida logo abaixo da grelha. */}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Toggle: mostrar vendas livres */}
                      <div className="ml-2 flex items-center gap-2 px-3 py-2 rounded-lg border">
                        <span className="text-sm">Mostrar vendas livres</span>
                        <Switch checked={showFree} onCheckedChange={setShowFree} />
                      </div>
                    </div>

                    {/* Relatório compacto */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="ml-auto gap-2">
                          <Receipt className="w-4 h-4" /> Relatório
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span>Nº pedidos</span><span className="font-mono font-semibold">{safeOrders.length}</span></div>
                          <div className="flex justify-between"><span>Faturamento (R$)</span><span className="font-mono font-semibold">{totalPedido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                          <div className="flex justify-between"><span>Total Moto (R$)</span><span className="font-mono font-semibold">{totalMoto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                          <div className="flex justify-between"><span>Tamanhos (F/M/P/I/FT)</span>
                            <span className="font-mono">F:{sizeTotals.F} M:{sizeTotals.M} P:{sizeTotals.P} I:{sizeTotals.I} FT:{sizeTotals.FT}</span>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>

              {/* Linha rápida: Venda livre (valor + criar, status pendente) */}
              <div className="rounded-lg border p-3 flex flex-wrap items-center gap-3">
                <div className="text-sm font-medium">Venda livre (rápida)</div>
                <createFreeFetcher.Form method="post" className="flex items-center gap-3">
                  <input type="hidden" name="_action" value="createVendaLivre" />
                  <input type="hidden" name="date" value={data.currentDate} />
                  <input type="hidden" name="status" value="pendente" />
                  <MoneyInput
                    name="orderAmount"
                    placeholder="Valor (R$)"
                    className="w-32"
                  />
                  <Button type="submit" variant="secondary" disabled={creatingFree}>
                    {creatingFree ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Criando…
                      </span>
                    ) : (
                      "Adicionar"
                    )}
                  </Button>
                </createFreeFetcher.Form>
                {createFreeError && (
                  <div className="text-red-600 text-xs">{createFreeError}</div>
                )}
                <div className="ml-auto text-xs text-slate-500">
                  Status inicial: <span className="font-semibold">pendente</span>. Depois você pode atribuir um nº clicando na bolinha.
                </div>
              </div>

              {/* Duplicados */}
              {duplicatedNumbers.length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
                  <strong>Atenção:</strong> existem números de comanda repetidos neste dia:{" "}
                  <span className="font-mono">{duplicatedNumbers.join(", ")}</span>.
                </div>
              )}

              {/* Cabeçalho */}
              <div className={`${HEADER_TMPL}`}>
                <div className="text-center">#</div>
                <div className="text-center">Pedido (R$)</div>
                <div className="text-center">Tamanho</div>
                <div className="text-center">Moto</div>
                <div className="text-center">Moto (R$)</div>
                <div className="text-center">Delivery/Balcão</div>
                <div className="text-center col-span-2">Canal</div>
                <div className="text-center">Detalhes</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Lista */}
              <ul>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={displayedOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                    {displayedOrders.map((o, i) => (
                      <SortableRow
                        key={o.id}
                        order={o}
                        index={i}
                        canais={["WHATS/PRESENCIAL/TELE", "MOGO", "AIQFOME", "IFOOD"]}
                        dateStr={data.currentDate}
                        nowMs={nowMs}
                        displayNumber={i + 1} // número de exibição
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </ul>
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
