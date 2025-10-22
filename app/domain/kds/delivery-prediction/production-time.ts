// app/domain/kds/prediction/production.ts
import { HANDOFF_MIN, AVG_PROD_MIN } from "./config";
import type { SizeCounts } from "./types";

export function calcProductionMinutes(counts: SizeCounts): number {
  const sum =
    (counts.P ?? 0) * AVG_PROD_MIN.P +
    (counts.M ?? 0) * AVG_PROD_MIN.M +
    (counts.F ?? 0) * AVG_PROD_MIN.F +
    (counts.I ?? 0) * AVG_PROD_MIN.I +
    (counts.FT ?? 0) * AVG_PROD_MIN.FT;
  return Math.max(1, sum + HANDOFF_MIN);
}
