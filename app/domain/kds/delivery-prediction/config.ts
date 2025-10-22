// app/domain/kds/prediction/config.ts
import type { SizeCounts } from "./types";

// Tempo médio (produção + forno) por tamanho (min) — ajuste livre
export const AVG_PROD_MIN: Record<keyof SizeCounts, number> = {
  P: 8,
  M: 12,
  F: 15,
  I: 6,
  FT: 18,
};

// Tempo de corte/embalagem/expedição por pedido (min)
export const HANDOFF_MIN = 2;

// Retorno do motoboy para o hub após entregar (min)
export const RETURN_MIN = 5;

// Nº operadores por dia (0=Dom,1=Seg,...,6=Sáb)
export function getOperatorCountByDate(ymd: string): number {
  // por enquanto fixo em 2 (média)
  return 2;
}

// Nº motoboys por dia (0=Dom,...,6=Sáb)
export function getRiderCountByDate(ymd: string): number {
  const dt = new Date(`${ymd}T12:00:00`);
  const dow = dt.getDay();
  // Qua(3), Qui(4) = 1; Sex(5), Sáb(6), Dom(0) = 2; demais = 1
  if (dow === 3 || dow === 4) return 1;
  if (dow === 5 || dow === 6 || dow === 0) return 2;
  return 1;
}
