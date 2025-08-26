// app/routes/admin.kds.atendimento.$date.grid.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, defer } from "@remix-run/node";
import {
  Await,
  useFetcher,
  useLoaderData,
} from "@remix-run/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import prisma from "~/lib/prisma/client.server";
import { Prisma } from "@prisma/client";

import {
  MoneyInput,
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
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { Separator } from "~/components/ui/separator";

import { setOrderStatus } from "~/domain/kds/server/repository.server";
import DeliveryZoneCombobox from "~/domain/kds/components/delivery-zone-combobox";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [{ title: "KDS | Pedidos" }];
};

/**
 * COLUNAS (Status removido)
 * [#, Pedido, Tamanhos, Canal, Zona, Moto, Retirada, VL, Detalhes, Ações]
 */
const COLS =
  "grid grid-cols-[60px,150px,260px,240px,220px,120px,110px,70px,80px,110px] gap-2 items-center gap-x-8";
const COLS_HDR =
  "grid grid-cols-[60px,150px,260px,240px,220px,120px,110px,70px,80px,110px] gap-2 gap-x-8 border-b font-semibold text-sm sticky top-0 z-10 bg-white";

/** URL do calendário mensal (se usar) */
const MONTH_VIEW_URL_TEMPLATE = (ym: string) => `/admin/kds/atendimento/${ym}`;

/* ===========================
   Helpers locais
   =========================== */

function toDecimal(value: FormDataEntryValue | null | undefined): Prisma.Decimal {
  const raw = String(value ?? "0").replace(",", ".");
  const n = Number(raw);
  return new Prisma.Decimal(Number.isFinite(n) ? n.toFixed(2) : "0");
}

// Inteiro com digitação “money-like”
function CommandNumberInput({
  value,
  onChange,
  className = "w-16 text-center",
  isVendaLivre = false
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  isVendaLivre?: boolean
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
    /* autoFocus removido para evitar scroll indevido ao filtrar */
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
  (["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).filter(k => c[k] > 0).map(k => `${k}:${c[k]}`).join("  ");

/* ===========================
   Loader
   =========================== */

export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);

  const listPromise = listByDate(dateInt);
  const header = await prisma.kdsDailyOrder.findUnique({
    where: { dateInt },
    select: { id: true, operationStatus: true },
  });

  // Delivery Zones (somente campos necessários)
  const deliveryZones = await prisma.deliveryZone.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Tempos/distâncias por Delivery Zone (para ETA de entrega)
  const dzTimes = await prisma.deliveryZoneDistance.findMany({
    select: {
      deliveryZoneId: true,
      estimatedTimeInMin: true,
      distanceInKm: true,
    },
  });

  return defer({
    dateStr,
    items: listPromise,
    header: header ?? { id: null, operationStatus: "PENDING" as const },
    deliveryZones,
    dzTimes,
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
          status: "pendente", channel: "", hasMoto: false, motoValue: new Prisma.Decimal(0), takeAway: false,
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
          status: "pendente", channel: "", hasMoto: false, motoValue: new Prisma.Decimal(0), takeAway: false,
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
        },
        select: { id: true },
      });
      await recalcHeaderTotal(dateInt);
      return json({ ok: true, id: created.id });
    }

    if (_action === "saveRow") {
      const id = String(form.get("id") ?? "");
      if (!id) return json({ ok: false, error: "id inválido" }, { status: 400 });

      const rawCmd = String(form.get("commandNumber") ?? "").trim();
      const cmd = rawCmd === "" ? null : Number(rawCmd);
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

      const sizeCounts = {
        F: Number(form.get("sizeF") ?? 0) || 0,
        M: Number(form.get("sizeM") ?? 0) || 0,
        P: Number(form.get("sizeP") ?? 0) || 0,
        I: Number(form.get("sizeI") ?? 0) || 0,
        FT: Number(form.get("sizeFT") ?? 0) || 0,
      };

      // === Regra automática: novoPedido quando amount>0, algum tamanho>0 e todos timestamps NULL ===
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

      // status enviado pelo form (pode vir vazio)
      const requestedStatus = String(form.get("status") ?? "");

      // se não for status “forte” solicitado, aplica a regra automática
      let finalStatus = requestedStatus?.trim();
      if (!finalStatus || finalStatus === "pendente" || finalStatus === "novoPedido") {
        finalStatus = autoStatus;
      }

      // --- Gestão do novoPedidoAt ---
      // Setar quando entra em "novoPedido" pela primeira vez;
      // Não resetar ao avançar;
      // Resetar SOMENTE se houver downgrade (rank novo < rank antigo).
      const rankOld = STATUS_RANK[current?.status ?? "pendente"] ?? 0;
      const rankNew = STATUS_RANK[finalStatus ?? "pendente"] ?? 0;

      let patchNovoPedidoAt: Date | null | undefined = undefined; // undefined = não tocar

      if (!current?.novoPedidoAt && finalStatus === "novoPedido") {
        patchNovoPedidoAt = new Date();
      }
      if (current?.novoPedidoAt && rankNew < rankOld) {
        patchNovoPedidoAt = null;
      }

      if (finalStatus && finalStatus !== current?.status) {
        await setOrderStatus(id, finalStatus as any);
      }

      // deliveryZoneId (pode vir vazio para limpar)
      const dzIdRaw = String(form.get("deliveryZoneId") ?? "").trim();
      const deliveryZoneId = dzIdRaw === "" ? null : dzIdRaw;

      await prisma.kdsDailyOrderDetail.update({
        where: { id },
        data: {
          commandNumber: cmd,
          isVendaLivre: cmd == null,
          orderAmount: amountDecimal,
          channel: String(form.get("channel") ?? ""),
          hasMoto: String(form.get("hasMoto") ?? "") === "on",
          motoValue: toDecimal(form.get("motoValue")),
          takeAway: String(form.get("takeAway") ?? "") === "on",
          size: stringifySize(sizeCounts as any),
          deliveryZoneId: deliveryZoneId as any,
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
   Linha (componente filho)
   =========================== */

function RowItem({
  o,
  dateStr,
  readOnly,
  deliveryZones,
  nowMs,
  predictions,
  rowFx,
}: {
  o: OrderRow;
  dateStr: string;
  readOnly: boolean;
  deliveryZones: { id: string; name: string }[];
  nowMs: number;
  predictions: Map<string, { readyAtMs: number; arriveAtMs: number | null }>;
  rowFx: ReturnType<typeof useFetcher>;
}) {
  const sizeCounts = parseSize(o.size);

  // estados por linha
  const [openConfirmId, setOpenConfirmId] = useState(false);
  const [detailsOpenId, setDetailsOpenId] = useState(false);
  const [cmdLocal, setCmdLocal] = useState<number | null>(o.commandNumber);
  const [hasMoto, setHasMoto] = useState<boolean>(!!o.hasMoto);
  const [takeAway, setTakeAway] = useState<boolean>(!!(o as any).takeAway);
  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null | undefined>((o as any).deliveryZoneId ?? null);
  const [sizes, setSizes] = useState<SizeCounts>(sizeCounts);
  const statusText = (o as any).status ?? "pendente";
  const npAt = (o as any).novoPedidoAt ? new Date((o as any).novoPedidoAt as any) : null;

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

          {/* nº comanda */}
          <div className="flex items-center justify-center">
            <CommandNumberInput value={cmdLocal} onChange={setCmdLocal} isVendaLivre={o.isVendaLivre} />
            <input type="hidden" name="commandNumber" value={cmdLocal ?? ""} />
          </div>

          {/* Valor */}
          <div className="flex justify-center">
            <MoneyInput name="orderAmount" defaultValue={o.orderAmount} className="w-28" disabled={readOnly} />
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

          {/* Delivery Zone */}
          <div className="flex justify-center">
            <DeliveryZoneCombobox
              options={deliveryZones}
              value={deliveryZoneId}
              onChange={setDeliveryZoneId}
              disabled={readOnly || o.isVendaLivre === true}
              className="w-[220px]"
            />
          </div>

          {/* Moto (valor) + switch */}
          <div className="flex items-center justify-center gap-1">
            <div className={`flex items-center gap-2 ${readOnly ? "opacity-60" : ""}`}>
              <Switch checked={hasMoto} onCheckedChange={setHasMoto} id={`moto-${o.id}`} disabled={readOnly} />
              <input type="hidden" name="hasMoto" value={hasMoto ? "on" : ""} />
            </div>
            <MoneyInput name="motoValue" defaultValue={o.motoValue} className="w-24" disabled={readOnly || hasMoto === false} />
          </div>

          {/* Retirada */}
          <div className={`flex items-center justify-center ${readOnly ? "opacity-60" : ""}`}>
            <Switch checked={takeAway} onCheckedChange={setTakeAway} id={`ret-${o.id}`} disabled={readOnly || hasMoto === true} />
            <input type="hidden" name="takeAway" value={takeAway ? "on" : ""} />
          </div>

          {/* VL */}
          <div className="flex items-center justify-center">
            {(o.isVendaLivre || cmdLocal == null) ? (
              <Badge variant="secondary" className="text-[10px]">VL</Badge>
            ) : <span className="text-xs text-slate-400">—</span>}
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

      {/* Linha extra com badge + criado/decorrido + previsões */}
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
    </li>
  );
}

/* ===========================
   Página (Grid)
   =========================== */

export default function GridKdsPage() {
  const { dateStr, items, header, deliveryZones, dzTimes } = useLoaderData<typeof loader>();
  const listFx = useFetcher();
  const rowFx = useFetcher();

  const status = (header?.operationStatus ?? "PENDING") as "PENDING" | "OPENED" | "CLOSED" | "REOPENED";
  const isClosed = status === "CLOSED";
  const readOnly = isClosed;

  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState(5);
  const [openError, setOpenError] = useState<string | null>(null);

  // filtro de canal (UI)
  const [channelFilter, setChannelFilter] = useState<string>("");

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

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">Carregando…</div>}>
      <Await resolve={items}>
        {(rowsDb: OrderRow[]) => {
          const dup = duplicateCommandNumbers(rowsDb);

          // PREVISÕES (produção + entrega)
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

          // Filtro por canal
          const filteredRows = useMemo(() => {
            if (!channelFilter) return rowsDb;
            const wanted = channelFilter;
            return rowsDb.filter((o) => ((o.channel ?? "").trim() === wanted));
          }, [rowsDb, channelFilter]);

          return (
            <div className="space-y-4">
              {/* Alertas topo */}
              {dup.length > 0 && (
                <div className="flex items-center gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded px-3 py-2 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Comandas duplicadas no dia: <b className="ml-1">{dup.join(", ")}</b>
                </div>
              )}

              {/* Toolbar (abrir/fechar dia etc.) */}
              <div className="flex flex-wrap items-center gap-3">
                {(!header?.id || status === "PENDING") && (
                  <listFx.Form method="post" className="flex items-center gap-2">
                    <input type="hidden" name="_action" value="openDay" />
                    <input type="hidden" name="date" value={dateStr} />
                    <Input name="qty" defaultValue={40} className="h-9 w-20 text-center" />
                    <Button type="submit" variant="default" disabled={listFx.state !== "idle"}>
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

              {/* Venda livre + Filtro de Canal */}
              {status !== "CLOSED" && (
                <div className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3">
                  {/* Venda Livre */}
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">Venda livre (rápida)</div>
                    <listFx.Form method="post" className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="_action" value="createVL" />
                      <input type="hidden" name="date" value={dateStr} />
                      <MoneyInput name="orderAmount" />
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
              )}

              {/* Cabeçalho */}
              <div className={COLS_HDR + " py-2 px-1"}>
                <div className="text-center">#</div>
                <div className="text-center">Pedido (R$)</div>
                <div className="text-center">Tamanhos</div>
                <div className="text-center">Canal</div>
                <div className="text-center">Zona</div>
                <div className="text-center">Moto (R$)</div>
                <div className="text-center">Retirada</div>
                <div className="text-center">VL</div>
                <div className="text-center">Detalhes</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Linhas */}
              <ul className="space-y-1">
                {filteredRows.map((o) => (
                  <RowItem
                    key={o.id}
                    o={o}
                    dateStr={dateStr}
                    readOnly={readOnly}
                    deliveryZones={deliveryZones as any}
                    nowMs={nowMs}
                    predictions={predictions}
                    rowFx={rowFx}
                  />
                ))}
              </ul>

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

              {/* Overlay de abertura do dia */}
              <OpeningDayOverlay
                open={opening || !!openError}
                progress={progress}
                hasError={!!openError}
                errorMessage={openError}
                onClose={() => { setOpening(false); setOpenError(null); }}
              />
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
