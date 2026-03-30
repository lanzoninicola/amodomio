import prismaClient from "~/lib/prisma/client.server";
import {
  calculateItemCostMetrics,
  getItemAverageCostWindowDays,
  isItemCostExcludedFromMetrics,
  normalizeItemCostToConsumptionUnit,
} from "~/domain/item/item-cost-metrics.server";

// ─── date helpers ────────────────────────────────────────────────────────────

function ymdToInt(y: number, m: number, d: number) {
  return y * 10000 + m * 100 + d;
}

function dateIntToLocalDate(dateInt: number): Date {
  const s = String(dateInt).padStart(8, "0");
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
}

function getMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return { start: ymdToInt(year, month, 1), end: ymdToInt(year, month, lastDay) };
}

function shiftMonth(year: number, month: number, offsetMonths: number) {
  const total = year * 12 + (month - 1) - offsetMonths;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PT_WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function monthLabel(year: number, month: number) {
  return `${PT_MONTHS[month - 1]}/${String(year).slice(2)}`;
}

// ─── item helpers ─────────────────────────────────────────────────────────────

function pickPrimaryVariation(item: any) {
  const active = (item?.ItemVariation || []).filter((v: any) => !v?.deletedAt);
  return active.find((v: any) => v.isReference) || active[0] || null;
}

export function buildTrendData(
  history: any[],
  item: any,
  chartWindowDays: number,
): TrendPoint[] {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - (chartWindowDays - 1));

  const buckets = new Map<string, { date: string; label: string; total: number; count: number }>();

  for (const row of history) {
    if (isItemCostExcludedFromMetrics(row)) continue;
    const d = row.validFrom ? new Date(row.validFrom) : row.createdAt ? new Date(row.createdAt) : null;
    if (!d || isNaN(d.getTime()) || d < threshold) continue;
    const normalized = normalizeItemCostToConsumptionUnit(row, item);
    const amount = Number.isFinite(normalized) ? normalized! : Number(row.costAmount ?? NaN);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const key = d.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? {
      date: key,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: 0,
      count: 0,
    };
    bucket.total += amount;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((b) => ({ ...b, value: b.count > 0 ? b.total / b.count : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── KDS revenue query ────────────────────────────────────────────────────────

async function getRevenueByDate(fromInt: number, toInt: number): Promise<Map<number, number>> {
  const rows = await (prismaClient as any).kdsDailyOrderDetail.groupBy({
    by: ["dateInt"],
    where: {
      dateInt: { gte: fromInt, lte: toInt },
      status: { not: "pendente" },
    },
    _sum: { orderAmount: true },
  });
  return new Map(rows.map((r: any) => [r.dateInt, Number(r._sum.orderAmount ?? 0)]));
}

function sumRange(map: Map<number, number>, from: number, to: number) {
  let total = 0;
  for (const [k, v] of map) if (k >= from && k <= to) total += v;
  return total;
}

// ─── public types ─────────────────────────────────────────────────────────────

export type TrendPoint = { date: string; label: string; value: number; count: number };

export type WeekdaySeries = {
  seriesLabel: string;
  points: Array<{ occurrence: number; dateLabel: string; total: number }>;
};

export type WeekdayChart = {
  weekday: number;
  label: string;
  xLabels: string[];
  series: WeekdaySeries[];
};

export type TopItem = {
  id: string;
  name: string;
  consumptionUm: string | null;
  purchaseUm: string | null;
  latestCostPerConsumptionUnit: number | null;
  averageCostPerConsumptionUnit: number | null;
  averageSamplesCount: number;
  trend: TrendPoint[];
};

export type ImpactItem = {
  itemId: string;
  name: string;
  consumptionUm: string | null;
  recipeUsageCount: number;
  totalCostImpact: number;
  latestCostPerConsumptionUnit: number | null;
  trend: TrendPoint[];
};

export type CostVarItem = {
  itemId: string;
  name: string;
  consumptionUm: string | null;
  purchaseUm: string | null;
  unit: string | null;
  previous: number;
  current: number;
  absDelta: number;
  pctDelta: number;
  /** ISO date string of when the current (latest) price was recorded */
  currentDate: string | null;
  /** ISO date string of when the previous price was recorded */
  previousDate: string | null;
};

export type CostVarImpactItem = CostVarItem & {
  /** Number of recipe ingredients rows that reference this item */
  recipeUsageCount: number;
  /** |absDelta| × recipeUsageCount — the ranking score */
  weightedImpact: number;
};

/** Item that has cost history but cannot be compared because consumptionUm is
 *  not set and the two most-recent entries were recorded in different units. */
export type MissingUmItem = {
  itemId: string;
  name: string;
  latestUnit: string | null;
  previousUnit: string | null;
};

export type DashboardKpis = {
  monthlyRevenue: Array<{ monthKey: string; label: string; total: number; isCurrent: boolean }>;
  weekdayCharts: WeekdayChart[];
  topExpensive: TopItem[];
  topImpact: ImpactItem[];
  costVarByAbs: CostVarItem[];
  costVarByPct: CostVarItem[];
};

// ─── weekday series builder ───────────────────────────────────────────────────

function buildWeekdaySeries(
  revenueMap: Map<number, number>,
  range: { start: number; end: number },
  label: string,
): Map<number, WeekdaySeries["points"]> {
  const occurrences = new Map<number, number>();
  const result = new Map<number, WeekdaySeries["points"]>();

  const entries = Array.from(revenueMap.entries())
    .filter(([k]) => k >= range.start && k <= range.end)
    .sort(([a], [b]) => a - b);

  for (const [dateInt, total] of entries) {
    const date = dateIntToLocalDate(dateInt);
    const wd = date.getDay();
    const occ = (occurrences.get(wd) ?? 0) + 1;
    occurrences.set(wd, occ);
    if (!result.has(wd)) result.set(wd, []);
    result.get(wd)!.push({
      occurrence: occ,
      dateLabel: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total,
    });
  }

  return result;
}

// ─── top expensive items ──────────────────────────────────────────────────────

async function loadTopExpensive(
  averageWindowDays: number,
  chartWindowDays: number,
  top = 10,
): Promise<TopItem[]> {
  const db = prismaClient as any;

  const allItems = await db.item.findMany({
    where: { active: true, classification: "insumo" },
    include: {
      ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
      ItemVariation: {
        where: { deletedAt: null },
        include: {
          ItemCostVariation: {
            select: { costAmount: true, unit: true, validFrom: true, createdAt: true, source: true },
          },
          ItemCostVariationHistory: {
            select: { costAmount: true, unit: true, validFrom: true, createdAt: true, source: true, metadata: true },
            orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
            take: 90,
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  const scored = allItems
    .map((item: any) => {
      const base = pickPrimaryVariation(item);
      if (!base) return null;
      const history = base.ItemCostVariationHistory ?? [];
      const current = base.ItemCostVariation ?? null;
      const forMetrics = history.length > 0 ? history : current ? [current] : [];
      if (forMetrics.length === 0) return null;
      const metrics = calculateItemCostMetrics({ item, history: forMetrics, averageWindowDays });
      const cost = metrics.averageCostPerConsumptionUnit ?? metrics.latestCostPerConsumptionUnit;
      if (cost == null || !Number.isFinite(cost)) return null;
      return { item, metrics, history, current, cost };
    })
    .filter(Boolean);

  scored.sort((a: any, b: any) => b.cost - a.cost);

  return scored.slice(0, top).map(({ item, metrics, history, current }: any) => {
    const trendHistory = history.length > 0 ? history : current ? [current] : [];
    return {
      id: item.id,
      name: item.name,
      consumptionUm: item.consumptionUm ?? null,
      purchaseUm: item.purchaseUm ?? null,
      latestCostPerConsumptionUnit: metrics.latestCostPerConsumptionUnit,
      averageCostPerConsumptionUnit: metrics.averageCostPerConsumptionUnit,
      averageSamplesCount: metrics.averageSamplesCount,
      trend: buildTrendData(trendHistory, item, chartWindowDays),
    };
  });
}

// ─── top impact items ────────────────────────────────────────────────────────
// Uses RecipeIngredient (direct item→recipe link) so the count reflects how
// many distinct recipes each insumo appears in, regardless of whether
// RecipeVariationIngredient cost fields have been recalculated.
// Impact = recipeCount × latestCostPerConsumptionUnit.

async function loadTopImpact(
  averageWindowDays: number,
  chartWindowDays: number,
  top = 10,
): Promise<ImpactItem[]> {
  const db = prismaClient as any;

  // Fetch every recipe ingredient row for active insumo items
  const ingredientRows = await db.recipeIngredient.findMany({
    select: {
      ingredientItemId: true,
      IngredientItem: {
        select: {
          id: true,
          name: true,
          active: true,
          classification: true,
          consumptionUm: true,
          purchaseUm: true,
          purchaseToConsumptionFactor: true,
          ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
          ItemVariation: {
            where: { deletedAt: null },
            include: {
              ItemCostVariation: {
                select: { costAmount: true, unit: true, validFrom: true, createdAt: true, source: true },
              },
              ItemCostVariationHistory: {
                select: { costAmount: true, unit: true, validFrom: true, createdAt: true, source: true, metadata: true },
                orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
                take: 90,
              },
            },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
    },
  });

  // Group by item, count recipe appearances, keep item data
  const grouped = new Map<string, { item: any; count: number }>();
  for (const row of ingredientRows) {
    const item = row.IngredientItem;
    if (!item?.active || item.classification !== "insumo") continue;
    const existing = grouped.get(item.id);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(item.id, { item, count: 1 });
    }
  }

  if (grouped.size === 0) return [];

  // Compute cost metrics and build trend for each item
  const results: ImpactItem[] = Array.from(grouped.values())
    .map(({ item, count }) => {
      const base = pickPrimaryVariation(item);
      if (!base) return null;

      const history = base.ItemCostVariationHistory ?? [];
      const current = base.ItemCostVariation ?? null;
      const forMetrics = history.length > 0 ? history : current ? [current] : [];
      const metrics =
        forMetrics.length > 0
          ? calculateItemCostMetrics({ item, history: forMetrics, averageWindowDays })
          : null;

      const costPerUnit = metrics?.latestCostPerConsumptionUnit ?? null;
      const trendHistory = history.length > 0 ? history : current ? [current] : [];

      return {
        itemId: item.id,
        name: item.name,
        consumptionUm: item.consumptionUm ?? null,
        recipeUsageCount: count,
        // impact = recipes × unit cost (proxy when lastTotalCostAmount is 0)
        totalCostImpact: costPerUnit != null ? costPerUnit * count : 0,
        latestCostPerConsumptionUnit: costPerUnit,
        trend: buildTrendData(trendHistory, item, chartWindowDays),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.totalCostImpact - a.totalCostImpact)
    .slice(0, top);

  return results;
}

// ─── cost variation items ────────────────────────────────────────────────────
// Uses the two most-recent ItemCostVariationHistory entries per item variation,
// both normalised to the consumption unit, so the before/after values are
// comparable regardless of which purchase unit was used at each point in time.

async function loadCostVariations(top = 10): Promise<{ byAbs: CostVarItem[]; byPct: CostVarItem[]; missingConsumptionUm: MissingUmItem[] }> {
  const db = prismaClient as any;

  // Only show items whose most-recent history entry was updated in the last 60 days.
  // This ensures the variation table shows genuinely recent price changes, not
  // ancient comparisons that would produce misleading deltas.
  const RECENCY_DAYS = 60;
  const recencyCutoff = new Date();
  recencyCutoff.setDate(recencyCutoff.getDate() - RECENCY_DAYS);

  // Fetch active item variations with their two latest history entries and full
  // item measurement data needed for unit normalisation.
  const variations = await db.itemVariation.findMany({
    where: {
      deletedAt: null,
      Item: { active: true, classification: "insumo" },
    },
    select: {
      id: true,
      Item: {
        select: {
          id: true,
          name: true,
          consumptionUm: true,
          purchaseUm: true,
          purchaseToConsumptionFactor: true,
          ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
        },
      },
      ItemCostVariationHistory: {
        // No Prisma-level JSON filter — filter excluded entries in JS below
        // (Prisma JSON path filters exclude rows where the field is null/missing,
        //  which would discard most history entries that don't set that flag at all)
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: { costAmount: true, unit: true, validFrom: true, createdAt: true, source: true, metadata: true },
      },
    },
  });

  const normalizeUm = (u: unknown) => String(u || "").trim().toUpperCase() || null;
  const missingConsumptionUm: MissingUmItem[] = [];

  const withDelta: CostVarItem[] = variations
    .map((v: any) => {
      const item = v.Item;
      if (!item) return null;

      // Filter excluded entries in JS, then take the two most recent valid ones
      const validHistory: any[] = (v.ItemCostVariationHistory ?? [])
        .filter((h: any) => !isItemCostExcludedFromMetrics(h));

      if (validHistory.length < 2) return null;

      const [latest, previous] = validHistory; // already ordered desc

      // Require the most-recent entry to be within the recency window so we only
      // surface items that had an actual recent price update.
      const latestDate = latest.validFrom ? new Date(latest.validFrom) : latest.createdAt ? new Date(latest.createdAt) : null;
      if (!latestDate || latestDate < recencyCutoff) return null;

      const currentNorm = normalizeItemCostToConsumptionUnit(latest, item);
      const previousNorm = normalizeItemCostToConsumptionUnit(previous, item);

      // Both must be valid and positive
      if (
        currentNorm == null || !Number.isFinite(currentNorm) || currentNorm <= 0 ||
        previousNorm == null || !Number.isFinite(previousNorm) || previousNorm <= 0
      ) return null;

      // When consumptionUm is absent, normalizeItemCostToConsumptionUnit returns
      // the raw costAmount regardless of the entry's unit field. If the two entries
      // were recorded in different purchase units (e.g. "CX" vs "KG") the comparison
      // is mathematically meaningless — flag the item so the user can fix it.
      if (!item.consumptionUm) {
        const latestUnit = normalizeUm(latest.unit);
        const previousUnit = normalizeUm(previous.unit);
        if (latestUnit !== previousUnit) {
          missingConsumptionUm.push({
            itemId: item.id,
            name: item.name,
            latestUnit,
            previousUnit,
          });
          return null;
        }
      }

      const absDelta = currentNorm - previousNorm;
      const pctDelta = (absDelta / previousNorm) * 100;

      // Skip if no change
      if (absDelta === 0) return null;

      const pickDate = (entry: any): string | null => {
        const d = entry.validFrom ? new Date(entry.validFrom) : entry.createdAt ? new Date(entry.createdAt) : null;
        return d && !isNaN(d.getTime()) ? d.toISOString() : null;
      };

      return {
        itemId: item.id,
        name: item.name,
        consumptionUm: item.consumptionUm ?? null,
        purchaseUm: item.purchaseUm ?? null,
        unit: item.consumptionUm ?? item.purchaseUm ?? latest.unit ?? null,
        previous: previousNorm,
        current: currentNorm,
        absDelta,
        pctDelta,
        currentDate: pickDate(latest),
        previousDate: pickDate(previous),
      } as CostVarItem;
    })
    .filter(Boolean);

  // Deduplicate by itemId (keep the entry with the largest absolute delta)
  const deduped = new Map<string, CostVarItem>();
  for (const item of withDelta) {
    const existing = deduped.get(item.itemId);
    if (!existing || Math.abs(item.absDelta) > Math.abs(existing.absDelta)) {
      deduped.set(item.itemId, item);
    }
  }
  const unique = Array.from(deduped.values());

  const byAbs = [...unique]
    .sort((a, b) => Math.abs(b.absDelta) - Math.abs(a.absDelta))
    .slice(0, top);

  const byPct = [...unique]
    .sort((a, b) => Math.abs(b.pctDelta) - Math.abs(a.pctDelta))
    .slice(0, top);

  return { byAbs, byPct, all: unique, missingConsumptionUm };
}

// ─── main loader ──────────────────────────────────────────────────────────────

export async function loadDashboardKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const cd = now.getDate();

  const m0 = { year: cy, month: cm };
  const m1 = shiftMonth(cy, cm, 1);
  const m2 = shiftMonth(cy, cm, 2);
  const mly = { year: cy - 1, month: cm };

  const r0 = { start: ymdToInt(m0.year, m0.month, 1), end: ymdToInt(m0.year, m0.month, cd) };
  const r1 = getMonthRange(m1.year, m1.month);
  const r2 = getMonthRange(m2.year, m2.month);
  const rly = getMonthRange(mly.year, mly.month);

  const overallMin = Math.min(r0.start, r1.start, r2.start);
  const overallMax = Math.max(r0.end, r1.end, r2.end);

  const [revenueCurrentPeriod, revenueLastYear, averageWindowDays] = await Promise.all([
    getRevenueByDate(overallMin, overallMax),
    getRevenueByDate(rly.start, rly.end),
    getItemAverageCostWindowDays(),
  ]);

  const chartWindowDays = Math.max(averageWindowDays, 60);

  // ── monthly revenue ──
  const monthlyRevenue = [
    { ...m2, range: r2, isCurrent: false },
    { ...m1, range: r1, isCurrent: false },
    { ...m0, range: r0, isCurrent: true },
  ].map(({ year, month, range, isCurrent }) => ({
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    label: monthLabel(year, month),
    total: sumRange(revenueCurrentPeriod, range.start, range.end),
    isCurrent,
  }));

  // ── weekday charts ──
  const s0 = buildWeekdaySeries(revenueCurrentPeriod, r0, monthLabel(m0.year, m0.month));
  const s1 = buildWeekdaySeries(revenueCurrentPeriod, r1, monthLabel(m1.year, m1.month));
  const sly = buildWeekdaySeries(revenueLastYear, rly, monthLabel(mly.year, mly.month));

  const weekdayCharts: WeekdayChart[] = Array.from({ length: 7 }, (_, wd) => {
    const pts0 = s0.get(wd) ?? [];
    const pts1 = s1.get(wd) ?? [];
    const ptsly = sly.get(wd) ?? [];
    const maxOcc = Math.max(pts0.length, pts1.length, ptsly.length, 1);
    return {
      weekday: wd,
      label: PT_WEEKDAYS[wd],
      xLabels: Array.from({ length: maxOcc }, (_, i) => `${i + 1}ª`),
      series: [
        { seriesLabel: monthLabel(m0.year, m0.month), points: pts0 },
        { seriesLabel: monthLabel(m1.year, m1.month), points: pts1 },
        { seriesLabel: monthLabel(mly.year, mly.month), points: ptsly },
      ],
    };
  });

  // ── item tables (parallel) ──
  const [topExpensive, topImpact, { byAbs: costVarByAbs, byPct: costVarByPct }] = await Promise.all([
    loadTopExpensive(averageWindowDays, chartWindowDays, 10),
    loadTopImpact(averageWindowDays, chartWindowDays, 10),
    loadCostVariations(10),
  ]);

  return { monthlyRevenue, weekdayCharts, topExpensive, topImpact, costVarByAbs, costVarByPct };
}

// ─── exported group functions for defer() streaming ──────────────────────────
// Each function is independent — call without await in the loader so Remix
// streams each group to the client as it resolves, without blocking navigation.

function computeDateContext() {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const cd = now.getDate();

  const m0 = { year: cy, month: cm };
  const m1 = shiftMonth(cy, cm, 1);
  const m2 = shiftMonth(cy, cm, 2);
  const mly = { year: cy - 1, month: cm };
  const m1ly = shiftMonth(cy - 1, cm, 1);
  const m2ly = shiftMonth(cy - 1, cm, 2);

  const r0 = { start: ymdToInt(m0.year, m0.month, 1), end: ymdToInt(m0.year, m0.month, cd) };
  const r1 = getMonthRange(m1.year, m1.month);
  const r2 = getMonthRange(m2.year, m2.month);
  const rly = { start: ymdToInt(mly.year, mly.month, 1), end: ymdToInt(mly.year, mly.month, cd) };
  const r1ly = getMonthRange(m1ly.year, m1ly.month);
  const r2ly = getMonthRange(m2ly.year, m2ly.month);

  return { m0, m1, m2, mly, m1ly, m2ly, r0, r1, r2, rly, r1ly, r2ly };
}

/** Average net result % from the last 6 monthly closes (DRE-based, most reliable). */
async function loadAvgProfitMargin(): Promise<number | null> {
  const db = prismaClient as any;
  const rows = await db.financialMonthlyClose.findMany({
    orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
    take: 6,
    select: { resultadoLiquidoPerc: true },
  });
  const valid = rows.map((r: any) => Number(r.resultadoLiquidoPerc)).filter((v: number) => Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((s: number, v: number) => s + v, 0) / valid.length;
}

/** Group 1 — KDS revenue charts (monthly + weekday comparison) */
export async function loadRevenueGroupData() {
  const { m0, m1, m2, mly, m1ly, m2ly, r0, r1, r2, rly, r1ly, r2ly } = computeDateContext();

  const overallMin = Math.min(r0.start, r1.start, r2.start);
  const overallMax = Math.max(r0.end, r1.end, r2.end);
  const overallMinLy = Math.min(rly.start, r1ly.start, r2ly.start);
  const overallMaxLy = Math.max(rly.end, r1ly.end, r2ly.end);

  const [revenueCurrentPeriod, revenueLastYear, avgProfitMarginPerc] = await Promise.all([
    getRevenueByDate(overallMin, overallMax),
    getRevenueByDate(overallMinLy, overallMaxLy),
    loadAvgProfitMargin(),
  ]);

  const monthlyRevenue = [
    { ...m2, range: r2, isCurrent: false },
    { ...m1, range: r1, isCurrent: false },
    { ...m0, range: r0, isCurrent: true },
  ].map(({ year, month, range, isCurrent }) => ({
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    label: monthLabel(year, month),
    total: sumRange(revenueCurrentPeriod, range.start, range.end),
    isCurrent,
  }));

  const prevYearRaw = [
    { ...m2ly, range: r2ly },
    { ...m1ly, range: r1ly },
    { ...mly, range: rly },
  ].map(({ year, month, range }) => ({
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    label: monthLabel(year, month),
    total: sumRange(revenueLastYear, range.start, range.end),
  }));
  const previousYearMonthlyRevenue = prevYearRaw.some(m => m.total > 0) ? prevYearRaw : null;

  const s0 = buildWeekdaySeries(revenueCurrentPeriod, r0, monthLabel(m0.year, m0.month));
  const s1 = buildWeekdaySeries(revenueCurrentPeriod, r1, monthLabel(m1.year, m1.month));
  const sly = buildWeekdaySeries(revenueLastYear, rly, monthLabel(mly.year, mly.month));

  const weekdayCharts: WeekdayChart[] = Array.from({ length: 7 }, (_, wd) => {
    const pts0 = s0.get(wd) ?? [];
    const pts1 = s1.get(wd) ?? [];
    const ptsly = sly.get(wd) ?? [];
    const maxOcc = Math.max(pts0.length, pts1.length, ptsly.length, 1);
    return {
      weekday: wd,
      label: PT_WEEKDAYS[wd],
      xLabels: Array.from({ length: maxOcc }, (_, i) => `${i + 1}ª`),
      series: [
        { seriesLabel: monthLabel(m0.year, m0.month), points: pts0 },
        { seriesLabel: monthLabel(m1.year, m1.month), points: pts1 },
        { seriesLabel: monthLabel(mly.year, mly.month), points: ptsly },
      ],
    };
  });

  return { monthlyRevenue, previousYearMonthlyRevenue, weekdayCharts, avgProfitMarginPerc };
}

/** Group 2 — Item cost tables (top expensive + top impactful) */
export async function loadItemsGroupData() {
  const averageWindowDays = await getItemAverageCostWindowDays();
  const chartWindowDays = Math.max(averageWindowDays, 60);

  const [topExpensive, topImpact] = await Promise.all([
    loadTopExpensive(averageWindowDays, chartWindowDays, 10),
    loadTopImpact(averageWindowDays, chartWindowDays, 10),
  ]);

  return { topExpensive, topImpact };
}

/** Group 3 — Cost variation tables (by abs R$, by %, and by recipe impact) */
export async function loadCostVarGroupData() {
  const db = prismaClient as any;

  const [{ byAbs, byPct, all, missingConsumptionUm }, ingredientRows] = await Promise.all([
    loadCostVariations(10),
    db.recipeIngredient.groupBy({
      by: ["ingredientItemId"],
      _count: { ingredientItemId: true },
    }),
  ]);

  // Build item → recipe usage count map from ALL variation items
  const usageMap = new Map<string, number>(
    ingredientRows.map((r: any) => [r.ingredientItemId, r._count.ingredientItemId])
  );

  const byImpact: CostVarImpactItem[] = all
    .map(item => {
      const recipeUsageCount = usageMap.get(item.itemId) ?? 0;
      const weightedImpact = Math.abs(item.absDelta) * recipeUsageCount;
      return { ...item, recipeUsageCount, weightedImpact };
    })
    .filter(item => item.recipeUsageCount > 0)
    .sort((a, b) => b.weightedImpact - a.weightedImpact)
    .slice(0, 10);

  return { byAbs, byPct, byImpact, missingConsumptionUm, all };
}
