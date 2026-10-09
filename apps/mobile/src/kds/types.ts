import { theme } from "../ui/theme";

export const KDS_STATUSES = [
  {
    id: "novoPedido",
    label: "Novo pedido",
    color: theme.colors.brandBlue,
    tint: theme.colors.brandBlueMuted,
  },
  {
    id: "emProducao",
    label: "Em produção",
    color: theme.colors.brandViolet,
    tint: theme.colors.brandVioletMuted,
  },
  {
    id: "aguardandoForno",
    label: "Aguardando forno",
    color: theme.colors.brandOrangeInk,
    tint: theme.colors.brandOrangeMuted,
  },
  {
    id: "assando",
    label: "Assando",
    color: theme.colors.brandRedInk,
    tint: theme.colors.dangerMuted,
  },
  {
    id: "finalizado",
    label: "Finalizado",
    color: theme.colors.success,
    tint: theme.colors.successMuted,
  },
] as const;

export type KdsStatus = (typeof KDS_STATUSES)[number]["id"];

export function getKdsStatusStyle(status: string | null | undefined) {
  return (
    KDS_STATUSES.find((entry) => entry.id === status) ?? {
      id: status ?? "unknown",
      label: status === "pendente" ? "Pendente" : "Status não reconhecido",
      color: theme.colors.mutedForeground,
      tint: theme.colors.muted,
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
