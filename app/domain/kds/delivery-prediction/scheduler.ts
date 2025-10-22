// app/domain/kds/prediction/scheduler.ts
import type { ArrivalPrediction, ReadyPrediction, SizeCounts } from "./types";
import { calcProductionMinutes } from "./production-time";
import { estimateDeliveryMinutesByZone, type DzMap } from "./delivery-time";
import { RETURN_MIN } from "./config";

// API mínima que esperamos de cada linha (compatível com seu OrderRow atual)
export type MinimalOrderRow = {
  id: string;
  createdAt: string | Date;
  finalizadoAt?: string | Date | null;
  size: any;
  hasMoto?: boolean | null;
  takeAway?: boolean | null;
  deliveryZoneId?: string | null;
};

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

/** Produção com paralelismo (N operadores): atribui pedido ao operador com menor carga acumulada */
export function predictReadyTimes(
  rows: MinimalOrderRow[],
  operatorCount: number,
  nowMs: number
): ReadyPrediction[] {
  const loads = Array.from({ length: Math.max(1, operatorCount) }, () => 0);
  const list = [...rows].sort(
    (a, b) =>
      new Date(a.createdAt as any).getTime() -
      new Date(b.createdAt as any).getTime()
  );

  const out: ReadyPrediction[] = [];

  for (const o of list) {
    const fin = o.finalizadoAt
      ? new Date(o.finalizadoAt as any).getTime()
      : null;
    if (fin) {
      out.push({
        id: o.id,
        readyAtMs: fin,
        isDelivery: o.takeAway !== true && o.hasMoto === true,
        dzId: o.deliveryZoneId ?? null,
      });
      continue;
    }

    const counts = parseSizeSafe(o.size);
    const prepMin = Math.max(1, calcProductionMinutes(counts));

    let bestIdx = 0;
    for (let i = 1; i < loads.length; i++)
      if (loads[i] < loads[bestIdx]) bestIdx = i;

    const createdMs = new Date(o.createdAt as any).getTime();
    const startAtMs = Math.max(createdMs, nowMs) + loads[bestIdx] * 60_000;
    const readyAtMs = startAtMs + prepMin * 60_000;

    loads[bestIdx] += prepMin;

    out.push({
      id: o.id,
      readyAtMs,
      isDelivery: o.takeAway !== true && o.hasMoto === true,
      dzId: o.deliveryZoneId ?? null,
    });
  }

  return out;
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
