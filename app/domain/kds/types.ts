import type { Prisma } from "@prisma/client";
export type DecimalLike = number | string | Prisma.Decimal;
export type SizeCounts = {
  F: number;
  M: number;
  P: number;
  I: number;
  FT: number;
};
export const defaultSizeCounts = (): SizeCounts => ({
  F: 0,
  M: 0,
  P: 0,
  I: 0,
  FT: 0,
});
export type OrderRow = {
  id: string;
  dateInt: number;
  novoPedidoAt?: string | Date | null;
  createdAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  commandNumber: number | null;
  isVendaLivre: boolean;
  sortOrderIndex: number;
  size?: string | null;
  hasMoto?: boolean | null;
  motoValue?: DecimalLike | null;
  take_away?: boolean | null;
  orderAmount?: DecimalLike | null;
  channel?: string | null;
  status?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
};
