// app/routes/admin.kds.atendimento.$date.grid.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, defer } from "@remix-run/node";
import { Await, useFetcher, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import prisma from "~/lib/prisma/client.server";
import { Prisma } from "@prisma/client";

import {
  SizeSelector,
  ConfirmDeleteDialog,
  DetailsDialog,
  OpeningDayOverlay,
  ymdToDateInt,
  ymdToUtcNoon,
  todayLocalYMD,
  duplicateCommandNumbers,
  type OrderRow,
  type SizeCounts,
  defaultSizeCounts,
  CHANNELS,
  fmtHHMM,
  fmtElapsedHHMM,
  STATUS_RANK,
} from "@/domain/kds";

import {
  ensureHeader,
  recalcHeaderTotal,
  getMaxes,
  listByDate,
} from "@/domain/kds/server";

import {
  buildDzMap,
  getOperatorCountByDate,
  getRiderCountByDate,
  predictReadyTimes,
  predictArrivalTimes,
  type MinimalOrderRow,
} from "@/domain/kds/delivery-prediction";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Loader2,
  PlusCircle,
  Save,
  Trash,
  Ellipsis,
  AlertTriangle,
  Lock,
  Unlock,
  CreditCard,
  BadgeDollarSign,
  Pizza,
  ChevronUp,
  ChevronDown,
  GripVertical,
  PencilLine,
  SaveIcon,
  CrossIcon,
  X,
  LogOutIcon,
} from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import DeliveryZoneCombobox from "~/domain/kds/components/delivery-zone-combobox";
import { computeNetRevenueAmount } from "~/domain/finance/compute-net-revenue-amount.server";
import { setOrderStatus } from "~/domain/kds/server/repository.server";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { getAvailableDoughSizes, getDoughStock, normalizeCounts, saveDoughStock, type DoughSizeOption, type DoughStockSnapshot } from "~/domain/kds/dough-stock.server";
import { Link } from "@remix-run/react";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { ExitIcon } from "@radix-ui/react-icons";

/* ===========================
   Meta
   =========================== */
export const meta: MetaFunction = () => {
  return [{ title: "KDS | Pedidos" }];
};

/**
 * LAYOUT DE COLUNAS (8 colunas)
 * [#, Pedido(R$), Tamanhos, Canal, Delivery, Retirada, Detalhes, Ações]
 *  - Delivery = switch + zona habilitada quando ON + valor da moto
 *  - "VL" removida do cabeçalho (ícone de venda livre na célula Pedido foi retirado; agora só cartão)
 */
const COLS =
  "grid grid-cols-[60px,180px,260px,240px,360px,110px,80px,110px] gap-2 items-center gap-x-8";
const COLS_HDR =
  "grid grid-cols-[60px,180px,260px,240px,360px,110px,80px,110px] gap-2 gap-x-8 border-b font-semibold text-sm sticky top-0 z-10 bg-white";

/* ===========================
   Helpers
   =========================== */
function toDecimal(value: FormDataEntryValue | null | undefined): Prisma.Decimal {
  const raw = String(value ?? "0").replace(",", ".");
  const n = Number(raw);
  return new Prisma.Decimal(Number.isFinite(n) ? n.toFixed(2) : "0");
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n || 0);
}

function CommandNumberInput({
  value,
  onChange,
  className = "w-16 text-center",
  isVendaLivre = false
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  isVendaLivre?: boolean;
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const k = e.key;
    if (k === "Backspace") { e.preventDefault(); onChange(value ? Math.floor(value / 10) : null); return; }
    if (k === "Delete") { e.preventDefault(); onChange(null); return; }
    if (/^\d$/.test(k)) { e.preventDefault(); onChange(((value ?? 0) * 10 + Number(k)) % 10000000); return; }
    if (k === "Tab" || k === "Enter" || k.startsWith("Arrow") || k === "Home" || k === "End") return;
    e.preventDefault();
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value ?? ""}
      onKeyDown={onKeyDown}
      onChange={() => { }}
      className={`h-9 border rounded px-2 ${className}`}
      placeholder="—"
      disabled={isVendaLivre}
    />
  );
}

function parseSize(json: any): SizeCounts {
  try {
    const o = json ? JSON.parse(String(json)) : {};
    return { F: +o?.F || 0, M: +o?.M || 0, P: +o?.P || 0, I: +o?.I || 0, FT: +o?.FT || 0 };
  } catch { return defaultSizeCounts(); }
}
const stringifySize = (c: SizeCounts) => JSON.stringify(c);
const sizeSummary = (c: SizeCounts) =>
  (["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[])
    .filter(k => c[k] > 0)
    .map(k => `${k}:${c[k]}`)
    .join("  ");

const SIZE_LABELS: Record<keyof SizeCounts, string> = {
  F: "Família",
  M: "Média",
  P: "Pequena",
  I: "Individual",
  FT: "Fatia",
};

function sumSizes(list: { size?: any }[]): SizeCounts {
  return list.reduce((acc, item) => {
    const parsed = parseSize(item?.size);
    acc.F += parsed.F;
    acc.M += parsed.M;
    acc.P += parsed.P;
    acc.I += parsed.I;
    acc.FT += parsed.FT;
    return acc;
  }, defaultSizeCounts());
}

function calcRemaining(stock: SizeCounts | null, used: SizeCounts): SizeCounts {
  const base = stock ?? defaultSizeCounts();
  return {
    F: base.F - used.F,
    M: base.M - used.M,
    P: base.P - used.P,
    I: base.I - used.I,
    FT: base.FT - used.FT,
  };
}

/* ===========================
   Loader
   =========================== */

type DashboardMeta = {
  grossAmount: number;
  cardAmount: number;
  motoAmount: number;
  netAmount: number;
  taxPerc: number;
  marketplaceTaxPerc: number
  cardFeePerc: number;
  goalMinAmount: number;
  goalTargetAmount: number;
  pctOfTarget: number; // 0..100
  status: "below-min" | "between" | "hit-target";
};

function mapGoalForDate(goal: any, dateStr: string): { min: number; target: number } {
  // Considerando seu calendário: Quarta a Domingo (Dia01..Dia05)
  const dt = new Date(`${dateStr}T12:00:00`);
  const dow = dt.getDay(); // 0=Dom,1=Seg,...,3=Qua,4=Qui,5=Sex,6=Sab
  // Map: Qua(3)->1, Qui(4)->2, Sex(5)->3, Sab(6)->4, Dom(0)->5
  const map: Record<number, 1 | 2 | 3 | 4 | 5> = { 3: 1, 4: 2, 5: 3, 6: 4, 0: 5 } as any;
  const key = map[dow];
  if (!key) return { min: 0, target: 0 };

  const minField = `minimumGoalDia0${key}Amount`;
  const targetField = `targetProfitDia0${key}Amount`;

  const min = Number(goal?.[minField] ?? 0) || 0;
  const target = Number(goal?.[targetField] ?? 0) || 0;
  return { min, target };
}

export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);

  // Dados já existentes
  const listPromise = listByDate(dateInt);
  const header = await prisma.kdsDailyOrder.findUnique({
    where: { dateInt },
    select: { id: true, operationStatus: true },
  });

  const deliveryZones = await prisma.deliveryZone.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const dzTimes = await prisma.deliveryZoneDistance.findMany({
    select: {
      deliveryZoneId: true,
      estimatedTimeInMin: true,
      distanceInKm: true,
    },
  });

  // ⬇️ Novos cálculos para o painel-resumo
  // Somas do dia
  const grossRow = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt },
    _sum: { orderAmount: true },
  });
  const cardRow = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt, isCreditCard: true },
    _sum: { orderAmount: true },
  });
  const motoRow = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt, hasMoto: true },
    _sum: { motoValue: true },
  });

  const aiqfomeChannelStr = CHANNELS[2]
  const ifoodChannelStr = CHANNELS[3];
  const marketplaceRow = await prisma.kdsDailyOrderDetail.aggregate({
    where: {
      AND: {
        dateInt,
        channel: {
          in: [aiqfomeChannelStr, ifoodChannelStr]
        }
      }
    },
    _sum: { orderAmount: true },
  })

  const grossAmount = Number(grossRow._sum.orderAmount ?? 0);
  const cardAmount = Number(cardRow._sum.orderAmount ?? 0);
  const motoAmount = Number(motoRow._sum.motoValue ?? 0);
  const marketplaceAmount = Number(marketplaceRow._sum.orderAmount ?? 0);

  // Taxas vigentes (snapshot=false)
  const fs = await prisma.financialSummary.findFirst({
    where: { isSnapshot: false },
    select: { taxaCartaoPerc: true, impostoPerc: true, taxaMarketplacePerc: true },
  });
  const taxPerc = Number(fs?.impostoPerc ?? 0);       // ex.: 4 para 4%
  const cardFeePerc = Number(fs?.taxaCartaoPerc ?? 0); // ex.: 3.2 para 3,2%
  const taxaMarketplacePerc = Number(fs?.taxaMarketplacePerc ?? 0);

  // Meta ativa
  const activeGoal = await prisma.financialDailyGoal.findFirst({
    where: { isActive: true },
    select: {
      minimumGoalDia01Amount: true,
      minimumGoalDia02Amount: true,
      minimumGoalDia03Amount: true,
      minimumGoalDia04Amount: true,
      minimumGoalDia05Amount: true,
      targetProfitDia01Amount: true,
      targetProfitDia02Amount: true,
      targetProfitDia03Amount: true,
      targetProfitDia04Amount: true,
      targetProfitDia05Amount: true,
    },
  });

  const { min: goalMinAmount, target: goalTargetAmount } = mapGoalForDate(activeGoal, dateStr);

  // Receita líquida usando sua função utilitária
  const netAmount = computeNetRevenueAmount({
    receitaBrutaAmount: grossAmount,
    vendaCartaoAmount: cardAmount,
    taxaCartaoPerc: cardFeePerc,
    taxaMarketplacePerc,
    vendaMarketplaceAmount: marketplaceAmount,
    impostoPerc: taxPerc,
  });

  // Status vs metas
  let status: DashboardMeta["status"] = "below-min";
  if (netAmount >= goalTargetAmount && goalTargetAmount > 0) status = "hit-target";
  else if (netAmount >= goalMinAmount) status = "between";

  const pctOfTarget =
    goalTargetAmount > 0 ? Math.min(100, (netAmount / goalTargetAmount) * 100) : 0;

  const doughStock = await getDoughStock(dateInt);
  const doughUsage = listPromise.then((rows) => sumSizes(rows));
  const availableSizes = await getAvailableDoughSizes();

  const dashboard: DashboardMeta = {
    grossAmount,
    cardAmount,
    motoAmount,
    netAmount,
    taxPerc,
    cardFeePerc,
    goalMinAmount,
    goalTargetAmount,
    pctOfTarget,
    status,
    marketplaceTaxPerc: taxaMarketplacePerc
  };

  return defer({
    dateStr,
    items: listPromise,
    header: header ?? { id: null, operationStatus: "PENDING" as const },
    deliveryZones,
    dzTimes,
    dashboard,
    doughStock,
    doughUsage,
    availableSizes,
  });
}

/* ===========================
   Actions
   =========================== */
export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const _action = String(form.get("_action") ?? "");
  const dateStr = String(form.get("date") ?? params.date ?? todayLocalYMD());
  const dateInt = ymdToDateInt(dateStr);

  const header = await ensureHeader(dateInt, ymdToUtcNoon(dateStr));
  const headerFlags = await prisma.kdsDailyOrder.findUnique({
    where: { id: header.id },
    select: { operationStatus: true },
  });

  const getNextSort = async () => {
    const { maxSort } = await getMaxes(dateInt);
    return (maxSort ?? 0) + 1000;
  };

  try {
    if (_action === "openDay") {
      if (headerFlags?.operationStatus === "CLOSED") {
        return json({ ok: false, error: "Dia já foi fechado." }, { status: 400 });
      }
      if (headerFlags?.operationStatus === "OPENED" || headerFlags?.operationStatus === "REOPENED") {
        return json({ ok: false, error: "Dia já está aberto." }, { status: 400 });
      }

      const qty = Math.max(1, Math.min(200, Number(form.get("qty") ?? 40)));
      const existing = await prisma.kdsDailyOrderDetail.findMany({
        where: { dateInt, commandNumber: { not: null } },
        select: { commandNumber: true },
      });
      const existSet = new Set<number>(existing.map(e => Number(e.commandNumber!)).filter(Number.isFinite));

      const { maxSort } = await getMaxes(dateInt);
      let sort = (maxSort ?? 0) + 1000;

      const toCreate: Prisma.KdsDailyOrderDetailCreateManyInput[] = [];
      for (let n = 1; n <= qty; n++) {
        if (existSet.has(n)) continue;
        toCreate.push({
          orderId: header.id, dateInt, commandNumber: n, isVendaLivre: false,
          sortOrderIndex: sort, orderAmount: new Prisma.Decimal(0),
          status: "pendente", channel: "", hasMoto: false, motoValue: new Prisma.Decimal(0),
          takeAway: false, isCreditCard: false,
        } as any);
        sort += 1000;
      }

      if (toCreate.length) {
        await prisma.kdsDailyOrderDetail.createMany({ data: toCreate });
      }

      await prisma.kdsDailyOrder.update({
        where: { id: header.id },
        data: { operationStatus: "OPENED" },
      });

      await recalcHeaderTotal(dateInt);
      return json({ ok: true, created: toCreate.length, status: "OPENED" });
    }

    if (_action === "closeDay") {
      if (headerFlags?.operationStatus === "CLOSED") {
        return json({ ok: true, already: true });
      }
      await prisma.kdsDailyOrder.update({
        where: { id: header.id },
        data: { operationStatus: "CLOSED" },
      });
      return json({ ok: true, status: "CLOSED" });
    }

    if (_action === "reopenDay") {
      if (headerFlags?.operationStatus !== "CLOSED") {
        return json({ ok: false, error: "Só é possível reabrir um dia fechado." }, { status: 400 });
      }
      await prisma.kdsDailyOrder.update({
        where: { id: header.id },
        data: { operationStatus: "REOPENED" },
      });
      return json({ ok: true, status: "REOPENED" });
    }

    if (_action === "saveDoughStock") {
      const counts = normalizeCounts({
        F: form.get("stockF"),
        M: form.get("stockM"),
        P: form.get("stockP"),
        I: form.get("stockI"),
        FT: form.get("stockFT"),
      } as any);

      const adjustment = normalizeCounts({
        F: form.get("adjustF"),
        M: form.get("adjustM"),
        P: form.get("adjustP"),
        I: form.get("adjustI"),
        FT: form.get("adjustFT"),
      } as any);

      const snapshot = await saveDoughStock(dateInt, ymdToUtcNoon(dateStr), counts, adjustment);

      return json({ ok: true, stock: snapshot });
    }

    // bloqueia alterações quando fechado
    if (headerFlags?.operationStatus === "CLOSED") {
      return json({ ok: false, error: "Dia fechado. Alterações não são permitidas." }, { status: 403 });
    }

    if (_action === "addMore") {
      if (headerFlags?.operationStatus !== "OPENED") {
        return json({ ok: false, error: "Abra o dia (status ABERTO) antes de adicionar mais." }, { status: 400 });
      }
      const more = Math.max(1, Math.min(200, Number(form.get("more") ?? 20)));
      const { maxCmd } = await getMaxes(dateInt);
      let sort = await getNextSort();

      const toCreate: Prisma.KdsDailyOrderDetailCreateManyInput[] = [];
      for (let i = 1; i <= more; i++) {
        const n = Number(maxCmd ?? 0) + i;
        toCreate.push({
          orderId: header.id, dateInt, commandNumber: n, isVendaLivre: false,
          sortOrderIndex: sort, orderAmount: new Prisma.Decimal(0),
          status: "pendente", channel: "", hasMoto: false, motoValue: new Prisma.Decimal(0),
          takeAway: false, isCreditCard: false,
        } as any);
        sort += 1000;
      }
      if (toCreate.length) {
        await prisma.kdsDailyOrderDetail.createMany({ data: toCreate });
        await recalcHeaderTotal(dateInt);
      }
      return json({ ok: true, created: toCreate.length });
    }

    if (_action === "createVL") {
      if (headerFlags?.operationStatus !== "OPENED") {
        return json({ ok: false, error: "Venda livre só é permitida com o dia ABERTO." }, { status: 400 });
      }
      const amount = toDecimal(form.get("orderAmount"));
      const created = await prisma.kdsDailyOrderDetail.create({
        data: {
          orderId: header.id,
          dateInt,
          commandNumber: null,
          isVendaLivre: true,
          sortOrderIndex: await getNextSort(),
          orderAmount: amount,
          status: "finalizado",
          channel: "WHATS/PRESENCIAL/TELE",
          hasMoto: false,
          motoValue: new Prisma.Decimal(0),
          takeAway: false,
          isCreditCard: String(form.get("isCreditCard") ?? "") === "on", // ← agora pega do form
        },
        select: { id: true },
      });
      await recalcHeaderTotal(dateInt);
      return json({ ok: true, id: created.id });
    }

    if (_action === "saveRow") {
      const id = String(form.get("id") ?? "");
      if (!id) return json({ ok: false, error: "id inválido" }, { status: 400 });

      // Novo: permitir alternar "venda livre" via form
      const isVendaLivre = String(form.get("isVendaLivre") ?? "") === "on";

      const rawCmd = String(form.get("commandNumber") ?? "").trim();
      let cmd: number | null = null;

      if (!isVendaLivre) {
        // Só valida e usa comanda quando não é venda livre
        cmd = rawCmd === "" ? null : Number(rawCmd);
        if (rawCmd !== "" && !Number.isFinite(cmd)) {
          return json({ ok: false, error: "Número de comanda inválido" }, { status: 400 });
        }
        if (cmd != null) {
          const dup = await prisma.kdsDailyOrderDetail.findFirst({
            where: { dateInt, commandNumber: cmd, id: { not: id } },
            select: { id: true },
          });
          if (dup) {
            return json({ ok: false, error: `Comanda ${cmd} já existe para ${dateStr}` }, { status: 400 });
          }
        }
      } else {
        cmd = null; // venda livre força comanda nula
      }

      const sizeCounts = {
        F: Number(form.get("sizeF") ?? 0) || 0,
        M: Number(form.get("sizeM") ?? 0) || 0,
        P: Number(form.get("sizeP") ?? 0) || 0,
        I: Number(form.get("sizeI") ?? 0) || 0,
        FT: Number(form.get("sizeFT") ?? 0) || 0,
      };

      const doughStock = await getDoughStock(dateInt);
      if (doughStock) {
        const rowsForDay = await prisma.kdsDailyOrderDetail.findMany({
          where: { dateInt },
          select: { id: true, size: true },
        });

        const usedWithoutCurrent = sumSizes(rowsForDay.filter((r) => r.id !== id));
        const remaining = calcRemaining(doughStock.effective, usedWithoutCurrent);

        const shortages = (Object.keys(sizeCounts) as (keyof SizeCounts)[])
          .filter((k) => sizeCounts[k] > remaining[k]);

        if (shortages.length > 0) {
          const sizeOptions = await getAvailableDoughSizes();
          const labelMap = { ...SIZE_LABELS } as Record<keyof SizeCounts, string>;
          sizeOptions.forEach((s) => { labelMap[s.key] = s.label || s.key; });

          const msg = shortages
            .map((k) => `${labelMap[k] ?? k} sem estoque (restam ${Math.max(0, remaining[k])})`)
            .join("; ");

          return json({ ok: false, error: msg, rowId: id, shortages }, { status: 400 });
        }
      }

      const amountDecimal = toDecimal(form.get("orderAmount"));

      const current = await prisma.kdsDailyOrderDetail.findUnique({
        where: { id },
        select: {
          status: true,
          emProducaoAt: true,
          aguardandoFornoAt: true,
          assandoAt: true,
          finalizadoAt: true,
          novoPedidoAt: true
        },
      });

      const anySize =
        (sizeCounts.F + sizeCounts.M + sizeCounts.P + sizeCounts.I + sizeCounts.FT) > 0;

      const allProdTimestampsNull =
        !current?.emProducaoAt &&
        !current?.aguardandoFornoAt &&
        !current?.assandoAt &&
        !current?.finalizadoAt;

      const amountGtZero = (amountDecimal as any)?.gt
        ? (amountDecimal as any).gt(new Prisma.Decimal(0))
        : Number(String(amountDecimal)) > 0;

      const autoStatus = (amountGtZero && anySize && allProdTimestampsNull)
        ? "novoPedido"
        : "pendente";

      const requestedStatus = String(form.get("status") ?? "");
      const rankOld = STATUS_RANK[current?.status ?? "pendente"] ?? 0;

      let finalStatus = requestedStatus?.trim();
      if (!finalStatus || finalStatus === "pendente" || finalStatus === "novoPedido") {
        finalStatus = autoStatus;
      }
      const rankNew = STATUS_RANK[finalStatus ?? "pendente"] ?? 0;

      let patchNovoPedidoAt: Date | null | undefined = undefined;
      if (!current?.novoPedidoAt && finalStatus === "novoPedido") {
        patchNovoPedidoAt = new Date();
      }
      if (current?.novoPedidoAt && rankNew < rankOld) {
        patchNovoPedidoAt = null;
      }

      if (finalStatus && finalStatus !== current?.status) {
        await setOrderStatus(id, finalStatus as any);
      }

      const dzIdRaw = String(form.get("deliveryZoneId") ?? "").trim();
      const deliveryZoneId = dzIdRaw === "" ? null : dzIdRaw;

      await prisma.kdsDailyOrderDetail.update({
        where: { id },
        data: {
          commandNumber: cmd,
          isVendaLivre, // agora persiste direto
          orderAmount: amountDecimal,
          channel: String(form.get("channel") ?? ""),
          hasMoto: String(form.get("hasMoto") ?? "") === "on",
          motoValue: toDecimal(form.get("motoValue")),
          takeAway: String(form.get("takeAway") ?? "") === "on",
          size: stringifySize(sizeCounts as any),
          deliveryZoneId: deliveryZoneId as any,
          isCreditCard: String(form.get("isCreditCard") ?? "") === "on",
          ...(patchNovoPedidoAt !== undefined ? { novoPedidoAt: patchNovoPedidoAt as any } : {}),
        },
      });

      await recalcHeaderTotal(dateInt);
      return json({ ok: true, id, commandNumber: cmd });
    }

    if (_action === "cancelRow") {
      const id = String(form.get("id") ?? "");
      if (!id) return json({ ok: false, error: "id inválido" }, { status: 400 });
      await prisma.kdsDailyOrderDetail.delete({ where: { id } });
      await recalcHeaderTotal(dateInt);
      return json({ ok: true, canceled: true });
    }

    return json({ ok: false, error: "ação inválida" }, { status: 400 });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "erro" }, { status: 500 });
  }
}

/* ===========================
   Linha (RowItem)
   =========================== */
function RowItem({
  o,
  dateStr,
  readOnly,
  deliveryZones,
  nowMs,
  predictions,
  rowFx,
  sizeLimit,
}: {
  o: OrderRow;
  dateStr: string;
  readOnly: boolean;
  deliveryZones: { id: string; name: string }[];
  nowMs: number;
  predictions: Map<string, { readyAtMs: number; arriveAtMs: number | null }>;
  rowFx: ReturnType<typeof useFetcher>;
  sizeLimit?: SizeCounts | null;
}) {
  const sizeCounts = parseSize(o.size);

  // estados por linha
  const [openConfirmId, setOpenConfirmId] = useState(false);
  const [detailsOpenId, setDetailsOpenId] = useState(false);

  const [cmdLocal, setCmdLocal] = useState<number | null>(o.commandNumber);
  const [isVendaLivre] = useState<boolean>(!!o.isVendaLivre);

  const [hasMoto, setHasMoto] = useState<boolean>(!!o.hasMoto);
  const [takeAway, setTakeAway] = useState<boolean>(!!(o as any).takeAway);
  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null | undefined>((o as any).deliveryZoneId ?? null);

  const [motoDefault, setMotoDefault] = useState<number>(Number(o.motoValue ?? 0));
  const [motoKey, setMotoKey] = useState(0);

  const [isCreditCard, setIsCreditCard] = useState<boolean>(!!(o as any).isCreditCard);

  const [sizes, setSizes] = useState<SizeCounts>(sizeCounts);
  const statusText = (o as any).status ?? "pendente";
  const npAt = (o as any).novoPedidoAt ? new Date((o as any).novoPedidoAt as any) : null;

  const rowError =
    rowFx.data && typeof (rowFx.data as any) === "object" && (rowFx.data as any).rowId === o.id
      ? ((rowFx.data as any).error as string | null)
      : null;

  const fxState =
    rowFx.state !== "idle" &&
      rowFx.formData?.get("id") === o.id &&
      (rowFx.formData?.get("_action") === "saveRow" || rowFx.formData?.get("_action") === "cancelRow")
      ? rowFx.state
      : "idle";
  const savingIcon =
    fxState !== "idle" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />;

  return (
    <li key={o.id} className="flex flex-col">
      <div className={COLS + " bg-white px-1 border-b border-b-gray-50 pb-1"}>
        <rowFx.Form method="post" className="contents" id={`row-form-${o.id}`}>
          <input type="hidden" name="_action" value="saveRow" />
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="date" value={dateStr} />
          <input type="hidden" name="deliveryZoneId" value={deliveryZoneId ?? ""} />
          <input type="hidden" name="isCreditCard" value={isCreditCard ? "on" : ""} />

          {/* nº comanda */}
          <div className="flex items-center justify-center">
            <CommandNumberInput value={cmdLocal} onChange={setCmdLocal} isVendaLivre={isVendaLivre} />
            <input type="hidden" name="commandNumber" value={cmdLocal ?? ""} />
          </div>

          {/* Pedido (R$) + ícone Cartão (à direita) */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <MoneyInput
                name="orderAmount"
                defaultValue={o.orderAmount}
                className="w-28"
                disabled={readOnly}
              />

              {/* Ícone de cartão: preto = true, cinza = false */}
              <button
                type="button"
                onClick={() => setIsCreditCard((v) => !v)}
                className={`h-9 w-9 grid place-items-center rounded-md border transition
                            ${readOnly ? "pointer-events-none opacity-60" : "hover:bg-slate-50"}
                            ${isCreditCard ? "border-blue-600" : "border-slate-200"}`}
                title="Pago no cartão"
                aria-pressed={isCreditCard}
              >
                <CreditCard className={`h-6 w-6 ${isCreditCard ? "text-blue-600" : "text-slate-300"}`} />
              </button>
            </div>
          </div>

          {/* Tamanhos */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <input type="hidden" name="sizeF" value={sizes.F} />
              <input type="hidden" name="sizeM" value={sizes.M} />
              <input type="hidden" name="sizeP" value={sizes.P} />
              <input type="hidden" name="sizeI" value={sizes.I} />
              <input type="hidden" name="sizeFT" value={sizes.FT} />
              <div className={`origin-center ${readOnly ? "opacity-60 pointer-events-none" : "scale-[0.95]"}`}>
                <SizeSelector
                  counts={sizes}
                  limit={sizeLimit ?? undefined}
                  onChange={(next) => {
                    setSizes(next);
                    const formEl = document.getElementById(`row-form-${o.id}`) as HTMLFormElement | null;
                    if (!formEl) return;
                    (formEl.querySelector('input[name="sizeF"]') as HTMLInputElement).value = String(next.F);
                    (formEl.querySelector('input[name="sizeM"]') as HTMLInputElement).value = String(next.M);
                    (formEl.querySelector('input[name="sizeP"]') as HTMLInputElement).value = String(next.P);
                    (formEl.querySelector('input[name="sizeI"]') as HTMLInputElement).value = String(next.I);
                    (formEl.querySelector('input[name="sizeFT"]') as HTMLInputElement).value = String(next.FT);
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* Canal */}
          <div className="flex justify-center">
            <Select name="channel" defaultValue={(o.channel ?? "").trim()}>
              <SelectTrigger className={`h-9 w-[240px] truncate ${readOnly ? "opacity-60 pointer-events-none" : ""}`} disabled={readOnly}>
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(sem canal)</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DELIVERY (switch + zona + valor moto) */}
          <div className="flex items-center justify-center gap-2">
            <div className={`flex items-center gap-2 ${readOnly ? "opacity-60" : ""}`}>
              <Switch
                checked={hasMoto}
                onCheckedChange={(next) => {
                  setHasMoto(next);
                  if (next) {
                    setTakeAway(false);
                    setMotoDefault(10);
                    setMotoKey((k) => k + 1);
                  }
                  if (!next) {
                    setDeliveryZoneId(null);
                    setMotoDefault(0);
                    setMotoKey((k) => k + 1);
                  }
                }}
                id={`delivery-${o.id}`}
                disabled={readOnly}
                title="Delivery on/off"
              />
              <input type="hidden" name="hasMoto" value={hasMoto ? "on" : ""} />
            </div>

            <DeliveryZoneCombobox
              options={deliveryZones}
              value={deliveryZoneId}
              onChange={setDeliveryZoneId}
              disabled={readOnly || !hasMoto || o.isVendaLivre === true}
              className="w-[180px]"
            />

            <MoneyInput
              key={motoKey}
              name="motoValue"
              defaultValue={motoDefault}
              className="w-24"
              disabled={readOnly || hasMoto === false}
            />
          </div>

          {/* Retirada */}
          <div className={`flex items-center justify-center ${readOnly ? "opacity-60" : ""}`}>
            <Switch
              checked={takeAway}
              onCheckedChange={setTakeAway}
              id={`ret-${o.id}`}
              disabled={readOnly || hasMoto === true}
              title="Retirada"
            />
            <input type="hidden" name="takeAway" value={takeAway ? "on" : ""} />
          </div>

          {/* Detalhes */}
          <div className="flex items-center justify-center">
            <Button type="button" variant="ghost" title="Detalhes" onClick={() => setDetailsOpenId(true)}>
              <Ellipsis className="w-4 h-4" />
            </Button>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-center gap-2">
            <Button type="submit" variant="outline" title="Salvar" disabled={readOnly}>
              {savingIcon}
            </Button>
            <Button
              type="button"
              variant="ghost"
              title="Excluir"
              className="hover:bg-red-50"
              onClick={() => setOpenConfirmId(true)}
              disabled={readOnly}
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>

          {/* Confirmar exclusão */}
          <ConfirmDeleteDialog
            open={openConfirmId}
            onOpenChange={(v) => !v && setOpenConfirmId(false)}
            onConfirm={() => {
              const fd = new FormData();
              fd.set("_action", "cancelRow");
              fd.set("id", o.id);
              fd.set("date", dateStr);
              rowFx.submit(fd, { method: "post" });
              setOpenConfirmId(false);
            }}
          />

          {/* Detalhes (muda status) */}
          <DetailsDialog
            open={detailsOpenId}
            onOpenChange={(v) => !v && setDetailsOpenId(false)}
            createdAt={(o as any).novoPedidoAt as any}
            nowMs={nowMs}
            status={o.status ?? "pendente"}
            onStatusChange={(value) => {
              if (readOnly) return;
              const fd = new FormData();
              fd.set("_action", "saveRow");
              fd.set("id", o.id);
              fd.set("date", dateStr);
              fd.set("status", value);
              fd.set("commandNumber", String(cmdLocal ?? ""));
              fd.set("orderAmount", String(o.orderAmount ?? 0));
              fd.set("motoValue", String(o.motoValue ?? 0));
              fd.set("hasMoto", hasMoto ? "on" : "");
              fd.set("takeAway", takeAway ? "on" : "");
              const sc = parseSize(o.size);
              fd.set("sizeF", String(sc.F));
              fd.set("sizeM", String(sc.M));
              fd.set("sizeP", String(sc.P));
              fd.set("sizeI", String(sc.I));
              fd.set("sizeFT", String(sc.FT));
              fd.set("channel", String((o.channel ?? "").trim()));
              fd.set("deliveryZoneId", String(deliveryZoneId ?? ""));
              fd.set("isCreditCard", String(isCreditCard ? "on" : ""));
              rowFx.submit(fd, { method: "post" });
            }}
            onSubmit={() => setDetailsOpenId(false)}
            orderAmount={Number(o.orderAmount ?? 0)}
            motoValue={Number(o.motoValue ?? 0)}
            sizeSummary={sizeSummary(parseSize(o.size))}
            channel={(o.channel ?? "").trim()}
          />
        </rowFx.Form>
      </div>

      {/* Linha extra com info e previsões */}
      <div className="px-2 py-1 text-xs text-slate-500 flex flex-wrap items-center gap-4">
        <span className="font-medium text-slate-600">{statusText}</span>

        {statusText !== "pendente" && npAt && (
          <>
            <span className="text-muted-foreground">Criado: </span>
            <span className="font-semibold">{fmtHHMM(npAt as any)}</span>

            {(() => {
              const diffMin = Math.floor((nowMs - npAt.getTime()) / 60000);
              let color = "text-slate-500";
              if (diffMin >= 60) color = "text-red-500";
              else if (diffMin >= 45) color = "text-orange-500";

              return (
                <span>
                  <span className="text-muted-foreground">Decorrido: </span>
                  <span className={cn("font-semibold", color)}>
                    {fmtElapsedHHMM(npAt as any, nowMs)}
                  </span>
                </span>
              );
            })()}

            {(() => {
              const pred = predictions.get(o.id);
              if (!pred) return null;

              const isPickup = (o as any).takeAway === true && (o as any).hasMoto !== true;

              return (
                <>
                  <span>
                    <span className="text-muted-foreground">{isPickup ? "Retirar às: " : "Pronta às: "}</span>
                    <span className="font-semibold">{fmtHHMM(pred.readyAtMs)}</span>
                  </span>

                  {!isPickup && pred.arriveAtMs && (
                    <span>
                      <span className="text-muted-foreground">Na casa às: </span>
                      <span className="font-semibold">{fmtHHMM(pred.arriveAtMs)}</span>
                    </span>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      <Separator className="my-1" />

      {rowError && (
        <div className="px-2 pb-1 text-xs text-red-600">{rowError}</div>
      )}
    </li>
  );
}

/* ===========================
   Skeleton de linhas
   =========================== */
function RowsSkeleton() {
  return (
    <ul className="space-y-1" aria-busy="true" aria-live="polite">
      {Array.from({ length: 12 }).map((_, i) => (
        <li key={i} className="rounded border p-3 bg-slate-50 h-14 animate-pulse" />
      ))}
    </ul>
  );
}

/* ===========================
   Página (Grid)
   =========================== */
export default function GridKdsPage() {
  const { dateStr, items, header, deliveryZones, dzTimes, dashboard, doughStock, doughUsage, availableSizes } = useLoaderData<typeof loader>();
  const listFx = useFetcher();
  const rowFx = useFetcher();
  const stockFx = useFetcher<{ ok: boolean; stock: DoughStockSnapshot }>();

  const status = (header?.operationStatus ?? "PENDING") as "PENDING" | "OPENED" | "CLOSED" | "REOPENED";
  const isClosed = status === "CLOSED";
  const readOnly = isClosed;

  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState(5);
  const [openError, setOpenError] = useState<string | null>(null);

  const [channelFilter, setChannelFilter] = useState<string>("");

  // ← estado do botão de cartão na Venda Livre rápida
  const [vlIsCreditCard, setVlIsCreditCard] = useState(false);

  const stockSnapshot: DoughStockSnapshot | null =
    (stockFx.data?.stock as DoughStockSnapshot | undefined) ?? (doughStock as DoughStockSnapshot | null);
  const baseStock = stockSnapshot?.base ?? defaultSizeCounts();
  const effectiveStock = stockSnapshot?.effective ?? defaultSizeCounts();
  const [adjustmentDraft, setAdjustmentDraft] = useState<SizeCounts>(effectiveStock);
  const [editingBar, setEditingBar] = useState(false);

  const sizeLabelMap = useMemo(() => {
    const base = { ...SIZE_LABELS } as Record<keyof SizeCounts, string>;
    (availableSizes as DoughSizeOption[]).forEach((s) => {
      base[s.key] = s.label || s.key;
    });
    return base;
  }, [availableSizes]);

  const [showStockPanel, setShowStockPanel] = useState(() => true);
  const [floatingTop, setFloatingTop] = useState(160);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging) return;
      const next = Math.min(Math.max(80, e.clientY - 30), window.innerHeight - 140);
      setFloatingTop(next);
    }
    function onUp() { setDragging(false); }
    if (dragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    setAdjustmentDraft(stockSnapshot?.effective ?? defaultSizeCounts());
  }, [stockSnapshot, dateStr]);

  function setAdjustmentValue(key: keyof SizeCounts, value: number | string) {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
    setAdjustmentDraft((prev) => ({ ...prev, [key]: safe }));
  }

  useEffect(() => {
    let t: any;
    if (opening) {
      setProgress(5);
      t = setInterval(() => setProgress((p) => Math.min(95, p + 7)), 250);
    }
    return () => clearInterval(t);
  }, [opening]);

  useEffect(() => {
    if (listFx.state === "submitting" && listFx.formData?.get("_action") === "openDay") {
      setOpening(true);
      setOpenError(null);
    }
    if (opening && listFx.state === "idle") {
      const data = listFx.data as any;
      if (data?.ok) {
        setProgress(100);
        setTimeout(() => setOpening(false), 600);
      } else {
        setOpenError(data?.error ?? "Falha ao abrir o dia");
      }
    }
  }, [listFx.state, opening, listFx.data]);

  const nowMs = Date.now();

  // Cores do status de meta
  const statusColor =
    dashboard.status === "hit-target" ? "bg-emerald-50 text-emerald-900 border-emerald-200" :
      dashboard.status === "between" ? "bg-amber-50 text-amber-900 border-amber-200" :
        "bg-rose-50 text-rose-900 border-rose-200";

  return (
    <div className="space-y-4 mt-12">
      {/* Toolbar topo + Painel-resumo SEM suspense (feedback imediato) */}
      <div className="flex flex-col gap-y-4 md:grid md:grid-cols-12 items-start">
        {/* Toolbar topo */}
        <div className="flex flex-wrap items-center gap-3 col-span-4">
          {(!header?.id || status === "PENDING") && (
            <listFx.Form method="post" className="flex items-center gap-2">
              <input type="hidden" name="_action" value="openDay" />
              <input type="hidden" name="date" value={dateStr} />
              <Input name="qty" defaultValue={40} className="h-9 w-20 text-center" />
              <Button type="submit" variant="default" disabled={listFx.state !== "idle"} className="bg-blue-800">
                {listFx.state !== "idle" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" /> Abrindo…
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 mr-1" />
                    Abrir dia
                  </>
                )}
              </Button>
            </listFx.Form>
          )}

          {status === "OPENED" && (
            <listFx.Form method="post" className="flex items-center gap-2">
              <input type="hidden" name="_action" value="closeDay" />
              <input type="hidden" name="date" value={dateStr} />
              <Button type="submit" variant="secondary">
                <Lock className="w-4 h-4 mr-2" /> Fechar dia
              </Button>
            </listFx.Form>
          )}

          {status === "REOPENED" && (
            <>
              <div className="px-3 py-1 rounded border text-sm bg-amber-50 text-amber-900">
                Dia reaberto (edição liberada, sem novos registros)
                <span className="text-xs text-slate-500 ml-2">(Atalho: pressione <b>M</b> para ver o mês)</span>
              </div>
              <listFx.Form method="post" className="flex items-center gap-2">
                <input type="hidden" name="_action" value="closeDay" />
                <input type="hidden" name="date" value={dateStr} />
                <Button type="submit" variant="secondary">
                  <Lock className="w-4 h-4 mr-2" /> Fechar dia
                </Button>
              </listFx.Form>
            </>
          )}

          {status === "CLOSED" && (
            <>
              <div className="ml-2 px-3 py-1 rounded border text-sm bg-slate-50 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Dia fechado (somente leitura)
              </div>
              <listFx.Form method="post" className="flex items-center gap-2">
                <input type="hidden" name="_action" value="reopenDay" />
                <input type="hidden" name="date" value={dateStr} />
                <Button type="submit" variant="ghost">
                  <Unlock className="w-4 h-4 mr-2" /> Reabrir dia
                </Button>
              </listFx.Form>
            </>
          )}
        </div>

        {/* Painel-resumo de metas e receita + link estoque */}
        <div className={cn("rounded-lg border p-3 col-span-8", statusColor)}>
          <div className="flex items-center gap-2 mb-2">
            <BadgeDollarSign className="w-5 h-5" />
            <div className="font-semibold">Meta financeira do dia</div>
            <div className="ml-auto flex items-center gap-3 text-xs opacity-70">
              <span>Taxa cartão: {dashboard.cardFeePerc?.toFixed(2)}% · Imposto: {dashboard.taxPerc?.toFixed(2)}% · Taxa Marketplace: {dashboard.marketplaceTaxPerc?.toFixed(2)}%</span>

            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <div>
              <div className="opacity-70">Receita Bruta</div>
              <div className="font-semibold">{fmtBRL(dashboard.grossAmount)}</div>
            </div>
            <div>
              <div className="opacity-70">Receita Líquida</div>
              <div className="font-semibold">{fmtBRL(dashboard.netAmount)}</div>
            </div>
            <div>
              <div className="opacity-70">Meta Mínima (dia)</div>
              <div className="font-semibold">{fmtBRL(dashboard.goalMinAmount)}</div>
            </div>
            <div>
              <div className="opacity-70">Meta Target (dia)</div>
              <div className="font-semibold">{fmtBRL(dashboard.goalTargetAmount)}</div>
            </div>
            <div>
              <div className="opacity-70">% da Target</div>
              <div className="font-semibold">{dashboard.pctOfTarget.toFixed(0)}%</div>
            </div>
            <div>
              <div className="opacity-70">Status</div>
              <div className="font-semibold">
                {dashboard.status === "hit-target" ? "Atingiu a target" :
                  dashboard.status === "between" ? "Acima da mínima" :
                    "Abaixo da mínima"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="rounded-lg border p-3 text-sm text-slate-500">Carregando estoque de massa…</div>}>
        <Await resolve={doughUsage}>
          {(used: SizeCounts) => {
            return null; // estoque inicial é gerido na página dedicada
          }}
        </Await>
      </Suspense>

      <Suspense fallback={null}>
        <Await resolve={doughUsage}>
          {(used: SizeCounts) => {
            const effectiveCounts = stockSnapshot?.effective ?? defaultSizeCounts();
            const baseCounts = baseStock ?? defaultSizeCounts();
            const remaining = calcRemaining(effectiveCounts, used);
            const ordered = (availableSizes as DoughSizeOption[]) ?? [];
            const manual = effectiveCounts;
            const hasManualInfo = (["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[])
              .some((k) => manual[k] > 0);
            const manualText = ordered
              .map(({ key, abbr }) => ({ key, abbr, value: manual[key] ?? 0 }))
              .filter((item) => item.value > 0)
              .map((item) => `${item.abbr || item.key}: ${item.value}`)
              .join(" · ");

            function chipClasses(k: keyof SizeCounts) {
              const init = effectiveCounts[k];
              if (init <= 0) return "border border-slate-200 text-slate-500 bg-white";
              const ratio = remaining[k] / init;
              console.log({ init, remaining: remaining[k], ratio })
              if (remaining[k] === 0) return "bg-rose-500 text-white"; // crítico
              if (remaining[k] <= 2) return "bg-amber-400 text-slate-900"; // alerta
              if (remaining[k] < 3) return "border border-rose-500 text-rose-600 bg-white";
              return "bg-emerald-500 text-white"; // ok
            }

            return (
              <div
                className="fixed right-5 z-40"
                style={{ top: `${floatingTop}px` }}
              >
                <stockFx.Form
                  method="post"
                  className="rounded-full border bg-white shadow-lg px-3 py-2 flex items-center gap-3 backdrop-blur"
                  onSubmit={() => setEditingBar(false)}
                >
                  <input type="hidden" name="_action" value="saveDoughStock" />
                  <input type="hidden" name="date" value={dateStr} />

                  <div
                    className="flex items-center justify-center w-7 h-7 rounded text-slate-600 hover:bg-slate-200 cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => { setDragging(true); e.preventDefault(); }}
                    role="presentation"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex items-center gap-2">
                    {ordered.map(({ key, label, abbr }) => (
                      <div key={key} className="flex flex-col items-center gap-1 min-w-[60px]">
                        <input type="hidden" name={`stock${key}`} value={baseCounts[key]} />
                        <input type="hidden" name={`adjust${key}`} value={adjustmentDraft[key]} />

                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold ${chipClasses(key)}`}
                          title={`${label}: ${Math.max(0, remaining[key])}`}
                        >
                          {abbr || key} {Math.max(0, remaining[key])}
                        </div>

                        {editingBar && (
                          <div className="flex items-center gap-0 text-[11px] text-slate-600">
                            <button
                              type="button"
                              className="h-6 w-6 rounded-full border border-slate-200 hover:bg-slate-50 font-semibold"
                              onClick={() => setAdjustmentValue(key, (adjustmentDraft[key] ?? 0) - 1)}
                            >
                              –
                            </button>
                            <NumericInput
                              min={0}
                              step={1}
                              className="h-6 w-12 text-center rounded bg-white text-xs font-semibold border-none"
                              value={adjustmentDraft[key]}
                              onChange={(e) => setAdjustmentValue(key, e.target.value)}
                              aria-label={`Ajuste ${label}`}
                            />
                            <button
                              type="button"
                              className="h-6 w-6 rounded-full border border-slate-200 hover:bg-slate-50"
                              onClick={() => setAdjustmentValue(key, (adjustmentDraft[key] ?? 0) + 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* {hasManualInfo && !editingBar && (
                    <div className="text-[11px] text-slate-500 ml-1">
                      Saldo manual: {manualText}
                    </div>
                  )} */}

                  {editingBar ? (
                    <div className="flex items-center gap-2">
                      <Button type="submit" size="sm" variant="secondary" disabled={stockFx.state !== "idle"}>
                        {stockFx.state !== "idle" ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Salvando…
                          </>
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAdjustmentDraft(stockSnapshot?.effective ?? defaultSizeCounts());
                          setEditingBar(false);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingBar(true)}
                      className="text-slate-700"
                    >
                      <PencilLine className="w-4 h-4 mr-1" />
                    </Button>
                  )}
                </stockFx.Form>
              </div>
            );
          }}
        </Await>
      </Suspense>

      {/* Venda livre rápida + Filtro de Canal */}
      {(status === "OPENED" || status === "REOPENED") && (
        <>

          <div className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3">
            {/* Venda Livre rápida */}
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">Venda livre (rápida)</div>
              <listFx.Form method="post" className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="_action" value="createVL" />
                <input type="hidden" name="date" value={dateStr} />

                <MoneyInput name="orderAmount" />

                {/* hidden para enviar o cartão no submit */}
                <input type="hidden" name="isCreditCard" value={vlIsCreditCard ? "on" : ""} />

                {/* Ícone Cartão (preto ativo / cinza inativo) */}
                <button
                  type="button"
                  onClick={() => setVlIsCreditCard(v => !v)}
                  className={`h-9 w-9 grid place-items-center rounded-md border transition
                              hover:bg-slate-50
                              ${vlIsCreditCard ? "border-blue-800" : "border-slate-200"}`}
                  title="Pago no cartão"
                  aria-pressed={vlIsCreditCard}
                >
                  <CreditCard className={`h-6 w-6 ${vlIsCreditCard ? "text-blue-800" : "text-slate-300"}`} />
                </button>

                <Button type="submit" variant="secondary" disabled={listFx.state !== "idle"}>
                  {listFx.state !== "idle" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" /> Adicionando…
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
              </listFx.Form>
            </div>

            {/* Filtro por Canal */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Filtrar canal:</span>
              <Select value={channelFilter} onValueChange={(val) => setChannelFilter(val)}>
                <SelectTrigger className="w-[240px] h-9">
                  <SelectValue placeholder="Todos os canais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cabeçalho */}
          <div className={COLS_HDR + " py-2 px-1"}>
            <div className="text-center">#</div>
            <div className="text-center">Pedido (R$)</div>
            <div className="text-center">Tamanhos</div>
            <div className="text-center">Canal</div>
            <div className="text-center">Delivery</div>
            <div className="text-center">Retirada</div>
            <div className="text-center">Detalhes</div>
            <div className="text-center">Ações</div>
          </div>
        </>
      )}

      {/* ========== SOMENTE AS LINHAS EM SUSPENSE ==========
          Ao trocar a data, o topo fica estável e aqui mostramos skeleton */}
      <Suspense key={dateStr} fallback={<RowsSkeleton />}>
        <Await resolve={items}>
          {(rowsDb: OrderRow[]) => {
            const dup = duplicateCommandNumbers(rowsDb);
            const globalUsage = useMemo(() => sumSizes(rowsDb), [rowsDb]);

            const dzMap = useMemo(() => buildDzMap(dzTimes as any), [dzTimes]);
            const operatorCount = useMemo(() => getOperatorCountByDate(dateStr), [dateStr]);
            const riderCount = useMemo(() => getRiderCountByDate(dateStr), [dateStr]);

            const predictions = useMemo(() => {
              const eligible = rowsDb.filter((o) => {
                const st = (o as any).status ?? "pendente";
                const npAt = (o as any).novoPedidoAt ?? null;
                return st !== "pendente" && !!npAt;
              });
              const minimal: MinimalOrderRow[] = eligible.map((o) => ({
                id: o.id,
                createdAt: (o as any).novoPedidoAt as any,
                finalizadoAt: (o as any).finalizadoAt ?? null,
                size: o.size,
                hasMoto: (o as any).hasMoto ?? null,
                takeAway: (o as any).takeAway ?? null,
                deliveryZoneId: (o as any).deliveryZoneId ?? null,
              }));

              const ready = predictReadyTimes(minimal, operatorCount, nowMs);
              const arrive = predictArrivalTimes(ready, riderCount, dzMap);

              const byId = new Map<string, { readyAtMs: number; arriveAtMs: number | null }>();
              for (const r of ready) byId.set(r.id, { readyAtMs: r.readyAtMs, arriveAtMs: null });
              for (const a of arrive) {
                const cur = byId.get(a.id);
                if (cur) cur.arriveAtMs = a.arriveAtMs;
              }
              return byId;
            }, [rowsDb, operatorCount, riderCount, dzMap, nowMs]);

            const filteredRows = useMemo(() => {
              if (!channelFilter) return rowsDb;
              const wanted = channelFilter;
              return rowsDb.filter((o) => ((o.channel ?? "").trim() === wanted));
            }, [rowsDb, channelFilter]);

            return (
              <>
                {dup.length > 0 && (
                  <div className="flex items-center gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded px-3 py-2 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Comandas duplicadas no dia: <b className="ml-1">{dup.join(", ")}</b>
                  </div>
                )}

                {/* Linhas */}
                <ul className="space-y-1">
                  {filteredRows.map((o) => {
                    const sizeLimit = (() => {
                      if (!stockSnapshot?.effective) return null;
                      const currentSize = parseSize(o.size);
                      return {
                        F: Math.max(0, stockSnapshot.effective.F - (globalUsage.F - currentSize.F)),
                        M: Math.max(0, stockSnapshot.effective.M - (globalUsage.M - currentSize.M)),
                        P: Math.max(0, stockSnapshot.effective.P - (globalUsage.P - currentSize.P)),
                        I: Math.max(0, stockSnapshot.effective.I - (globalUsage.I - currentSize.I)),
                        FT: Math.max(0, stockSnapshot.effective.FT - (globalUsage.FT - currentSize.FT)),
                      } as SizeCounts;
                    })();

                    return (
                      <RowItem
                        key={o.id}
                        o={o}
                        dateStr={dateStr}
                        readOnly={isClosed}
                        deliveryZones={deliveryZones as any}
                        nowMs={nowMs}
                        predictions={predictions}
                        rowFx={rowFx}
                        sizeLimit={sizeLimit}
                      />
                    );
                  })}
                </ul>
              </>
            );
          }}
        </Await>
      </Suspense>

      {status === "OPENED" && (
        <>
          <Separator className="my-4" />
          <listFx.Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="_action" value="addMore" />
            <input type="hidden" name="date" value={dateStr} />
            <Button type="submit" disabled={listFx.state !== "idle"}>
              Adicionar mais
            </Button>
            <Input name="more" defaultValue={20} className="h-9 w-28 text-center" />
          </listFx.Form>
        </>
      )}

      <OpeningDayOverlay
        open={opening || !!openError}
        progress={progress}
        hasError={!!openError}
        errorMessage={openError}
        onClose={() => { setOpening(false); setOpenError(null); }}
      />
    </div>
  );
}
