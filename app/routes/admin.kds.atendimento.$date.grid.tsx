import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
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
  NumberBubble,
  ConfirmDeleteDialog,
  DetailsDialog,
  OpeningDayOverlay,
  ymdToDateInt,
  ymdToUtcNoon,
  todayLocalYMD,
  duplicateCommandNumbers,
  totals,
  type OrderRow,
  type SizeCounts,
  defaultSizeCounts,
  CHANNELS,
} from "@/domain/kds";

import {
  ensureHeader,
  recalcHeaderTotal,
  getMaxes,
  listByDate,
} from "@/domain/kds/server";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

/**
 * TEMPLATE DE COLUNAS AJUSTADO
 * [#, Comanda, Pedido, Tamanhos, Canal, Status, Moto, Retirada, VL, Ações]
 */
const COLS =
  "grid grid-cols-[60px,110px,150px,260px,260px,160px,120px,90px,60px,110px] gap-2 items-center gap-x-4";
const COLS_HDR =
  "grid grid-cols-[60px,110px,150px,260px,260px,160px,120px,90px,60px,110px] gap-2 gap-x-4 border-b font-semibold text-sm sticky top-0 z-10 bg-white";

/* ===========================
   Helpers (somente neste arquivo)
   =========================== */

// Conversão para Decimal
function toDecimal(value: FormDataEntryValue | null | undefined): Prisma.Decimal {
  const raw = String(value ?? "0").replace(",", ".");
  const n = Number(raw);
  return new Prisma.Decimal(Number.isFinite(n) ? n.toFixed(2) : "0");
}

// Input inteiro com digitação estilo "MoneyInput"
function CommandNumberInput({
  name,
  defaultValue,
  className = "w-20 text-center",
  disabled,
}: {
  name: string;
  defaultValue?: number | null;
  className?: string;
  disabled?: boolean;
}) {
  const [val, setVal] = useState<number>(Math.max(0, Number(defaultValue ?? 0)));
  useEffect(() => setVal(Math.max(0, Number(defaultValue ?? 0))), [defaultValue]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    const k = e.key;
    if (k === "Backspace") { e.preventDefault(); setVal((v) => Math.floor(v / 10)); return; }
    if (k === "Delete") { e.preventDefault(); setVal(0); return; }
    if (/^\d$/.test(k)) { e.preventDefault(); setVal((v) => (v * 10 + Number(k)) % 10000000); return; }
    if (k === "Tab" || k === "Enter" || k.startsWith("Arrow") || k === "Home" || k === "End") return;
    e.preventDefault();
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={val || ""}
        onKeyDown={onKeyDown}
        onChange={() => { }}
        disabled={disabled}
        className={`h-9 border rounded px-2 ${className} ${disabled ? "bg-gray-50 text-gray-400" : ""}`}
        placeholder="—"
      />
      <input type="hidden" name={name} value={val || ""} />
    </div>
  );
}

// tamanhos: parse/string/summary
function parseSize(json: any): SizeCounts {
  try {
    const o = json ? JSON.parse(String(json)) : {};
    return {
      F: Number(o?.F || 0),
      M: Number(o?.M || 0),
      P: Number(o?.P || 0),
      I: Number(o?.I || 0),
      FT: Number(o?.FT || 0),
    };
  } catch {
    return defaultSizeCounts();
  }
}
function stringifySize(counts: SizeCounts) { return JSON.stringify(counts); }
function sizeSummary(counts: SizeCounts) {
  const parts: string[] = [];
  (["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).forEach((k) => {
    if (counts[k] > 0) parts.push(`${k}:${counts[k]}`);
  });
  return parts.join("  ");
}

/* ===========================
   Loader
   =========================== */

export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);
  const listPromise = listByDate(dateInt);
  return defer({ dateStr, items: listPromise });
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

  const getNextSort = async () => {
    const { maxSort } = await getMaxes(dateInt);
    return (maxSort ?? 0) + 1000;
  };

  try {
    if (_action === "openDay") {
      const qty = Math.max(1, Math.min(200, Number(form.get("qty") ?? 40)));
      const existing = await prisma.kdsDailyOrderDetail.findMany({
        where: { dateInt, commandNumber: { not: null } },
        select: { commandNumber: true },
      });
      const existSet = new Set<number>(
        existing.map((e) => Number(e.commandNumber!)).filter((n) => Number.isFinite(n))
      );
      const { maxSort } = await getMaxes(dateInt);
      let currentSort = (maxSort ?? 0) + 1000;

      const toCreate: Prisma.KdsDailyOrderDetailCreateManyInput[] = [];
      for (let n = 1; n <= qty; n++) {
        if (existSet.has(n)) continue;
        toCreate.push({
          orderId: header.id,
          dateInt,
          commandNumber: n,
          isVendaLivre: false,
          sortOrderIndex: currentSort,
          orderAmount: new Prisma.Decimal(0),
          status: "novoPedido",
          channel: "",
          hasMoto: false,
          motoValue: new Prisma.Decimal(0),
          takeAway: false,
        } as any);
        currentSort += 1000;
      }
      if (toCreate.length > 0) {
        await prisma.kdsDailyOrderDetail.createMany({ data: toCreate });
        await recalcHeaderTotal(dateInt);
      }
      return json({ ok: true, created: toCreate.length });
    }

    if (_action === "addMore") {
      const more = Math.max(1, Math.min(200, Number(form.get("more") ?? 20)));
      const { maxCmd } = await getMaxes(dateInt);
      let currentSort = await getNextSort();

      const toCreate: Prisma.KdsDailyOrderDetailCreateManyInput[] = [];
      for (let i = 1; i <= more; i++) {
        const n = Number(maxCmd ?? 0) + i;
        toCreate.push({
          orderId: header.id,
          dateInt,
          commandNumber: n,
          isVendaLivre: false,
          sortOrderIndex: currentSort,
          orderAmount: new Prisma.Decimal(0),
          status: "novoPedido",
          channel: "",
          hasMoto: false,
          motoValue: new Prisma.Decimal(0),
          takeAway: false,
        } as any);
        currentSort += 1000;
      }
      if (toCreate.length > 0) {
        await prisma.kdsDailyOrderDetail.createMany({ data: toCreate });
        await recalcHeaderTotal(dateInt);
      }
      return json({ ok: true, created: toCreate.length });
    }

    if (_action === "createVL") {
      const amount = toDecimal(form.get("orderAmount"));
      const channel = String(form.get("channel") ?? "");
      const status = String(form.get("status") ?? "pendente");

      const created = await prisma.kdsDailyOrderDetail.create({
        data: {
          orderId: header.id,
          dateInt,
          commandNumber: null,
          isVendaLivre: true,
          sortOrderIndex: await getNextSort(),
          orderAmount: amount,
          status,
          channel,
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
      } satisfies SizeCounts;

      const data = {
        commandNumber: cmd,
        isVendaLivre: cmd == null,
        orderAmount: toDecimal(form.get("orderAmount")),
        channel: String(form.get("channel") ?? ""),
        status: String(form.get("status") ?? "novoPedido"),
        hasMoto: String(form.get("hasMoto") ?? "") === "on",
        motoValue: toDecimal(form.get("motoValue")),
        takeAway: String(form.get("takeAway") ?? "") === "on",
        size: stringifySize(sizeCounts),
      };

      await prisma.kdsDailyOrderDetail.update({ where: { id }, data });
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
   Componente principal (Grid)
   =========================== */

export default function GridKdsPage() {
  const { dateStr, items } = useLoaderData<typeof loader>();
  const listFx = useFetcher();
  const rowFx = useFetcher();

  const [showVL, setShowVL] = useState(true);
  const [openConfirmId, setOpenConfirmId] = useState<string | null>(null);
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);
  const nowMs = Date.now();

  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState(5);
  const [openError, setOpenError] = useState<string | null>(null);

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

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">Carregando…</div>}>
      <Await resolve={items}>
        {(rowsDb: OrderRow[]) => {
          const rows = rowsDb.filter((r) => (showVL ? true : !r.isVendaLivre));
          const dup = duplicateCommandNumbers(rowsDb);
          const { totalPedido, totalMoto, sizeTotals } = totals(rowsDb);

          return (
            <div className="space-y-4">
              {/* Alertas topo */}
              {dup.length > 0 && (
                <div className="flex items-center gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded px-3 py-2 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Comandas duplicadas no dia: <b className="ml-1">{dup.join(", ")}</b>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <listFx.Form method="post" className="flex items-center gap-2">
                  <input type="hidden" name="_action" value="openDay" />
                  <input type="hidden" name="date" value={dateStr} />
                  <Input name="qty" defaultValue={40} className="h-9 w-20" />
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

                <listFx.Form method="post" className="flex items-center gap-2">
                  <input type="hidden" name="_action" value="addMore" />
                  <input type="hidden" name="date" value={dateStr} />
                  <Input name="more" defaultValue={20} className="h-9 w-20" />
                  <Button type="submit" variant="outline" disabled={listFx.state !== "idle"}>
                    Adicionar mais
                  </Button>
                </listFx.Form>

                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={showVL} onCheckedChange={setShowVL} id="show-vl" />
                  <label htmlFor="show-vl" className="text-sm">Mostrar vendas livres</label>

                  <div className="px-2 py-1 rounded border text-sm">
                    Pedidos: <b>{rowsDb.length}</b>
                  </div>
                  <div className="px-2 py-1 rounded border text-sm">
                    Faturamento:{" "}
                    <b className="font-mono">
                      R$ {totalPedido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </b>
                  </div>
                  <div className="px-2 py-1 rounded border text-sm">
                    Moto:{" "}
                    <b className="font-mono">
                      R$ {totalMoto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </b>
                  </div>
                  <div className="px-2 py-1 rounded border text-sm hidden xl:block">
                    Tamanhos:{" "}
                    <span className="font-mono">
                      F:{sizeTotals.F} M:{sizeTotals.M} P:{sizeTotals.P} I:{sizeTotals.I} FT:{sizeTotals.FT}
                    </span>
                  </div>
                </div>
              </div>

              {/* Venda livre rápida */}
              <div className="rounded-lg border p-3 flex flex-wrap items-center gap-3">
                <div className="text-sm font-medium">Venda livre (rápida)</div>
                <listFx.Form method="post" className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="_action" value="createVL" />
                  <input type="hidden" name="date" value={dateStr} />
                  <MoneyInput name="orderAmount" />
                  <Select name="channel" defaultValue="">
                    <SelectTrigger className="h-9 w-[220px] truncate">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(sem canal)</SelectItem>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select name="status" defaultValue="pendente">
                    <SelectTrigger className="h-9 w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">pendente</SelectItem>
                      <SelectItem value="novoPedido">novoPedido</SelectItem>
                      <SelectItem value="finalizado">finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="secondary" disabled={listFx.state !== "idle"}>
                    {listFx.state !== "idle" ? (<><Loader2 className="w-4 h-4 animate-spin mr-1" /> Adicionando…</>) : "Adicionar"}
                  </Button>
                </listFx.Form>
              </div>

              {/* Cabeçalho */}
              <div className={COLS_HDR + " py-2 px-1"}>
                <div className="text-center">#</div>
                <div className="text-center">Comanda</div>
                <div className="text-center">Pedido (R$)</div>
                <div className="text-center">Tamanhos</div>
                <div className="text-center">Canal</div>
                <div className="text-center">Status</div>
                <div className="text-center">Moto (R$)</div>
                <div className="text-center">Retirada</div>
                <div className="text-center">VL</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Linhas */}
              <ul className="space-y-1">
                {rows.map((o, idx) => {
                  const sizeCounts = parseSize(o.size);
                  const fxState =
                    rowFx.state !== "idle" &&
                      rowFx.formData?.get("id") === o.id &&
                      (rowFx.formData?.get("_action") === "saveRow" ||
                        rowFx.formData?.get("_action") === "cancelRow")
                      ? rowFx.state
                      : "idle";
                  const savingState =
                    fxState === "idle" ? "idle" : fxState === "submitting" ? "saving" : "ok";

                  return (
                    <li key={o.id} className={COLS + " bg-white px-1"}>
                      {/* Bubble */}
                      <NumberBubble
                        commandNumber={o.commandNumber}
                        isVendaLivre={o.isVendaLivre}
                        displayNumber={idx + 1}
                        status={o.status}
                        savingState={savingState as any}
                      />

                      {/* Form da linha */}
                      <rowFx.Form method="post" className="contents">
                        <input type="hidden" name="_action" value="saveRow" />
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="date" value={dateStr} />

                        {/* Comanda */}
                        <div className="flex justify-center">
                          <CommandNumberInput name="commandNumber" defaultValue={o.commandNumber} />
                        </div>

                        {/* Valor */}
                        <div className="flex justify-center">
                          <MoneyInput name="orderAmount" defaultValue={o.orderAmount} className="w-28" />
                        </div>

                        {/* Tamanhos */}
                        <div className="flex justify-center">
                          <div className="flex items-center gap-2">
                            <input type="hidden" name="sizeF" value={sizeCounts.F} />
                            <input type="hidden" name="sizeM" value={sizeCounts.M} />
                            <input type="hidden" name="sizeP" value={sizeCounts.P} />
                            <input type="hidden" name="sizeI" value={sizeCounts.I} />
                            <input type="hidden" name="sizeFT" value={sizeCounts.FT} />
                            <div className="scale-[0.95] origin-center">
                              <SizeSelector
                                counts={sizeCounts}
                                onChange={(next) => {
                                  const formEl = (document.activeElement as HTMLElement)?.closest("form");
                                  if (!formEl) return;
                                  (formEl.querySelector('input[name="sizeF"]') as HTMLInputElement).value = String(next.F);
                                  (formEl.querySelector('input[name="sizeM"]') as HTMLInputElement).value = String(next.M);
                                  (formEl.querySelector('input[name="sizeP"]') as HTMLInputElement).value = String(next.P);
                                  (formEl.querySelector('input[name="sizeI"]') as HTMLInputElement).value = String(next.I);
                                  (formEl.querySelector('input[name="sizeFT"]') as HTMLInputElement).value = String(next.FT);
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Canal */}
                        <div className="flex justify-center">
                          <Select name="channel" defaultValue={o.channel ?? ""}>
                            <SelectTrigger className="h-9 w-[240px] truncate">
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

                        {/* Status */}
                        <div className="flex justify-center">
                          <Select name="status" defaultValue={o.status ?? "novoPedido"}>
                            <SelectTrigger className="h-9 w-[160px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">pendente</SelectItem>
                              <SelectItem value="novoPedido">novoPedido</SelectItem>
                              <SelectItem value="emProducao">emProducao</SelectItem>
                              <SelectItem value="aguardandoForno">aguardandoForno</SelectItem>
                              <SelectItem value="assando">assando</SelectItem>
                              <SelectItem value="finalizado">finalizado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Moto */}
                        <div className="flex items-center justify-center gap-2">
                          <MoneyInput name="motoValue" defaultValue={o.motoValue} className="w-24" />
                          <div className="flex items-center gap-2">
                            <input type="checkbox" name="hasMoto" defaultChecked={!!o.hasMoto} className="h-4 w-4" />
                            <span className="text-xs text-slate-600">tem moto</span>
                          </div>
                        </div>

                        {/* Retirada */}
                        <div className="flex items-center justify-center">
                          <input type="checkbox" name="takeAway" defaultChecked={!!(o as any).takeAway} className="h-4 w-4" />
                        </div>

                        {/* VL */}
                        <div className="flex items-center justify-center">
                          {o.isVendaLivre ? (
                            <Badge variant="secondary" className="text-[10px]">VL</Badge>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-center gap-2">
                          <Button type="submit" variant="outline" title="Salvar">
                            {rowFx.state !== "idle" && rowFx.formData?.get("id") === o.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Save className="w-4 h-4" />}
                          </Button>

                          <Button type="button" variant="ghost" title="Detalhes" onClick={() => setDetailsOpenId(o.id)}>
                            <Ellipsis className="w-4 h-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            title="Excluir"
                            className="hover:bg-red-50"
                            onClick={() => setOpenConfirmId(o.id)}
                          >
                            <Trash className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </rowFx.Form>

                      {/* Dialog confirmar exclusão */}
                      <ConfirmDeleteDialog
                        open={openConfirmId === o.id}
                        onOpenChange={(v) => !v && setOpenConfirmId(null)}
                        onConfirm={() => {
                          const fd = new FormData();
                          fd.set("_action", "cancelRow");
                          fd.set("id", o.id);
                          fd.set("date", dateStr);
                          rowFx.submit(fd, { method: "post" });
                          setOpenConfirmId(null);
                        }}
                      />

                      {/* Dialog detalhes */}
                      <DetailsDialog
                        open={detailsOpenId === o.id}
                        onOpenChange={(v) => !v && setDetailsOpenId(null)}
                        createdAt={o.createdAt as any}
                        nowMs={nowMs}
                        status={o.status ?? "novoPedido"}
                        onStatusChange={(value) => {
                          const fd = new FormData();
                          fd.set("_action", "saveRow");
                          fd.set("id", o.id);
                          fd.set("date", dateStr);
                          fd.set("status", value);
                          fd.set("commandNumber", String(o.commandNumber ?? ""));
                          fd.set("orderAmount", String(o.orderAmount ?? 0));
                          fd.set("motoValue", String(o.motoValue ?? 0));
                          fd.set("hasMoto", o.hasMoto ? "on" : "");
                          fd.set("takeAway", (o as any).takeAway ? "on" : "");
                          const sc = parseSize(o.size);
                          fd.set("sizeF", String(sc.F));
                          fd.set("sizeM", String(sc.M));
                          fd.set("sizeP", String(sc.P));
                          fd.set("sizeI", String(sc.I));
                          fd.set("sizeFT", String(sc.FT));
                          fd.set("channel", String(o.channel ?? ""));
                          rowFx.submit(fd, { method: "post" });
                        }}
                        onSubmit={() => setDetailsOpenId(null)}
                        orderAmount={Number(o.orderAmount ?? 0)}
                        motoValue={Number(o.motoValue ?? 0)}
                        sizeSummary={sizeSummary(parseSize(o.size))}
                        channel={o.channel}
                      />
                    </li>
                  );
                })}
              </ul>

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
