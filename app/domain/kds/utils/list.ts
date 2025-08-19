import type { OrderRow } from "../types";
export function duplicateCommandNumbers(rows: OrderRow[]): number[] {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (!r.commandNumber) continue;
    counts.set(r.commandNumber, (counts.get(r.commandNumber) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n).sort((a, b) => a - b);
}
export function sumDecimalLike(v: any): number {
  const s = (v as any)?.toString?.() ?? v ?? 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
export function totals(rows: OrderRow[]) {
  const totalPedido = rows.reduce((s, r) => s + sumDecimalLike(r.orderAmount), 0);
  const totalMoto = rows.reduce((s, r) => s + sumDecimalLike(r.motoValue), 0);
  const sizeTotals = rows.reduce(
    (acc, o) => {
      try {
        const s = o?.size ? JSON.parse(o.size as any) : {};
        acc.F += Number(s.F || 0);
        acc.M += Number(s.M || 0);
        acc.P += Number(s.P || 0);
        acc.I += Number(s.I || 0);
        acc.FT += Number(s.FT || 0);
      } catch {}
      return acc;
    },
    { F: 0, M: 0, P: 0, I: 0, FT: 0 }
  );
  return { totalPedido, totalMoto, sizeTotals };
}
export function rebuildOrderWithVisible(full: OrderRow[], visibleOld: OrderRow[], visibleNew: OrderRow[]) {
  const visibleIds = new Set(visibleOld.map((o) => o.id));
  const positions: number[] = [];
  for (let i = 0; i < full.length; i++) if (visibleIds.has(full[i].id)) positions.push(i);
  const next = [...full];
  positions.forEach((pos, idx) => { next[pos] = visibleNew[idx]; });
  return next.map((o) => o.id);
}
