export const KDS_STATUSES = [
  { id: "novoPedido", label: "Novo pedido", color: "#0284c7", tint: "#f0f9ff" },
  { id: "emProducao", label: "Em produção", color: "#7c3aed", tint: "#f5f3ff" },
  {
    id: "aguardandoForno",
    label: "Aguardando forno",
    color: "#b45309",
    tint: "#fffbeb",
  },
  { id: "assando", label: "Assando", color: "#0f766e", tint: "#f0fdfa" },
  { id: "finalizado", label: "Finalizado", color: "#15803d", tint: "#f0fdf4" },
] as const;

export type KdsStatus = (typeof KDS_STATUSES)[number]["id"];

export function getKdsStatusStyle(status: string | null | undefined) {
  return (
    KDS_STATUSES.find((entry) => entry.id === status) ?? {
      id: status ?? "unknown",
      label: status === "pendente" ? "Pendente" : "Status não reconhecido",
      color: "#64748b",
      tint: "#f1f5f9",
    }
  );
}

export type KdsOrder = {
  id: string;
  dateInt: number;
  createdAt: string;
  novoPedidoAt?: string | null;
  finalizadoAt?: string | null;
  updatedAt: string;
  commandNumber: number | null;
  status: string;
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
