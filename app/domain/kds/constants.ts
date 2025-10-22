export const CHANNELS = [
  "WHATS/PRESENCIAL/TELE",
  "MOGO",
  "AIQFOME",
  "IFOOD",
] as const;
export const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-slate-200 text-slate-800",
  novoPedido: "bg-gray-200 text-gray-800",
  emProducao: "bg-blue-100 text-blue-800",
  aguardandoForno: "bg-purple-100 text-purple-800",
  assando: "bg-orange-100 text-orange-800",
  finalizado: "bg-yellow-100 text-yellow-800",
};
export const GRID_TMPL =
  "grid grid-cols-[70px,150px,260px,90px,110px,85px,160px,120px,60px,96px] gap-2 items-center gap-x-4";
export const HEADER_TMPL =
  "grid grid-cols-[70px,150px,260px,90px,110px,85px,160px,120px,60px,96px] gap-2 gap-x-4 border-b font-semibold text-sm sticky top-0 z-10";

// === Ranking para detectar downgrade/upgrade de status ===
export const STATUS_RANK: Record<string, number> = {
  pendente: 0,
  novoPedido: 1,
  emProducao: 2,
  aguardandoForno: 3,
  assando: 4,
  finalizado: 5,
};
