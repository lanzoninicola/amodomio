export type DoughCounts = {
  F: number;
  M: number;
  P: number;
  I: number;
  FT: number;
};
export type DoughSnapshot = {
  effective: DoughCounts;
  base: DoughCounts;
  adjustment: DoughCounts;
  adjustmentMode?: "override" | "loss";
};
export type DoughStockData = {
  date: string;
  today: string;
  sizes: Array<{ key: keyof DoughCounts; label: string; abbr: string }>;
  stock: DoughSnapshot | null;
  previousStock: { dateInt: number; stock: DoughSnapshot } | null;
};
export type DoughStockIntent = "save" | "reset" | "sendWhatsapp";
