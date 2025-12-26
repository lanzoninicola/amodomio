// app/domain/kds/prediction/production.ts
import { HANDOFF_MIN, PREP_MINUTES_PER_SIZE } from "./config";
import type { SizeCounts } from "./types";

export function calcProductionMinutes(
  counts: SizeCounts,
  prepMinutesPerSize: Record<keyof SizeCounts, number> = PREP_MINUTES_PER_SIZE
): number {
  const sum =
    (counts.P ?? 0) * prepMinutesPerSize.P +
    (counts.M ?? 0) * prepMinutesPerSize.M +
    (counts.F ?? 0) * prepMinutesPerSize.F +
    (counts.I ?? 0) * prepMinutesPerSize.I +
    (counts.FT ?? 0) * prepMinutesPerSize.FT;
  return Math.max(1, sum + HANDOFF_MIN);
}
