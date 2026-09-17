export const KDS_STATUSES = [
  { id: "novoPedido", label: "Novo pedido", color: "#475569", tint: "#f1f5f9" },
  { id: "emProducao", label: "Em produção", color: "#2563eb", tint: "#eff6ff" },
  {
    id: "aguardandoForno",
    label: "Aguardando forno",
    color: "#7c3aed",
    tint: "#f5f3ff",
  },
  { id: "assando", label: "Assando", color: "#ea580c", tint: "#fff7ed" },
  { id: "finalizado", label: "Finalizado", color: "#a16207", tint: "#fefce8" },
] as const;

export type KdsStatus = (typeof KDS_STATUSES)[number]["id"];

export type KdsOrder = {
  id: string;
  dateInt: number;
  createdAt: string;
  updatedAt: string;
  commandNumber: number | null;
  status: KdsStatus;
  channel: string;
  takeAway: boolean;
  requestedForOven: boolean;
  customerName: string | null;
  sizes: { F: number; M: number; P: number; I: number; FT: number } | null;
};

export type KdsUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  roles: string[];
};
