import { defer, json } from "@remix-run/node";
import {
  Await,
  useLoaderData,
  useFetcher,
  useRevalidator,
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
import { Trash, Pencil, Save } from "lucide-react";

/* =============================
 * Utils de data (sem fuso)
 * ============================= */
function ymdToDateInt(ymd: string) {
  const [y, m, d] = ymd.split("-");
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return Number(`${y}${mm}${dd}`); // 20250811
}
function ymdToUtcNoon(ymd: string) {
  const [y, m, d] = ymd.split("-");
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return new Date(`${y}-${mm}-${dd}T12:00:00.000Z`);
}

/* =============================
 * Lock em memória (unicidade no app)
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
  createdAt?: string;
  commandNumber?: number;

  size?: string;
  hasMoto?: boolean;
  motoValue?: DecimalLike;
  orderAmount?: DecimalLike;

  channel?: string;
  status?: string;
};

function defaultSizeCounts(): SizeCounts {
  return { F: 0, M: 0, P: 0, I: 0 };
}

function decimalToInput(v: DecimalLike | undefined, fallback = "0.00") {
  if (v == null) return fallback;
  if (typeof v === "number") return v.toFixed(2);
  const s = (v as any)?.toString?.() ?? `${v}`;
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : fallback;
}

/* =============================
 * Loader (compat 7 e 8 dígitos)
 * ============================= */
export async function loader({ params }: { params: { date: string } }) {
  const dateInt8 = ymdToDateInt(params.date);
  const [y, m, d] = params.date.split("-");
  const dateInt7 = Number(`${y}${Number(m)}${Number(d)}`); // compat legado
  const currentDate = ymdToUtcNoon(params.date);

  const ordersPromise = await prismaClient.kdsOrder.findMany({
    where: { dateInt: { in: [dateInt8, dateInt7] } },
    orderBy: [{ commandNumber: "asc" }, { createdAt: "asc" }],
  });

  return defer({
    orders: ordersPromise,
    currentDate: currentDate.toISOString().split("T")[0],
  });
}

/* =============================
 * Action: gestão no app por (dateInt, commandNumber)
 * ============================= */
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { date: string };
}) {
  const formData = await request.formData();
  const _action = (formData.get("_action") as string) ?? "upsert";

  const dateStr = params.date; // "YYYY-MM-DD"
  const dateInt = ymdToDateInt(dateStr);
  const currentDate = ymdToUtcNoon(dateStr);

  try {
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
      if (_action === "delete") {
        const existente = await prismaClient.kdsOrder.findFirst({
          where: { dateInt, commandNumber },
          select: { id: true },
        });
        if (!existente) return json({ ok: true, deleted: false });
        await prismaClient.kdsOrder.delete({ where: { id: existente.id } });
        return json({ ok: true, deleted: true, id: existente.id });
      }

      // Dados do formulário
      const hasMoto = formData.get("hasMoto") === "true";
      const channel = (formData.get("channel") as string) || "";
      const status = (formData.get("status") as string) || "pendente";

      const sizeCountsRaw = formData.get("size") as string;
      if (!sizeCountsRaw) throw new Error("Tamanhos não informados.");

      let sizeCounts: SizeCounts;
      try {
        sizeCounts = JSON.parse(sizeCountsRaw);
      } catch {
        throw new Error("Formato inválido dos tamanhos.");
      }

      // Valores monetários
      const rawMoto = (formData.get("motoValue") as string) ?? "0";
      const rawAmount = (formData.get("orderAmount") as string) ?? "0";
      const motoValueNum = Math.max(0, Number(rawMoto || 0));
      const orderAmountNum = Math.max(0, Number(rawAmount || 0));
      const motoValue = new Prisma.Decimal(motoValueNum.toFixed(2));
      const orderAmount = new Prisma.Decimal(orderAmountNum.toFixed(2));

      // Linha vazia? (não criar lixo)
      const total =
        (sizeCounts.F || 0) +
        (sizeCounts.M || 0) +
        (sizeCounts.P || 0) +
        (sizeCounts.I || 0);

      const linhaVazia =
        total === 0 &&
        !hasMoto &&
        !channel &&
        (status === "pendente" || !status) &&
        motoValueNum === 0 &&
        orderAmountNum === 0;

      if (linhaVazia) {
        return json(
          { ok: false, error: "Linha vazia — nada para salvar." },
          { status: 400 }
        );
      }

      // Procura existente por (dateInt, commandNumber)
      const existente = await prismaClient.kdsOrder.findFirst({
        where: { dateInt, commandNumber },
        select: { id: true },
      });

      if (existente) {
        const updated = await prismaClient.kdsOrder.update({
          where: { id: existente.id },
          data: {
            commandNumber,
            size: JSON.stringify(sizeCounts),
            hasMoto,
            channel,
            status,
            motoValue,
            orderAmount,
          },
        });
        return json({ ok: true, id: updated.id, mode: "update" });
      }

      // Cria somente se não existir
      const created = await prismaClient.kdsOrder.create({
        data: {
          date: currentDate,
          dateInt,
          commandNumber,
          size: JSON.stringify(sizeCounts),
          hasMoto,
          motoValue,
          orderAmount,
          channel,
          status,
        },
      });
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
 * Status labels/cores
 * ============================= */
const statusLabels: Record<string, string> = {
  emFila: "Fila",
  emProducao: "Montando",
  pronto: "Pronto",
  forno: "Forno",
  pendente: "Pendente",
};

const statusColors: Record<string, string> = {
  emFila: "bg-gray-200 text-gray-700",
  emProducao: "bg-blue-100 text-blue-800",
  pronto: "bg-yellow-100 text-yellow-800",
  forno: "bg-orange-100 text-orange-800",
  pendente: "bg-gray-200 text-gray-800",
};

/* Util para pegar classes de status (para o círculo) */
function statusColorClasses(status: string | undefined) {
  const base = statusColors[status || "pendente"] || "bg-gray-200 text-gray-800";
  return base;
}

/* =============================
 * SizeSelector
 * ============================= */
function SizeSelector({
  counts,
  onChange,
}: {
  counts: SizeCounts;
  onChange: (newCounts: SizeCounts) => void;
}) {
  function increment(size: keyof SizeCounts) {
    onChange({ ...counts, [size]: counts[size] + 1 });
  }
  function reset() {
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
            }`}
          aria-label={`Adicionar ${size}`}
        >
          {size}
          {counts[size] > 0 && <span className="ml-1">{counts[size]}</span>}
        </button>
      ))}
      <Badge variant="secondary" className="ml-1 cursor-pointer" onClick={reset}>
        Zerar
      </Badge>
    </div>
  );
}

/* =============================
 * RowItem (fetcher + feedback)
 * ============================= */
function RowItem({
  order,
  index,
  canais,
}: {
  order: OrderRow | null;
  index: number;
  canais: string[];
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

  const [rowId, setRowId] = useState<string | null>(order?.id ?? null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<boolean | null>(null);

  const currentStatus = order?.status || "pendente";

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
        revalidate();
        const t = setTimeout(() => setLastOk(null), 1500);
        return () => clearTimeout(t);
      } else {
        setLastOk(false);
        setErrorText(fetcher.data.error ?? "Erro ao salvar.");
      }
    }
  }, [fetcher.data, revalidate]);

  // Cor do círculo: prioridade ao feedback; senão, cor do status
  const circleClass = useMemo(() => {
    if (fetcher.state === "submitting") return "bg-gray-200";
    if (lastOk === true) return "bg-green-500 text-white";
    if (lastOk === false) return "bg-red-500 text-white";
    return statusColorClasses(currentStatus);
  }, [fetcher.state, lastOk, currentStatus]);

  return (
    <li>
      {/* grid: # | Pedido (R$) | Tamanho | Moto | Moto (R$) | Canal | Status | Ações */}
      <fetcher.Form method="post" className="grid grid-cols-8 gap-2 items-center py-2">
        {/* # com cor de status + feedback */}
        <div className="flex justify-center">
          <div
            className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${circleClass}`}
            title={
              fetcher.state === "submitting"
                ? "Salvando…"
                : lastOk === true
                  ? "Salvo!"
                  : lastOk === false
                    ? "Erro ao salvar"
                    : `Linha ${index + 1}`
            }
          >
            {index + 1}
          </div>
        </div>

        {/* Pedido (R$) — logo após o número */}
        <div className="flex items-center justify-center gap-2">
          <input
            name="orderAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={decimalToInput(order?.orderAmount)}
            className="w-24 border rounded px-2 py-1 text-xs text-right"
            placeholder="Pedido (R$)"
          />
        </div>

        {/* Hidden */}
        {rowId && <input type="hidden" name="id" value={rowId} />}
        <input type="hidden" name="_action" value="upsert" />
        <input type="hidden" name="size" value={JSON.stringify(counts)} />
        <input type="hidden" name="commandNumber" value={index + 1} />

        {/* Tamanhos */}
        <div>
          <SizeSelector counts={counts} onChange={setCounts} />
        </div>

        {/* Moto (boolean) */}
        <div className="flex items-center justify-center gap-2">
          <Select name="hasMoto" defaultValue={order?.hasMoto ? "true" : "false"}>
            <SelectTrigger className="w-20 text-xs">
              <SelectValue placeholder="Moto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Moto (R$) — logo após o select Moto */}
        <div className="flex items-center justify-center gap-2">
          <input
            name="motoValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={decimalToInput(order?.motoValue)}
            className="w-24 border rounded px-2 py-1 text-xs text-right"
            placeholder="Moto (R$)"
          />
        </div>

        {/* Canal */}
        <div className="flex items-center justify-center gap-2">
          <Select name="channel" defaultValue={order?.channel ?? ""}>
            <SelectTrigger className="w-36 text-xs">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              {canais.map((canal) => (
                <SelectItem key={canal} value={canal}>
                  {canal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2">
          {editingStatus ? (
            <Select name="status" defaultValue={currentStatus}>
              <SelectTrigger className="w-28 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emFila">Fila</SelectItem>
                <SelectItem value="emProducao">Montando</SelectItem>
                <SelectItem value="pronto">Pronto</SelectItem>
                <SelectItem value="forno">Forno</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div
              className={`px-2 py-1 text-xs rounded-md ${statusColorClasses(currentStatus)
                }`}
            >
              {statusLabels[currentStatus] || currentStatus}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditingStatus((v) => !v)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {/* Ações */}
        <div className="flex justify-center gap-2">
          <Button
            type="submit"
            variant={"outline"}
            disabled={fetcher.state === "submitting"}
            title="Salvar"
          >
            <Save className="w-4 h-4" />
          </Button>

          {/* Exibir 'Excluir' apenas se existir registro */}
          {rowId && (
            <Button
              type="submit"
              name="_action"
              value="delete"
              variant={"destructive"}
              disabled={fetcher.state === "submitting"}
              title="Excluir"
            >
              <Trash className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Erro inline */}
        {errorText && (
          <div className="col-span-8 text-red-600 text-xs mt-1">{errorText}</div>
        )}
      </fetcher.Form>
    </li>
  );
}

/* =============================
 * Página principal
 * ============================= */
export default function KdsAtendimentoPlanilha() {
  const data = useLoaderData<typeof loader>();
  const [rows, setRows] = useState(50);

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

  return (
    <Suspense fallback={<div>Carregando pedidos...</div>}>
      <Await resolve={data.orders}>
        {(orders) => {
          const safeOrders = Array.isArray(orders) ? (orders as OrderRow[]) : [];
          const displayRows = [
            ...safeOrders,
            ...Array(Math.max(0, 50 - safeOrders.length)).fill(null),
          ];

          return (
            <div className="space-y-2">
              {/* Cabeçalho: # | Pedido (R$) | Tamanho | Moto | Moto (R$) | Canal | Status | Ações */}
              <div className="grid grid-cols-8 gap-2 border-b font-semibold text-sm sticky top-0 bg-white z-10">
                <div className="text-center">#</div>
                <div className="text-center">Pedido (R$)</div>
                <div className="text-center">Tamanho</div>
                <div className="text-center">Moto</div>
                <div className="text-center">Moto (R$)</div>
                <div className="text-center">Canal</div>
                <div className="text-center">Status</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Linhas */}
              <ul className="divide-y divide-gray-300">
                {displayRows.map((order, index) => (
                  <RowItem
                    key={(order as OrderRow)?.id ?? `row-${index}`}
                    order={order as OrderRow | null}
                    index={index}
                    canais={canais}
                  />
                ))}
              </ul>

              {/* Adicionar mais linhas (mantém mínimo 50) */}
              {displayRows.length >= 50 && (
                <div className="flex justify-center mt-4">
                  <Button onClick={() => setRows((r) => r + 50)}>
                    Adicionar 50 linhas
                  </Button>
                </div>
              )}
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
