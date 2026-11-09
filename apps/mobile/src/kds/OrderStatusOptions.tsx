import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import { KDS_STATUSES, type KdsOrder, type KdsStatus } from "./types";

const statusIcons = {
  novoPedido: "＋",
  emProducao: "⚒",
  aguardandoForno: "◷",
  assando: "♨",
  finalizado: "✓",
};

export function OrderStatusOptions({
  order,
  busy,
  onMove,
}: {
  order: KdsOrder;
  busy: boolean;
  onMove: (order: KdsOrder, status: KdsStatus) => void;
}) {
  return (
    <View style={styles.options}>
      {KDS_STATUSES.map((status) => {
        const current = order.status === status.id;
        return (
          <Pressable
            key={status.id}
            accessibilityRole="button"
            accessibilityLabel={`Mover pedido ${
              order.commandNumber ?? "VL"
            } para ${status.label}`}
            accessibilityState={{
              selected: current,
              disabled: busy || current,
            }}
            disabled={busy || current}
            style={({ pressed }) => [
              styles.statusOption,
              current && styles.statusOptionCurrent,
              (busy || pressed) && { opacity: 0.5 },
            ]}
            onPress={() => onMove(order, status.id)}
          >
            <Text style={styles.statusIcon}>{statusIcons[status.id]}</Text>
            <Text
              style={styles.statusOptionText}
              numberOfLines={3}
              adjustsFontSizeToFit
            >
              {status.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: "row", gap: 6, paddingVertical: 8 },
  statusIcon: {
    color: "#000000",
    fontSize: 24,
    lineHeight: 32,
    height: 32,
    textAlign: "center",
  },
  statusOption: {
    minHeight: 100,
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#000000",
    backgroundColor: "#ffffff",
    paddingHorizontal: 3,
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 10,
  },
  statusOptionCurrent: {
    borderColor: "#000000",
    borderWidth: 2,
    backgroundColor: theme.colors.brandYellow,
  },
  statusOptionText: {
    color: "#000000",
    fontSize: 12,
    lineHeight: 16,
    height: 48,
    verticalAlign: "middle",
    fontFamily: theme.typography.semibold,
    textAlign: "center",
  },
});
