// app/domain/kds/prediction/delivery.ts
import type { DzTime } from "./types";

export type DzMap = Map<string, { etaMin?: number | null; km?: number | null }>;

export function buildDzMap(dzTimes?: DzTime[]): DzMap {
  const m: DzMap = new Map();
  for (const d of dzTimes ?? []) {
    if (!d?.deliveryZoneId) continue;
    if (!m.has(d.deliveryZoneId)) {
      m.set(d.deliveryZoneId, {
        etaMin: d.estimatedTimeInMin ?? null,
        km: d.distanceInKm ?? null,
      });
    }
  }
  return m;
}

export function estimateDeliveryMinutesByZone(
  dzMap: DzMap,
  zoneId?: string | null
): number | null {
  if (!zoneId) return null;
  const z = dzMap.get(zoneId);
  if (!z) return null;
  if (z.etaMin && Number.isFinite(z.etaMin))
    return Math.max(5, Math.round(z.etaMin!));
  if (z.km && Number.isFinite(z.km))
    return Math.max(5, Math.round(z.km! * 3.5 + 5)); // heurística fallback por km
  return null;
}
