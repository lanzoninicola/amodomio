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
  computeReadyAtMap,
  buildTimelineBuckets,
  PREP_MINUTES_PER_SIZE,
  type MinimalOrderRow,
  type TimelineBucket,
  type ReadyAtMap,
  parseSizeSafe,
} from "@/domain/kds/delivery-prediction";
import { calcProductionMinutes } from "@/domain/kds/delivery-prediction/production-time";

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
  Clock4,
  Bike,
  Settings as SettingsIcon,
  CalendarClock,
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
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DzMap } from "@/domain/kds/delivery-prediction/delivery-time";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

function fmtMinutesHHMM(totalMin: number) {
  const safe = Math.max(0, Math.round(totalMin));
  const hh = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const mm = (safe % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

type PredictionSettings = {
  mode: "real" | "theoretical";
  prepMinutes: Record<keyof SizeCounts, number>;
  operatorCount: number;
};

const DEFAULT_PREDICTION_SETTINGS: PredictionSettings = {
  mode: "theoretical",
  prepMinutes: PREP_MINUTES_PER_SIZE,
  operatorCount: 2,
};

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

  const settingsRow = await prisma.setting.findFirst({
    where: { context: "kds_prediction", name: "config" },
  });
  let predictionSettings = {
    ...DEFAULT_PREDICTION_SETTINGS,
    operatorCount: getOperatorCountByDate(dateStr),
  };
  if (settingsRow?.value) {
    try {
      const parsed = JSON.parse(settingsRow.value);
      predictionSettings = {
        mode: parsed?.mode === "theoretical" ? "theoretical" : "real",
        prepMinutes: {
          ...PREP_MINUTES_PER_SIZE,
          ...parsed?.prepMinutes,
        },
        operatorCount: Number(parsed?.operatorCount) || getOperatorCountByDate(dateStr),
      };
    } catch {
      // fallback permanece
    }
  }

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
    predictionSettings,
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

    if (_action === "savePredictionSettings") {
      const modeRaw = String(form.get("mode") ?? "real");
      const operatorCount = Math.max(1, Number(form.get("operatorCount") ?? 1) || 1);
      const prepMinutes = {
        F: Number(form.get("prepF") ?? PREP_MINUTES_PER_SIZE.F) || PREP_MINUTES_PER_SIZE.F,
        M: Number(form.get("prepM") ?? PREP_MINUTES_PER_SIZE.M) || PREP_MINUTES_PER_SIZE.M,
        P: Number(form.get("prepP") ?? PREP_MINUTES_PER_SIZE.P) || PREP_MINUTES_PER_SIZE.P,
        I: Number(form.get("prepI") ?? PREP_MINUTES_PER_SIZE.I) || PREP_MINUTES_PER_SIZE.I,
        FT: Number(form.get("prepFT") ?? PREP_MINUTES_PER_SIZE.FT) || PREP_MINUTES_PER_SIZE.FT,
      };

      const payload = {
        mode: modeRaw === "theoretical" ? "theoretical" : "real",
        operatorCount,
        prepMinutes,
      };

      const existing = await prisma.setting.findFirst({
        where: { context: "kds_prediction", name: "config" },
      });
      if (existing?.id) {
        await prisma.setting.update({
          where: { id: existing.id },
          data: {
            type: "json",
            value: JSON.stringify(payload),
          },
        });
      } else {
        await prisma.setting.create({
          data: {
            context: "kds_prediction",
            name: "config",
            type: "json",
            value: JSON.stringify(payload),
            createdAt: new Date(),
          },
        });
      }

      return json({ ok: true, settings: payload });
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
  prepMinutesPerSize,
}: {
  o: OrderRow;
  dateStr: string;
  readOnly: boolean;
  deliveryZones: { id: string; name: string }[];
  nowMs: number;
  predictions: Map<string, { readyAtMs: number; arriveAtMs: number | null }>;
  rowFx: ReturnType<typeof useFetcher>;
  sizeLimit?: SizeCounts | null;
  prepMinutesPerSize: Record<keyof SizeCounts, number>;
}) {
  const sizeCounts = parseSize(o.size);
  const prepMinutes = useMemo(
    () => calcProductionMinutes(sizeCounts, prepMinutesPerSize),
    [sizeCounts, prepMinutesPerSize]
  );

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

            <span>
              <span className="text-muted-foreground">Tempo de preparo: </span>
              <span className="font-semibold">{fmtMinutesHHMM(prepMinutes)}</span>
            </span>

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
   Timeline (Sheet)
   =========================== */
function TimelineSidebar({
  buckets,
  lastReadyAt,
  nowMs,
  orderLabels,
  readyAtMap,
}: {
  buckets: TimelineBucket[];
  lastReadyAt: number | null;
  nowMs: number;
  orderLabels: Map<string, string>;
  readyAtMap: Map<string, number>;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const slots = useMemo(() => {
    return buckets
      .map((b) => {
        const ids = b.orderIds.filter((id) => !dismissed.has(id));
        return { ...b, orderIds: ids, count: ids.length };
      })
      .filter((b) => b.orderIds.length > 0 || buckets.length <= 0);
  }, [buckets, dismissed]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col ">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-lg">
          <Clock4 className="h-5 w-5 text-blue-700" />
          Linha do tempo de saída
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-4 flex-1 flex flex-col">
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="text-sm text-slate-600">Último pedido previsto para sair às:</div>
          <div className="text-2xl font-semibold text-blue-700 leading-tight">
            {lastReadyAt ? fmtHHMM(lastReadyAt) : "Nenhum pedido em produção"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Baseado no tempo médio por tamanho e nº de operadores. Agora: {fmtHHMM(nowMs)}
          </div>
        </div>

        <ScrollArea className="flex-1 pr-3 overflow-y-scroll">
          <div className="space-y-3 pb-6 h-[calc(100vh-8rem)]">
            {slots.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500 bg-white">
                Nenhum pedido em produção no momento.
              </div>
            )}

            {slots.map((slot) => {
              const labels = slot.orderIds.map((id) => ({
                id,
                label: orderLabels.get(id) ?? "#?",
                readyAt: readyAtMap.get(id) ?? null,
              }));
              const isCurrentSlot = slot.isCurrent;

              return (
                <div
                  key={slot.slotStartMs}
                  className={cn(
                    "relative p-3 transition-colors border-b-1 mb-2 hover:bg-slate-100",
                    isCurrentSlot ? "border-emerald-300 bg-emerald-50" : "bg-white"
                  )}
                >
                  <div className="absolute left-3 top-0 bottom-0 border-l border-dashed border-slate-200" aria-hidden />

                  <div className="flex items-center justify-between gap-3 ml-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900 font-mono">{slot.label}</div>
                      {isCurrentSlot && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-label="Horário atual" />}
                      {slot.isPast && !slot.isCurrent && (
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Passado</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {slot.count} pedido{slot.count === 1 ? "" : "s"} neste slot
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    {labels.length === 0 ? (
                      <span className="text-xs text-slate-400">Sem pedidos</span>
                    ) : (
                      labels.map((l, idx) => (
                        <Badge
                          key={`${slot.slotStartMs}-${l.id}-${idx}`}
                          variant="outline"
                          className={cn(
                            "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                            isCurrentSlot
                              ? "border-emerald-400 bg-white text-emerald-700"
                              : "border-amber-400 bg-amber-50 text-amber-700"
                          )}
                        >
                          <span>{l.label}</span>
                          {l.readyAt && (
                            <span className="text-[10px] text-slate-500 font-mono">· {fmtHHMM(l.readyAt)}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDismiss(l.id)}
                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-100"
                            title="Pedido despachado"
                          >
                            <Bike className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

type PredictionData = {
  // Previsão real (considera fila e operadores)
  realPredictions: Map<string, { readyAtMs: number; arriveAtMs: number | null }>;
  realReadyMap: ReadyAtMap;
  realTimelineReadyMap: ReadyAtMap;
  realTimelineBuckets: TimelineBucket[];
  realLastReadyAt: number | null;

  // Previsão teórica (fila ideal desde o primeiro pedido)
  theoreticalPredictions: Map<string, { readyAtMs: number; arriveAtMs: number | null }>;
  theoreticalReadyMap: ReadyAtMap;
  theoreticalTimelineReadyMap: ReadyAtMap;
  theoreticalTimelineBuckets: TimelineBucket[];
  theoreticalLastReadyAt: number | null;

  orderLabelMap: Map<string, string>;
};

function computePredictionData(
  rowsDb: OrderRow[],
  operatorCount: number,
  riderCount: number,
  dzMap: DzMap,
  nowMs: number,
  prepMinutesPerSize: Record<keyof SizeCounts, number>
): PredictionData {
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

  const ready = predictReadyTimes(minimal, operatorCount, nowMs, prepMinutesPerSize);
  const arrive = predictArrivalTimes(ready, riderCount, dzMap);

  const byId = new Map<string, { readyAtMs: number; arriveAtMs: number | null }>();
  for (const r of ready) byId.set(r.id, { readyAtMs: r.readyAtMs, arriveAtMs: null });
  for (const a of arrive) {
    const cur = byId.get(a.id);
    if (cur) cur.arriveAtMs = a.arriveAtMs;
  }

  const orderLabelMap = new Map<string, string>();
  rowsDb.forEach((o) => {
    const label = o.commandNumber ? `#${o.commandNumber}` : "VL";
    orderLabelMap.set(o.id, label);
  });

  const inProduction = minimal.filter((o) => !o.finalizadoAt);

  const readyMap = computeReadyAtMap({
    orders: inProduction,
    operatorCount,
    prepMinutesPerSize,
    nowMs,
  });
  const baseMs =
    inProduction.length > 0
      ? Math.min(
        ...inProduction.map((o) =>
          o.createdAt ? new Date(o.createdAt as any).getTime() : Number.POSITIVE_INFINITY
        )
      )
      : nowMs;

  const theoreticalReadyMap = computeReadyAtMap({
    orders: inProduction,
    operatorCount,
    prepMinutesPerSize,
    nowMs: baseMs,
  });

  let realLastReadyAt: number | null = null;
  for (const ts of readyMap.values()) {
    if (realLastReadyAt === null || ts > realLastReadyAt) realLastReadyAt = ts;
  }

  let theoreticalLastReadyAt: number | null = null;
  for (const ts of theoreticalReadyMap.values()) {
    if (theoreticalLastReadyAt === null || ts > theoreticalLastReadyAt) theoreticalLastReadyAt = ts;
  }

  const timelineOrders = minimal; // inclui todos os pedidos em produção na timeline
  const timelineReadyMap = computeReadyAtMap({
    orders: timelineOrders,
    operatorCount,
    prepMinutesPerSize,
    nowMs,
  });
  const theoreticalTimelineReadyMap = computeReadyAtMap({
    orders: timelineOrders,
    operatorCount,
    prepMinutesPerSize,
    nowMs: baseMs,
  });

  const theoreticalPredictions = new Map<string, { readyAtMs: number; arriveAtMs: number | null }>();
  const theoreticalReadyList = minimal.map((o) => ({
    id: o.id,
    readyAtMs: theoreticalReadyMap.get(o.id) ?? nowMs,
    isDelivery: o.takeAway !== true && o.hasMoto === true,
    dzId: o.deliveryZoneId ?? null,
  }));
  const theoreticalArrivals = predictArrivalTimes(theoreticalReadyList, riderCount, dzMap);
  for (const r of theoreticalReadyList) theoreticalPredictions.set(r.id, { readyAtMs: r.readyAtMs, arriveAtMs: null });
  for (const a of theoreticalArrivals) {
    const cur = theoreticalPredictions.get(a.id);
    if (cur) cur.arriveAtMs = a.arriveAtMs;
  }

  const timelineBuckets = buildTimelineBuckets(timelineReadyMap, {
    nowMs,
    slotMinutes: 30,
    minSlots: 6,
  });

  const theoreticalTimelineBuckets = buildTimelineBuckets(theoreticalTimelineReadyMap, {
    nowMs,
    slotMinutes: 30,
    minSlots: 6,
  });

  return {
    realPredictions: byId,
    realReadyMap: readyMap,
    realTimelineReadyMap: timelineReadyMap,
    realTimelineBuckets: timelineBuckets,
    realLastReadyAt,
    theoreticalPredictions,
    theoreticalReadyMap,
    theoreticalTimelineReadyMap,
    theoreticalTimelineBuckets,
    theoreticalLastReadyAt,
    orderLabelMap,
  };
}

/* ===========================
   Página (Grid)
   =========================== */
export default function GridKdsPage() {
  const { dateStr, items, header, deliveryZones, dzTimes, dashboard, doughStock, doughUsage, availableSizes, predictionSettings } = useLoaderData<typeof loader>();
  const listFx = useFetcher();
  const rowFx = useFetcher();
  const stockFx = useFetcher<{ ok: boolean; stock: DoughStockSnapshot }>();
  const settingsFx = useFetcher<{ ok: boolean; settings: PredictionSettings }>();

  const status = (header?.operationStatus ?? "PENDING") as "PENDING" | "OPENED" | "CLOSED" | "REOPENED";
  const isClosed = status === "CLOSED";
  const readOnly = isClosed;

  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState(5);
  const [openError, setOpenError] = useState<string | null>(null);

  const [channelFilter, setChannelFilter] = useState<string>("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [predictionMode, setPredictionMode] = useState<"real" | "theoretical">(predictionSettings.mode ?? "theoretical");
  const [prepMinutesConfig, setPrepMinutesConfig] = useState<Record<keyof SizeCounts, number>>(
    predictionSettings.prepMinutes ?? PREP_MINUTES_PER_SIZE
  );
  const [operatorCountSetting, setOperatorCountSetting] = useState<number>(
    predictionSettings.operatorCount ?? getOperatorCountByDate(dateStr)
  );
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

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

  const dzMap = useMemo(() => buildDzMap(dzTimes as any), [dzTimes]);
  const operatorCount = useMemo(() => getOperatorCountByDate(dateStr), [dateStr]);
  const riderCount = useMemo(() => getRiderCountByDate(dateStr), [dateStr]);
  const operatorCountActive = operatorCountSetting || operatorCount;
  const prepMinutesActive = prepMinutesConfig || PREP_MINUTES_PER_SIZE;

  useEffect(() => {
    setPredictionMode(predictionSettings.mode ?? "real");
    setPrepMinutesConfig(predictionSettings.prepMinutes ?? PREP_MINUTES_PER_SIZE);
    setOperatorCountSetting(predictionSettings.operatorCount ?? getOperatorCountByDate(dateStr));
  }, [predictionSettings, dateStr]);

  useEffect(() => {
    if (settingsFx.state === "idle" && settingsFx.data?.ok) {
      const cfg = settingsFx.data.settings;
      setPredictionMode(cfg.mode ?? "real");
      setPrepMinutesConfig(cfg.prepMinutes ?? PREP_MINUTES_PER_SIZE);
      setOperatorCountSetting(cfg.operatorCount ?? getOperatorCountByDate(dateStr));
      setSettingsDialogOpen(false);
    }
  }, [settingsFx.state, settingsFx.data, dateStr]);

  // Cores do status de meta
  const statusColor =
    dashboard.status === "hit-target" ? "bg-emerald-50 text-emerald-900 border-emerald-200" :
      dashboard.status === "between" ? "bg-amber-50 text-amber-900 border-amber-200" :
        "bg-rose-50 text-rose-900 border-rose-200";
  const summaryCardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4 h-full";
  const statusDot =
    dashboard.status === "hit-target" ? "bg-emerald-500" :
      dashboard.status === "between" ? "bg-amber-500" :
        "bg-rose-500";
  const statusTextColor =
    dashboard.status === "hit-target" ? "text-emerald-700" :
      dashboard.status === "between" ? "text-amber-700" :
        "text-rose-700";
  const dayStatusBadge =
    status === "OPENED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
      status === "REOPENED" ? "bg-amber-50 text-amber-700 border-amber-200" :
        status === "CLOSED" ? "bg-slate-100 text-slate-700 border-slate-200" :
          "bg-slate-100 text-slate-700 border-slate-200";
  const dayStatusLabel =
    status === "OPENED" ? "Dia aberto" :
      status === "REOPENED" ? "Dia reaberto" :
        status === "CLOSED" ? "Dia fechado" :
          "Aguardando abertura";

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar topo + Painel-resumo SEM suspense (feedback imediato) */}


      <div className="grid gap-4 xl:grid-cols-8 items-stretch">
        <div className={`${summaryCardClass} xl:col-span-1`}>
          <div className="flex flex-col items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-4 w-4" /> Controle do dia
            </div>
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${dayStatusBadge} w-full text-center`}>
              {dayStatusLabel}
            </div>
          </div>

          <div className="space-y-3">
            {(!header?.id || status === "PENDING") && (
              <listFx.Form method="post" className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input type="hidden" name="_action" value="openDay" />
                <input type="hidden" name="date" value={dateStr} />
                <div className="flex flex-col items-center gap-2">
                  <Button type="submit" variant="default" disabled={listFx.state !== "idle"} className="bg-blue-800 w-full justify-center">
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
                  <NumericInput name="qty" defaultValue={40} className="h-10 w-full text-center" />
                </div>
              </listFx.Form>
            )}

            {status === "OPENED" && (
              <div className="flex flex-col gap-2">
                <listFx.Form method="post" className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="_action" value="closeDay" />
                  <input type="hidden" name="date" value={dateStr} />
                  <Button type="submit" variant="secondary" className="w-full">
                    <Lock className="w-4 h-4 mr-2" /> Fechar dia
                  </Button>
                </listFx.Form>
              </div>
            )}

            {status === "REOPENED" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <div className="font-semibold flex items-center gap-2">
                    <Unlock className="w-4 h-4" /> Dia reaberto
                  </div>
                  <div className="text-xs text-amber-800">
                    Edição liberada, sem novos registros.{" "}
                    <span className="text-slate-700">Atalho: pressione <b>M</b> para ver o mês.</span>
                  </div>
                </div>
                <listFx.Form method="post" className="flex items-center gap-2">
                  <input type="hidden" name="_action" value="closeDay" />
                  <input type="hidden" name="date" value={dateStr} />
                  <Button type="submit" variant="secondary" className="w-full">
                    <Lock className="w-4 h-4 mr-2" /> Fechar dia
                  </Button>
                </listFx.Form>
              </div>
            )}

            {status === "CLOSED" && (
              <div className="space-y-3">

                <listFx.Form method="post" className="flex flex-wrap items-center">
                  <input type="hidden" name="_action" value="reopenDay" />
                  <input type="hidden" name="date" value={dateStr} />
                  <Button type="submit" variant="secondary" className="justify-start w-full">
                    <Unlock className="w-4 h-4 mr-2" /> Reabrir dia
                  </Button>
                </listFx.Form>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-7">
          {/* previsao de saida + cards financeiros */}
          <Suspense
            key={`timeline-summary-${dateStr}`}
            fallback={<div className="rounded-lg border bg-white p-3 text-sm text-slate-500">Carregando previsão de saída…</div>}
          >
            <Await resolve={items}>
              {(rowsDb: OrderRow[]) => {
                const predictionData = useMemo(
                  () => computePredictionData(rowsDb, operatorCountActive, riderCount, dzMap, nowMs, prepMinutesActive),
                  [rowsDb, operatorCountActive, riderCount, dzMap, nowMs, prepMinutesActive]
                );
                const activeLastReady =
                  predictionMode === "real"
                    ? predictionData.realLastReadyAt
                    : predictionData.theoreticalLastReadyAt;
                const activeBuckets =
                  predictionMode === "real"
                    ? predictionData.realTimelineBuckets
                    : predictionData.theoreticalTimelineBuckets;
                const activeReadyMap =
                  predictionMode === "real"
                    ? predictionData.realTimelineReadyMap
                    : predictionData.theoreticalTimelineReadyMap;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full items-stretch">
                    {/* Card previsão */}
                    <div className={summaryCardClass}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Clock4 className="h-4 w-4" /> Previsão de saída
                          </div>
                          <p className="text-sm font-semibold text-slate-800">Último pedido</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[11px] font-semibold tracking-wide uppercase">
                            {predictionMode === "real" ? "Real" : "Teórico"}
                          </Badge>
                          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <SettingsIcon className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>Configurar previsão de saída</DialogTitle>
                              </DialogHeader>
                              <settingsFx.Form method="post" className="space-y-6">
                                <input type="hidden" name="_action" value="savePredictionSettings" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border rounded-lg p-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="mode" className="text-sm font-semibold">Modalidade de cálculo</Label>
                                    <Select name="mode" defaultValue={predictionMode}>
                                      <SelectTrigger id="mode">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="real">Real (fila + operadores a partir de agora)</SelectItem>
                                        <SelectItem value="theoretical">Teórico (fila ideal desde o primeiro pedido)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-slate-600">
                                      Real: usa o backlog atual com operadores. Teórico: reinicia a fila no horário do primeiro pedido.
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="operatorCount" className="text-sm font-semibold">Nº de operadores</Label>
                                    <Input
                                      id="operatorCount"
                                      name="operatorCount"
                                      type="number"
                                      min={1}
                                      defaultValue={operatorCountActive}
                                    />
                                    <p className="text-[11px] text-slate-600">Usado em ambos os modos.</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                  {(["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).map((k) => (
                                    <div key={k} className="space-y-1">
                                      <Label htmlFor={`prep-${k}`}>Tempo {k} (min)</Label>
                                      <Input
                                        id={`prep-${k}`}
                                        name={`prep${k}`}
                                        type="number"
                                        min={1}
                                        defaultValue={prepMinutesActive[k]}
                                      />
                                    </div>
                                  ))}
                                </div>

                                <DialogFooter className="gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setSettingsDialogOpen(false)}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button type="submit" disabled={settingsFx.state !== "idle"}>
                                    {settingsFx.state !== "idle" ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Salvar
                                  </Button>
                                </DialogFooter>
                              </settingsFx.Form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-3">
                        <div className="text-5xl font-black text-slate-900 tabular-nums">{activeLastReady ? fmtHHMM(activeLastReady) : "--:--"}</div>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">hora prevista</span>
                      </div>


                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-semibold"
                          onClick={() => setTimelineOpen(true)}
                          disabled={!activeBuckets.length}
                        >
                          Ver linha do tempo
                        </Button>
                        <div className="text-[11px] text-slate-500">
                          Operadores considerados: <span className="font-semibold text-slate-700">{operatorCountActive}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card financeiro */}
                    <div className={summaryCardClass}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <BadgeDollarSign className="h-4 w-4" /> Meta financeira do dia
                        </div>
                        <Badge variant="outline" className="text-[11px] font-semibold uppercase tracking-wide">
                          Receita
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Receita Líquida</div>
                          <div className="text-3xl font-extrabold text-emerald-700 tabular-nums">{fmtBRL(dashboard.netAmount)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Receita Bruta</div>
                          <div className="text-3xl font-bold text-slate-800 tabular-nums">{fmtBRL(dashboard.grossAmount)}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                        <span className="font-semibold text-slate-700">Taxas</span>
                        <span>Cartão {dashboard.cardFeePerc?.toFixed(2)}%</span>
                        <span>Imposto {dashboard.taxPerc?.toFixed(2)}%</span>
                        <span>Marketplace {dashboard.marketplaceTaxPerc?.toFixed(2)}%</span>
                      </div>

                    </div>

                    {/* Card status */}
                    <div className={cn(summaryCardClass, statusColor)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${statusDot}`} aria-hidden />
                          Status do dia
                        </div>
                        <Badge variant="outline" className="text-[11px] font-semibold uppercase tracking-wide bg-white/70">
                          {dashboard.pctOfTarget.toFixed(0)}% da Target
                        </Badge>
                      </div>
                      <div className={`text-3xl font-black leading-tight ${statusTextColor} tabular-nums`}>
                        {dashboard.status === "hit-target"
                          ? "Acima da meta"
                          : dashboard.status === "between"
                            ? "Acima da mínima"
                            : "Abaixo da mínima"}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-white/60 bg-white/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Meta Mínima (dia)</div>
                          <div className="font-mono text-base text-slate-800 tabular-nums">{fmtBRL(dashboard.goalMinAmount)}</div>
                        </div>
                        <div className="rounded-lg border border-white/60 bg-white/80 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Meta Target (dia)</div>
                          <div className="font-mono text-base text-slate-800 tabular-nums">{fmtBRL(dashboard.goalTargetAmount)}</div>
                        </div>
                      </div>
                    </div>

                    <Sheet open={timelineOpen} onOpenChange={setTimelineOpen}>
                      <SheetContent side="right" className="sm:max-w-md w-full p-6 h-full flex flex-col">
                        <TimelineSidebar
                          buckets={activeBuckets}
                          lastReadyAt={activeLastReady}
                          nowMs={nowMs}
                          orderLabels={predictionData.orderLabelMap}
                          readyAtMap={activeReadyMap}
                        />
                      </SheetContent>
                    </Sheet>
                  </div>
                );
              }}
            </Await>
          </Suspense>

        </div>
      </div>

      <Separator className="my-12" />

      {/* Venda livre rápida + Filtro de Canal */}
      {(status === "OPENED" || status === "REOPENED") && (
        <>

          {/* Barra contador do estoque */}
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

          <div className="flex flex-wrap items-center justify-between gap-3">
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

          <Separator className="my-12" />


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

            const predictionData = useMemo(
              () => computePredictionData(rowsDb, operatorCountActive, riderCount, dzMap, nowMs, prepMinutesActive),
              [rowsDb, operatorCountActive, riderCount, dzMap, nowMs, prepMinutesActive]
            );

            const predictions =
              predictionMode === "real"
                ? predictionData.realPredictions
                : predictionData.theoreticalPredictions;
            const orderLabels = predictionData.orderLabelMap;

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
                        prepMinutesPerSize={prepMinutesActive}
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
