import { View } from "react-native";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import { elapsedSince } from "./order-time";
import type { KdsOrder } from "./types";

function clock(value: string | null | undefined) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Indisponível";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function OrderTiming({
  order,
  now,
  useEntryTime,
  showStartTime = true,
}: {
  order: KdsOrder;
  now: number;
  useEntryTime: boolean;
  showStartTime?: boolean;
}) {
  const start = useEntryTime
    ? order.novoPedidoAt ?? order.createdAt
    : order.createdAt;
  const finished = useEntryTime && order.status === "finalizado";
  const end = finished
    ? order.finalizadoAt
      ? new Date(order.finalizadoAt).getTime()
      : NaN
    : now;
  const rows = [
    ...(showStartTime
      ? [
          [
            useEntryTime && order.novoPedidoAt
              ? "Entrada em Novo pedido"
              : "Criação do pedido",
            clock(start),
          ],
        ]
      : []),
    [finished ? "Tempo total" : "Tempo decorrido", elapsedSince(start, end)],
    ...(order.status === "finalizado"
      ? [["Finalizado às", clock(order.finalizadoAt)]]
      : []),
  ];
  return (
    <View
      style={{
        backgroundColor: theme.colors.secondary,
        borderRadius: theme.radius.md,
        padding: 12,
        gap: 8,
        marginTop: 12,
        marginBottom: 12,
      }}
    >
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              color: theme.colors.mutedForeground,
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontFamily: theme.typography.semibold,
              color: theme.colors.primary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}
