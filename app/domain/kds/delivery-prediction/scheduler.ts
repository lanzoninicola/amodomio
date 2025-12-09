// app/domain/kds/prediction/scheduler.ts
import type {
  ArrivalPrediction,
  MinimalOrderRow,
  ReadyAtMap,
  ReadyPrediction,
  SizeCounts,
  TimelineBucket,
} from "./types";
import { calcProductionMinutes } from "./production-time";
import { estimateDeliveryMinutesByZone, type DzMap } from "./delivery-time";
import { PREP_MINUTES_PER_SIZE, RETURN_MIN } from "./config";

export function parseSizeSafe(json: any): SizeCounts {
  try {
    const o = json ? JSON.parse(String(json)) : {};
    return {
      F: +o?.F || 0,
      M: +o?.M || 0,
      P: +o?.P || 0,
      I: +o?.I || 0,
      FT: +o?.FT || 0,
    };
  } catch {
    return { F: 0, M: 0, P: 0, I: 0, FT: 0 };
  }
}

// Cálculo simples de backlog médio dividido pelo nº de operadores
export function computeReadyAtMap({
  orders,
  operatorCount,
  prepMinutesPerSize = PREP_MINUTES_PER_SIZE,
  nowMs = Date.now(),
}: {
  orders: MinimalOrderRow[];
  operatorCount: number;
  prepMinutesPerSize?: Record<keyof SizeCounts, number>;
  nowMs?: number;
}): ReadyAtMap {
  const safeOpCount = Math.max(1, operatorCount || 1);
  const list = [...orders]
    .filter((o) => !o.finalizadoAt)
    .sort(
      (a, b) =>
        new Date(a.createdAt as any).getTime() -
        new Date(b.createdAt as any).getTime()
    );

  let backlogMin = 0;
  const result: ReadyAtMap = new Map();

  for (const order of list) {
    const createdMs = new Date(order.createdAt as any).getTime();
    if (!Number.isFinite(createdMs)) continue;

    const counts = parseSizeSafe(order.size);
    const workloadMin = Math.max(1, calcProductionMinutes(counts, prepMinutesPerSize));

    const baseMs = Math.max(nowMs, createdMs);
    const readyAtMs = baseMs + ((backlogMin + workloadMin) / safeOpCount) * 60_000;

    result.set(order.id, readyAtMs);
    backlogMin += workloadMin;
  }

  return result;
}

export function buildTimelineBuckets(
  readyAtMap: ReadyAtMap,
  {
    nowMs = Date.now(),
    slotMinutes = 30,
    minSlots = 6,
  }: { nowMs?: number; slotMinutes?: number; minSlots?: number } = {}
): TimelineBucket[] {
  if (!readyAtMap.size) return [];

  const slotMs = Math.max(15, slotMinutes) * 60_000;
  const values = Array.from(readyAtMap.values());
  const startCandidate = Math.min(nowMs, ...values);
  const endCandidate = Math.max(nowMs, ...values);

  const floorToSlot = (ms: number) => Math.floor(ms / slotMs) * slotMs;
  const ceilToSlot = (ms: number) => Math.ceil(ms / slotMs) * slotMs;

  const rangeStart = floorToSlot(startCandidate);
  const targetEnd = ceilToSlot(endCandidate);

  const totalSlots = Math.max(
    minSlots,
    Math.round((targetEnd - rangeStart) / slotMs) + 1
  );
  const normalizedEnd = rangeStart + (totalSlots - 1) * slotMs;

  const buckets = new Map<number, string[]>();
  for (const [id, ts] of readyAtMap.entries()) {
    const slotStart = floorToSlot(ts);
    const arr = buckets.get(slotStart) ?? [];
    arr.push(id);
    buckets.set(slotStart, arr);
  }

  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const out: TimelineBucket[] = [];
  for (let cursor = normalizedEnd; cursor >= rangeStart; cursor -= slotMs) {
    const ids = buckets.get(cursor) ?? [];
    const slotEndMs = cursor + slotMs;
    out.push({
      slotStartMs: cursor,
      slotEndMs,
      label: fmt(cursor),
      orderIds: ids,
      count: ids.length,
      isPast: slotEndMs <= nowMs,
      isCurrent: cursor <= nowMs && nowMs < slotEndMs,
    });
  }

  return out;
}

/** Produção com paralelismo (N operadores): atribui pedido ao operador com menor carga acumulada */
export function predictReadyTimes(
  rows: MinimalOrderRow[],
  operatorCount: number,
  nowMs: number,
  prepMinutesPerSize: Record<keyof SizeCounts, number> = PREP_MINUTES_PER_SIZE
): ReadyPrediction[] {
  const out: ReadyPrediction[] = [];

  const readyMap = computeReadyAtMap({
    orders: rows.filter((o) => !o.finalizadoAt),
    operatorCount,
    prepMinutesPerSize,
    nowMs,
  });

  for (const o of rows) {
    const fin = o.finalizadoAt ? new Date(o.finalizadoAt as any).getTime() : null;
    const isDelivery = o.takeAway !== true && o.hasMoto === true;

    if (fin) {
      out.push({
        id: o.id,
        readyAtMs: fin,
        isDelivery,
        dzId: o.deliveryZoneId ?? null,
      });
      continue;
    }

    const predicted = readyMap.get(o.id);
    if (!predicted) continue;

    out.push({
      id: o.id,
      readyAtMs: predicted,
      isDelivery,
      dzId: o.deliveryZoneId ?? null,
    });
  }

  return out.sort((a, b) => a.readyAtMs - b.readyAtMs);
}

/** Entrega com paralelismo (N motoboys): despacha no rider que fica livre antes */
export function predictArrivalTimes(
  readyList: ReadyPrediction[],
  riderCount: number,
  dzMap: DzMap
): ArrivalPrediction[] {
  const ridersFreeAt = Array.from({ length: Math.max(1, riderCount) }, () => 0);
  const deliveryOrders = readyList
    .filter((r) => r.isDelivery)
    .sort((a, b) => a.readyAtMs - b.readyAtMs);

  const idToArrival = new Map<string, number | null>();

  for (const r of deliveryOrders) {
    const etaMin = estimateDeliveryMinutesByZone(dzMap, r.dzId);
    if (!etaMin) {
      idToArrival.set(r.id, null);
      continue;
    }

    let bestR = 0;
    for (let i = 1; i < ridersFreeAt.length; i++)
      if (ridersFreeAt[i] < ridersFreeAt[bestR]) bestR = i;

    const dispatchMs = Math.max(r.readyAtMs, ridersFreeAt[bestR]);
    const arriveMs = dispatchMs + etaMin * 60_000;

    ridersFreeAt[bestR] = dispatchMs + (etaMin + RETURN_MIN) * 60_000;

    idToArrival.set(r.id, arriveMs);
  }

  // não-delivery → null
  for (const r of readyList) {
    if (!r.isDelivery && !idToArrival.has(r.id)) idToArrival.set(r.id, null);
  }

  return readyList.map((r) => ({
    id: r.id,
    arriveAtMs: idToArrival.get(r.id) ?? null,
  }));
}
